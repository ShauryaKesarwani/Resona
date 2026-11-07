import {
  createPublicClient, createWalletClient, decodeErrorResult, getAddress, http, isAddress, keccak256,
  parseAbi, stringToHex, zeroAddress, type Address, type Hex,
} from "viem";
import { sepolia } from "viem/chains";
import { evmChainIdToCoinType, normalizeName } from "enssdk";
import { createEnsNodeClient } from "enssdk/core";
import { omnigraph } from "enssdk/omnigraph";
import { privateKeyToAccount } from "viem/accounts";
import { passLabel } from "./labels.ts";

const registryAbi = parseAbi([
  "function getSubregistry(uint256 anyId) view returns (address)",
  "function getOwner(uint256 anyId) view returns (address)",
  "function getTokenId(uint256 anyId) view returns (uint256)",
  "function getExpiry(uint256 anyId) view returns (uint64)",
  "function unregister(uint256 anyId)",
  "function register(string label, address owner, address registry, address resolver, uint256 roleBitmap, uint64 expiry) returns (uint256 tokenId)",
  "function safeTransferFrom(address from, address to, uint256 tokenId, uint256 amount, bytes data)",
  "error TransferDisallowed(uint256 tokenId, address owner)",
]);

export type EnsSettings = {
  enabled: boolean;
  rpcUrl?: string;
  eventName?: string;
  parentRegistry?: string;
  eventRegistry?: string;
  ensNodeUrl?: string;
  privateKey?: string;
};

const DEFAULT_ENSNODE_URL = "https://api.v2-sepolia.ensnode.io";
const RABDI_CHAIN_ID = 7794095;
const RABDI_COIN_TYPE = evmChainIdToCoinType(RABDI_CHAIN_ID);
const ADDRESS_LOOKUP = `query ResolveName($name: InterpretedName!, $coinType: CoinType!) {
  domain(by: { name: $name }) {
    canonical { name { interpreted } }
    resolve { records { addresses(coinTypes: [$coinType]) { address } } }
  }
}`;
type NameLookupData = { domain?: {
    canonical?: { name?: { interpreted?: string } } | null;
    resolve?: { records?: { addresses?: Array<{ address?: string | null }> } | null } | null;
  } | null };
type NameLookupResponse = { errors?: unknown[]; data?: NameLookupData | null };

export type EnsPassResult = {
  enabled: true;
  name: string;
  chainId: 11155111;
  registry: Address;
  owner: Address;
  expiry: string;
  matchesHolder: boolean;
  linked: boolean;
  active: boolean;
};

function revertData(error: unknown): Hex | undefined {
  const seen = new Set<unknown>();
  const visit = (value: unknown, depth: number): Hex | undefined => {
    if (depth > 5 || value === null || value === undefined || seen.has(value)) return undefined;
    if (typeof value === "string") return /^0x[0-9a-fA-F]+$/.test(value) ? value as Hex : undefined;
    if (typeof value !== "object") return undefined;
    seen.add(value);
    for (const key of ["data", "cause", "error", "details", "originalError"]) {
      const found = visit((value as Record<string, unknown>)[key], depth + 1);
      if (found) return found;
    }
    return undefined;
  };
  return visit(error, 0);
}

