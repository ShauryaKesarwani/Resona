import { randomBytes } from "node:crypto";
import {
  createPublicClient,
  createWalletClient,
  decodeErrorResult,
  encodeFunctionData,
  getAddress,
  http,
  isAddress,
  keccak256,
  parseAbi,
  parseEventLogs,
  stringToHex,
  zeroAddress,
  type Address,
  type Hex,
} from "viem";
import { sepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const required = (name: string) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name} in server/.env.ens`);
  return value;
};

const address = (name: string): Address => {
  const value = required(name);
  if (!isAddress(value)) throw new Error(`${name} must be an Ethereum address`);
  return getAddress(value);
};

const env = {
  rpcUrl: required("ENS_RPC_URL"),
  privateKey: process.env.ENS_PRIVATE_KEY?.trim() as Hex | undefined,
  eventName: required("ENS_EVENT_NAME").toLowerCase(),
  parentRegistry: address("ENS_PARENT_REGISTRY"),
  factory: address("ENS_FACTORY"),
  implementation: address("ENS_USER_REGISTRY_IMPL"),
  eventRegistry: process.env.ENS_EVENT_REGISTRY?.trim()
    ? address("ENS_EVENT_REGISTRY")
    : undefined,
};

if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.eth$/.test(env.eventName)) {
  throw new Error("ENS_EVENT_NAME must be a single-label .eth name, such as demo-event.eth");
}

const publicClient = createPublicClient({ chain: sepolia, transport: http(env.rpcUrl) });
const account = env.privateKey ? privateKeyToAccount(env.privateKey) : undefined;
const walletClient = account ? createWalletClient({ account, chain: sepolia, transport: http(env.rpcUrl) }) : undefined;
const label = env.eventName.slice(0, -4);
const labelHash = BigInt(keccak256(stringToHex(label)));

const factoryAbi = parseAbi([
  "function deployProxy(address implementation, uint256 salt, bytes data) returns (address proxy)",
  "event ProxyDeployed(address indexed sender, address indexed proxyAddress, uint256 salt, address implementation)",
]);
const initAbi = parseAbi(["function initialize((address account, uint256 roleBitmap)[] grants)"]);
const registryAbi = parseAbi([
  "function setParent(address parent, string label)",
  "function setSubregistry(uint256 anyId, address subregistry)",
  "function getSubregistry(uint256 anyId) view returns (address)",
  "function getExpiry(uint256 anyId) view returns (uint64)",
  "function register(string label, address owner, address registry, address resolver, uint256 roleBitmap, uint64 expiry) returns (uint256 tokenId)",
  "function getOwner(uint256 anyId) view returns (address)",
  "function getTokenId(uint256 anyId) view returns (uint256)",
  "function safeTransferFrom(address from, address to, uint256 tokenId, uint256 amount, bytes data)",
  "error TransferDisallowed(uint256 tokenId, address owner)",
]);

const ROOT_ROLES = (1n << 0n) | (1n << 8n) | (1n << 12n) | (1n << 16n);
const txUrl = (hash: Hex) => `https://sepolia.etherscan.io/tx/${hash}`;
function getEventRegistry(): Address {
  if (!env.eventRegistry) throw new Error("Missing ENS_EVENT_REGISTRY in server/.env.ens");
  return env.eventRegistry;
}

function getWalletClient() {
  if (!walletClient) throw new Error("This command requires ENS_PRIVATE_KEY in server/.env.ens");
  return walletClient;
}

function passLabel(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(normalized)) {
    throw new Error("Pass ID must be a single ENS label containing only letters, digits, or hyphens");
  }
  return normalized;
}

async function send(to: Address, abi: typeof registryAbi, functionName: string, args: readonly unknown[]) {
  const hash = await getWalletClient().writeContract({ address: to, abi, functionName, args } as never);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`Transaction reverted: ${txUrl(hash)}`);
  console.log(`transaction: ${txUrl(hash)}`);
  return receipt;
}

