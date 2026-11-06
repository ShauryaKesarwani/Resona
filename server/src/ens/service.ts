import {
  createPublicClient, decodeErrorResult, getAddress, http, isAddress, keccak256,
  parseAbi, stringToHex, zeroAddress, type Address, type Hex,
} from "viem";
import { sepolia } from "viem/chains";
import { passLabel } from "./labels.ts";

const registryAbi = parseAbi([
  "function getSubregistry(uint256 anyId) view returns (address)",
  "function getOwner(uint256 anyId) view returns (address)",
  "function getTokenId(uint256 anyId) view returns (uint256)",
  "function getExpiry(uint256 anyId) view returns (uint64)",
  "function safeTransferFrom(address from, address to, uint256 tokenId, uint256 amount, bytes data)",
  "error TransferDisallowed(uint256 tokenId, address owner)",
]);

export type EnsSettings = {
  enabled: boolean;
  rpcUrl?: string;
  eventName?: string;
  parentRegistry?: string;
  eventRegistry?: string;
};

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

  return { configured, pass, transferCheck };
}

export type EnsService = ReturnType<typeof createEnsService>;