export function createEnsService(settings: EnsSettings) {
  const configured = settings.enabled && !!settings.rpcUrl && !!settings.eventName && !!settings.parentRegistry && !!settings.eventRegistry;
  const client = configured ? createPublicClient({ chain: sepolia, transport: http(settings.rpcUrl!) }) : undefined;
  const privateKey = settings.privateKey && /^0x[0-9a-fA-F]{64}$/.test(settings.privateKey) ? settings.privateKey as Hex : undefined;
  const writeClient = client && privateKey
    ? createWalletClient({ chain: sepolia, transport: http(settings.rpcUrl!), account: privateKeyToAccount(privateKey) })
    : undefined;
  const ensNodeUrl = settings.ensNodeUrl?.trim() || DEFAULT_ENSNODE_URL;

  async function resolveName(input: string) {
    if (!input.trim() || input.trim().length > 255) throw new Error("invalid_ens_name");
    let name: string;
    try {
      name = normalizeName(input.trim());
    } catch {
      throw new Error("invalid_ens_name");
    }
    let result: NameLookupResponse;
    try {
      const client = createEnsNodeClient({ url: ensNodeUrl }).extend(omnigraph);
      result = await client.omnigraph.query<NameLookupData, { name: typeof name; coinType: typeof RABDI_COIN_TYPE }>({
        query: ADDRESS_LOOKUP,
        variables: { name, coinType: RABDI_COIN_TYPE },
        signal: AbortSignal.timeout(8_000),
      });
    } catch {
      throw new Error("ens_lookup_unavailable");
    }
    if (result.errors?.length) throw new Error("ens_lookup_unavailable");
    const domain = result.data?.domain;
    const canonicalName = domain?.canonical?.name?.interpreted;
    if (!domain || !canonicalName) throw new Error("ens_name_not_found");
    const value = domain.resolve?.records?.addresses?.find((record) => record.address)?.address;
    if (!value) throw new Error("ens_address_not_set");
    if (!isAddress(value)) throw new Error("ens_lookup_unavailable");
    return { name: canonicalName, address: getAddress(value) };
  }

  function addresses() {
    if (!client || !settings.eventName || !settings.parentRegistry || !settings.eventRegistry) throw new Error("ens_not_configured");
    if (!isAddress(settings.parentRegistry) || !isAddress(settings.eventRegistry)) throw new Error("ens_invalid_config");
    const eventName = settings.eventName.trim().toLowerCase();
    if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.eth$/.test(eventName)) throw new Error("ens_invalid_config");
    return { client, eventName, parentRegistry: getAddress(settings.parentRegistry), eventRegistry: getAddress(settings.eventRegistry) };
  }

  async function pass(passId: string, expectedHolder: string): Promise<EnsPassResult> {
    const { client, eventName, parentRegistry, eventRegistry } = addresses();
    if (!isAddress(expectedHolder)) throw new Error("invalid_holder");
    const label = passLabel(passId);
    const labelId = BigInt(keccak256(stringToHex(label)));
    const eventLabel = eventName.slice(0, -4);
    const eventId = BigInt(keccak256(stringToHex(eventLabel)));
    const [linkedRegistry, owner, expiry] = await Promise.all([
      client.readContract({ address: parentRegistry, abi: registryAbi, functionName: "getSubregistry", args: [eventId] }),
      client.readContract({ address: eventRegistry, abi: registryAbi, functionName: "getOwner", args: [labelId] }),
      client.readContract({ address: eventRegistry, abi: registryAbi, functionName: "getExpiry", args: [labelId] }),
    ]);
    return {
      enabled: true,
      name: `${label}.${eventName}`,
      chainId: 11155111,
      registry: eventRegistry,
      owner,
      expiry: expiry.toString(),
      matchesHolder: owner.toLowerCase() === getAddress(expectedHolder).toLowerCase(),
      linked: linkedRegistry.toLowerCase() === eventRegistry.toLowerCase(),
      active: owner !== zeroAddress && expiry > BigInt(Math.floor(Date.now() / 1000)),
    };
  }

  async function transferCheck(passId: string, expectedHolder: string, recipient: string) {
    const info = await pass(passId, expectedHolder);
    if (!isAddress(recipient)) throw new Error("invalid_recipient");
    if (!info.active || !info.linked || !info.matchesHolder) return { result: "not_verified" as const, pass: info };
    const { client } = addresses();
    const labelId = BigInt(keccak256(stringToHex(passLabel(passId))));
    const tokenId = await client.readContract({ address: info.registry, abi: registryAbi, functionName: "getTokenId", args: [labelId] });
    try {
      await client.simulateContract({
        account: info.owner,
        address: info.registry,
        abi: registryAbi,
        functionName: "safeTransferFrom",
        args: [info.owner, getAddress(recipient), tokenId, 1n, "0x"],
      });
      return { result: "transferable" as const, pass: info, tokenId: tokenId.toString() };
    } catch (error) {
      const data = revertData(error);
      if (!data) throw error;
      const decoded = decodeErrorResult({ abi: registryAbi, data });
      if (decoded.errorName !== "TransferDisallowed" || decoded.args[0] !== tokenId || decoded.args[1].toLowerCase() !== info.owner.toLowerCase()) throw error;
      return { result: "blocked" as const, pass: info, tokenId: tokenId.toString(), error: decoded.errorName };
    }
  }

  async function reassignPass(passId: string, expectedHolder: string, recipient: string) {
    const info = await pass(passId, expectedHolder);
    if (!info.active || !info.linked || !info.matchesHolder) throw new Error("ens_pass_not_verified");
    if (!isAddress(recipient)) throw new Error("invalid_recipient");
    const nextOwner = getAddress(recipient);
    if (nextOwner.toLowerCase() === info.owner.toLowerCase()) throw new Error("same_recipient");
    if (!writeClient || !client) throw new Error("ens_write_not_configured");
    const { eventRegistry } = addresses();
    const label = passLabel(passId);
    const labelId = BigInt(keccak256(stringToHex(label)));
    const unregisterTxHash = await writeClient.writeContract({
      address: eventRegistry, abi: registryAbi, functionName: "unregister", args: [labelId],
    });
    const unregisterReceipt = await client.waitForTransactionReceipt({ hash: unregisterTxHash });
    if (unregisterReceipt.status !== "success") throw new Error("ens_unregister_failed");
    const registerTxHash = await writeClient.writeContract({
      address: eventRegistry, abi: registryAbi, functionName: "register",
      args: [label, nextOwner, zeroAddress, zeroAddress, 0n, BigInt(info.expiry)],
    });
    const registerReceipt = await client.waitForTransactionReceipt({ hash: registerTxHash });
    if (registerReceipt.status !== "success") throw new Error("ens_register_failed");
    return { unregisterTxHash, registerTxHash };
  }

  return { configured, writeConfigured: !!writeClient, pass, transferCheck, reassignPass, resolveName };
}

export type EnsService = ReturnType<typeof createEnsService>;