async function deploy() {
  if (!account) throw new Error("The deploy command requires ENS_PRIVATE_KEY in server/.env.ens");
  const initData = encodeFunctionData({
    abi: initAbi,
    functionName: "initialize",
    args: [[{ account: account.address, roleBitmap: ROOT_ROLES }]],
  });
  // A fresh salt gives each invocation a distinct proxy. Recover a previous deployment from its receipt.
  const salt = BigInt(`0x${randomBytes(32).toString("hex")}`);
  const hash = await getWalletClient().writeContract({
    address: env.factory,
    abi: factoryAbi,
    functionName: "deployProxy",
    args: [env.implementation, salt, initData],
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`Deployment reverted: ${txUrl(hash)}`);
  const [deployed] = parseEventLogs({ abi: factoryAbi, eventName: "ProxyDeployed", logs: receipt.logs });
  if (!deployed) throw new Error("Deployment succeeded but no ProxyDeployed event was found");
  console.log(`transaction: ${txUrl(hash)}`);
  console.log(`ENS_EVENT_REGISTRY=${deployed.args.proxyAddress}`);
}

async function link() {
  if (!account) throw new Error("The link command requires ENS_PRIVATE_KEY in server/.env.ens");
  const registry = getEventRegistry();
  const current = await publicClient.readContract({
    address: env.parentRegistry, abi: registryAbi, functionName: "getSubregistry", args: [labelHash],
  });
  if (current.toLowerCase() !== zeroAddress && current.toLowerCase() !== registry.toLowerCase()) {
    throw new Error(`Refusing to replace existing subregistry ${current}`);
  }
  await send(registry, registryAbi, "setParent", [env.parentRegistry, label]);
  if (current.toLowerCase() !== registry.toLowerCase()) {
    await send(env.parentRegistry, registryAbi, "setSubregistry", [labelHash, registry]);
  }
  console.log(`${env.eventName} is linked to ${registry}`);
}

async function issue(passId: string, holder: string, expiryInput: string) {
  if (!account) throw new Error("The issue command requires ENS_PRIVATE_KEY in server/.env.ens");
  const registry = getEventRegistry();
  const pass = passLabel(passId);
  if (!isAddress(holder)) throw new Error("Holder must be an Ethereum address");
  if (!/^\d+$/.test(expiryInput)) throw new Error("Expiry must be a Unix timestamp in seconds");
  const expiry = BigInt(expiryInput);
  const now = BigInt(Math.floor(Date.now() / 1000));
  if (expiry <= now || expiry > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("Expiry must be a future Unix timestamp");
  const parentExpiry = await publicClient.readContract({
    address: env.parentRegistry, abi: registryAbi, functionName: "getExpiry", args: [labelHash],
  });
  if (expiry > parentExpiry) throw new Error("Pass expiry cannot exceed the event name expiry");
  const attached = await publicClient.readContract({
    address: env.parentRegistry, abi: registryAbi, functionName: "getSubregistry", args: [labelHash],
  });
  if (attached.toLowerCase() !== registry.toLowerCase()) throw new Error("Configured event registry is not linked to the event name");
  await send(registry, registryAbi, "register", [pass, getAddress(holder), zeroAddress, zeroAddress, 0n, expiry]);
  console.log(`${pass}.${env.eventName} issued to ${getAddress(holder)} until ${expiry}`);
}

async function inspect(passId: string) {
  const pass = passLabel(passId);
  const registry = getEventRegistry();
  const id = BigInt(keccak256(stringToHex(pass)));
  const [owner, tokenId, expiry] = await Promise.all([
    publicClient.readContract({ address: registry, abi: registryAbi, functionName: "getOwner", args: [id] }),
    publicClient.readContract({ address: registry, abi: registryAbi, functionName: "getTokenId", args: [id] }),
    publicClient.readContract({ address: registry, abi: registryAbi, functionName: "getExpiry", args: [id] }),
  ]);
  console.log(JSON.stringify({ name: `${pass}.${env.eventName}`, owner, tokenId: tokenId.toString(), expiry: expiry.toString() }, null, 2));
}

async function transferCheck(passId: string, recipient: string) {
  const pass = passLabel(passId);
  const registry = getEventRegistry();
  if (!isAddress(recipient)) throw new Error("Recipient must be an Ethereum address");
  const id = BigInt(keccak256(stringToHex(pass)));
  const [owner, tokenId] = await Promise.all([
    publicClient.readContract({ address: registry, abi: registryAbi, functionName: "getOwner", args: [id] }),
    publicClient.readContract({ address: registry, abi: registryAbi, functionName: "getTokenId", args: [id] }),
  ]);
  if (owner === zeroAddress) throw new Error("Pass is missing or expired");
  if (getAddress(recipient).toLowerCase() === owner.toLowerCase()) {
    throw new Error("Recipient must differ from the current owner");
  }
  try {
    await publicClient.simulateContract({
      account: owner,
      address: registry,
      abi: registryAbi,
      functionName: "safeTransferFrom",
      args: [owner, getAddress(recipient), tokenId, 1n, "0x"],
    });
    throw new Error("Transfer simulation succeeded; this pass is transferable");
  } catch (error) {
    const data = (error as { data?: Hex; cause?: { data?: Hex } }).data ?? (error as { cause?: { data?: Hex } }).cause?.data;
    if (!data) throw error;
    try {
      const decoded = decodeErrorResult({ abi: registryAbi, data });
      if (
        decoded.errorName !== "TransferDisallowed" ||
        decoded.args[0] !== tokenId ||
        decoded.args[1].toLowerCase() !== owner.toLowerCase()
      ) throw error;
      console.log(JSON.stringify({ result: "blocked", error: decoded.errorName, tokenId: tokenId.toString(), owner }));
    } catch {
      throw error;
    }
  }
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  switch (command) {
    case "deploy":
      await deploy();
      break;
    case "link":
      await link();
      break;
    case "issue":
      if (args.length !== 3) throw new Error("Usage: issue <passId> <holder-address> <expiry-unix-seconds>");
      await issue(args[0]!, args[1]!, args[2]!);
      break;
    case "inspect":
      if (args.length !== 1) throw new Error("Usage: inspect <passId>");
      await inspect(args[0]!);
      break;
    case "transfer-check":
      if (args.length !== 2) throw new Error("Usage: transfer-check <passId> <recipient-address>");
      await transferCheck(args[0]!, args[1]!);
      break;
    default:
      throw new Error("Commands: deploy | link | issue | inspect | transfer-check");
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "ENS command failed");
  process.exitCode = 1;
});
