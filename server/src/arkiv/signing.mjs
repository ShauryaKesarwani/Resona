// Arkiv's official one-shot create adapter (guides/quickstart, SDK 1.0.1). It makes exactly one
// Create per instance and never retries a write, so an uncertain write can't create a duplicate.
import { createWalletClient } from '@arkiv-network/sdk';
import { rabdi } from '@arkiv-network/sdk/chains';
import { custom, decodeFunctionData, getAddress, keccak256, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const registry = '0x4400000000000000000000000000000000000044';
const executeAbi = parseAbi(['function execute((uint8 operation, bytes operationData)[] ops) external returns (bytes32[] keys)']);
const readMethods = new Set(['eth_blockNumber', 'eth_chainId', 'eth_getTransactionReceipt', 'eth_getTransactionByHash', 'eth_getBlockByNumber']);
const fail = message => { throw new Error(message); };

export function guardedWalletClient({ publicClient, signer, accessKey, maxCostWei, approve, onSubmitted = /** @type {(hash: string) => unknown} */ (() => {}) }) {
  if (typeof maxCostWei !== 'bigint' || maxCostWei <= 0n || typeof approve !== 'function')
    fail('Explicit positive fee budget and approval callback required');
  const chain = rabdi({ accessKey });
  const address = getAddress(signer.address);
  const state = { attempted: false, hash: null, reservedWei: 0n, phase: 'ready' };
  let approved, explicit;
  const client = createWalletClient({ chain, account: address, pollingInterval: 1000,
    transport: custom({ request: async ({ method, params }) => {
      if (readMethods.has(method)) return publicClient.request({ method, params });
      if (method !== 'eth_sendTransaction' || state.attempted) fail('Only one create submission is permitted; do not retry');
      state.attempted = true; // Set before ANY asynchronous signing/preflight work.
      state.phase = 'preflight';
      const input = params?.[0];
      if (!input || Object.keys(input).some(key => !['from','to','data','gas','gasPrice','nonce','type'].includes(key))
          || getAddress(input.from) !== address || input.to?.toLowerCase() !== registry
          || typeof input.data !== 'string' || BigInt(input.gas ?? 0) !== explicit.gas
          || BigInt(input.gasPrice ?? 0) !== explicit.gasPrice || Number(input.nonce) !== explicit.nonce
          || input.type !== undefined && input.type !== '0x0') fail('Unexpected transaction fields');
      const decoded = decodeFunctionData({ abi: executeAbi, data: input.data });
      if (decoded.functionName !== 'execute' || decoded.args[0].length !== 1 || decoded.args[0][0].operation !== 1)
        fail('Exactly one Create operation is required');
      if (await publicClient.getChainId() !== 7794095) fail('Expected Rabdi RPC');
      await signer.verify();
      const started = Date.now();
      const call = { account: address, to: registry, data: input.data, value: 0n };
      await publicClient.call({ ...call, blockTag: 'latest' }); // Simulation only, not a transaction.
      const estimate = await publicClient.estimateGas({ ...call, blockTag: 'latest' });
      if (typeof estimate !== 'bigint' || estimate <= 0n) fail('Invalid unsigned gas estimate');
      const floor = 1000000n + 400000n * BigInt(decoded.args[0].length - 1);
      const gas = estimate * 2n > floor ? estimate * 2n : floor;
      const head = await publicClient.getBlock({ blockTag: 'latest', includeTransactions: false });
      if (typeof head.gasLimit !== 'bigint' || head.gasLimit <= 0n || gas * 2n > head.gasLimit)
        fail('Gas exceeds half the current block limit; split the batch and obtain a new approval');
      const { gasPrice, nonce } = explicit;
      const maximum = gas * gasPrice;
      if (maximum > maxCostWei || await publicClient.getBalance({ address, blockTag: 'latest' }) < maximum)
        fail('Fee budget or wallet balance is insufficient');
      approved = Object.freeze({ from: address, to: registry, data: input.data, value: 0n,
        chainId: 7794095, type: 'legacy', gas, gasPrice, nonce });
      state.reservedWei = maximum;
      if (await approve(Object.freeze({ ...approved, maximumCostWei: maximum })) !== true)
        fail('Creation was not approved; do not retry or change signer automatically');
      if (Date.now() - started > 60000 || await publicClient.getChainId() !== 7794095
          || await publicClient.getTransactionCount({ address, blockTag: 'latest' }) !== nonce
          || await publicClient.getGasPrice() !== gasPrice)
        fail('Quote, network or nonce changed; a new approval is required');
      const freshEstimate = await publicClient.estimateGas({ ...call, blockTag: 'latest' });
      const freshHead = await publicClient.getBlock({ blockTag: 'latest', includeTransactions: false });
      if (typeof freshEstimate !== 'bigint' || freshEstimate <= 0n || gas < freshEstimate * 2n
          || typeof freshHead.gasLimit !== 'bigint' || gas * 2n > freshHead.gasLimit
          || await publicClient.getBalance({ address, blockTag: 'latest' }) < maximum
          || await publicClient.getTransactionCount({ address, blockTag: 'latest' }) !== nonce
          || await publicClient.getGasPrice() !== gasPrice)
        fail('Signature bounds or fees changed; reconcile without signing');
      await signer.verify();
      state.phase = 'submission_unknown'; // Preserve reservation on every ambiguous failure.
      const hash = await signer.send(approved);
      if (!/^0x[0-9a-f]{64}$/i.test(hash)) fail('Invalid submitted hash; investigate before any new write');
      state.hash = hash; state.phase = 'submitted';
      await onSubmitted(hash); // Local receipt journal only; no key or signed bytes.
      return hash;
    } }, { retryCount: 0 }) });
  let invoked = false;
  return { chain, account: { address }, getSubmission: () => ({ ...state }),
    async createEntity(schema, values, options) {
      if (invoked) fail('This create adapter is one-shot; inspect its previous outcome');
      invoked = true;
      let failureReason = 'verification_failed'; // Closed local codes, never provider text/code.
      try {
        explicit = Object.freeze({ nonce: await publicClient.getTransactionCount({ address, blockTag: 'latest' }),
          gas: 1000000n, gasPrice: await publicClient.getGasPrice() });
        if (!Number.isSafeInteger(explicit.nonce) || explicit.nonce < 0 || explicit.gasPrice <= 0n)
          fail('Invalid explicit transaction parameters');
        const result = await client.createEntity(schema, values, options, explicit);
        if (result.txHash?.toLowerCase() !== state.hash?.toLowerCase()) {
          failureReason = 'replacement_receipt';
          fail('Receipt belongs to a replacement; investigate without resending');
        }
        const mined = await publicClient.getTransactionReceipt({ hash: state.hash });
        if (mined.status !== 'success') fail('Creation reverted; do not automatically resend');
        const transaction = await publicClient.getTransaction({ hash: state.hash });
        if (getAddress(transaction.from) !== address || transaction.to?.toLowerCase() !== registry
            || typeof transaction.input !== 'string' || transaction.input.toLowerCase() !== approved.data.toLowerCase()
            || transaction.value !== 0n || transaction.chainId !== 7794095
            || transaction.type !== approved.type || transaction.nonce !== approved.nonce || transaction.gas !== approved.gas
            || transaction.gasPrice !== approved.gasPrice) {
          failureReason = 'transaction_mismatch';
          fail('Submitted transaction differs from the approved request; investigate without resending');
        }
        state.phase = 'receipt_verified';
        return result;
      } catch {
        // Provider/SDK errors may contain sensitive context; never log them raw.
        fail(`Create not verified (${state.phase}; ${failureReason}); inspect the local hash/journal, do not automatically resend`);
      }
    }
  };
}

export function localEnvSigner(publicClient, privateKey, onSignedHash = /** @type {(hash: string) => unknown} */ (() => {})) {
  const account = privateKeyToAccount(privateKey);
  return {
    address: account.address,
    async verify() {
      if (await publicClient.getChainId().catch(() => { throw new Error('Rabdi connection check failed'); }) !== 7794095) throw new Error('Expected Rabdi RPC');
    },
    async send(tx) {
      if (tx.from !== account.address || tx.chainId !== 7794095 || tx.value !== 0n || tx.type !== 'legacy')
        throw new Error('Unexpected local signing request');
      const { from, ...unsigned } = tx;
      const serializedTransaction = await account.signTransaction(unsigned);
      const expectedHash = keccak256(serializedTransaction);
      await onSignedHash(expectedHash); // Persist only this public hash before broadcasting.
      const hash = await publicClient.sendRawTransaction({ serializedTransaction })
        .catch(() => { throw new Error('Submission is uncertain; reconcile locally before any new write'); });
      if (hash.toLowerCase() !== expectedHash.toLowerCase()) throw new Error('RPC returned a different transaction hash');
      return hash;
    }
  };
}
