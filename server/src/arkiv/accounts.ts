import { appendFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createPublicClient, ExpirationTime } from "@arkiv-network/sdk";
import { rabdi } from "@arkiv-network/sdk/chains";
import { eq } from "@arkiv-network/sdk/query";
import { addr, defineSchema, str } from "@arkiv-network/sdk/schema";
import { http, type Hex } from "viem";
import { privateKeyToAddress } from "viem/accounts";
import { guardedWalletClient, localEnvSigner } from "./signing.mjs";
import { organizerWrites } from "./writes.ts";

export type Account = { wallet: string; nullifierHash: string; userId: string; sessionHash?: string };
export type AccountRegistry = {
  /** False until Arkiv keys are set, so a World proof is never spent on a write that can't happen. */
  ready: boolean;
  findByWallet(wallet: string): Promise<Account | null>;
  findByNullifierHash(nullifierHash: string): Promise<Account | null>;
  isOrganizer(userId: string): Promise<boolean>;
  promoteOrganizer(account: Pick<Account, "wallet" | "userId">, promotedBy: string): Promise<void>;
  create(account: Pick<Account, "wallet" | "nullifierHash" | "sessionHash"> & { userId?: string }): Promise<void>;
};

export const Accounts = defineSchema("resona.account", {
  wallet: addr().indexed(),
  nullifierHash: str().indexed(),
  userId: str().optional().indexed(),
  sessionHash: str().optional(),
});

export const Organizers = defineSchema("resona.organizer", {
  wallet: addr().indexed(),
  userId: str().indexed(),
  promotedBy: addr().indexed(),
  promotedAt: str(),
});

const JOURNAL = "arkiv-writes.log";
const READBACK_ATTEMPTS = 8;
const MAX_RECORDS = 5;
const journal = (hash: string) => appendFile(JOURNAL, `${new Date().toISOString()} ${hash}\n`, { flush: true });
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Without keys nobody has an account yet, and sign-up says it's unavailable. */
export const unconfiguredAccounts: AccountRegistry = {
  ready: false,
  findByWallet: async () => null,
  findByNullifierHash: async () => null,
  isOrganizer: async () => false,
  promoteOrganizer: async () => { throw new Error("Arkiv is not configured"); },
  create: async () => {
    throw new Error("Arkiv is not configured");
  },
};

type ArkivConfig = { privateKey: Hex; accessKey: string; maxCostWei: bigint };

export function arkivAccounts({ privateKey, accessKey, maxCostWei }: ArkivConfig): AccountRegistry {
  const chain = rabdi({ accessKey });
  const publicClient = createPublicClient({
    chain,
    cacheTime: 0,
    transport: http(undefined, { timeout: 8_000, retryCount: 0, fetchOptions: { cache: "no-store" } }),
  });
  const organizer = privateKeyToAddress(privateKey);

  // Only records this server created count: anyone can write an entity with this schema.
  const accounts = () =>
    publicClient.select({ wallet: true, nullifierHash: true, userId: true, sessionHash: true }).from(Accounts).createdBy(organizer).limit(MAX_RECORDS);
  const organizerAccounts = () =>
    publicClient.select({ userId: true }).from(Organizers).createdBy(organizer).limit(100);

  const first = ({ entities }: Awaited<ReturnType<ReturnType<typeof accounts>["fetch"]>>): Account | null => {
    // An older account has a second, read-only record that adds its World session. That record wins.
    const entity = entities.find((row) => row.sessionHash?.value) ?? entities[0];
    return entity ? {
      wallet: String(entity.wallet.value).toLowerCase(),
      nullifierHash: entity.nullifierHash.value,
      userId: entity.userId?.value ?? createHash("sha256").update(entity.nullifierHash.value).digest("hex"),
      sessionHash: entity.sessionHash?.value,
    } : null;
  };

  const findByWallet = async (wallet: string) => first(await accounts().where(eq("wallet", addr(wallet as Hex))).fetch());
  const findByNullifierHash = async (nullifierHash: string) =>
    first(await accounts().where(eq("nullifierHash", nullifierHash)).fetch());
  const isOrganizer = async (userId: string) =>
    (await organizerAccounts().where(eq("userId", userId)).limit(1).fetch()).entities.length > 0;

  return {
    ready: true,
    findByWallet,
    findByNullifierHash,
    isOrganizer,
    async promoteOrganizer(target, promotedBy) {
      if (await isOrganizer(target.userId)) return;
      const signer = localEnvSigner(publicClient, privateKey, journal);
      const client = guardedWalletClient({
        publicClient, signer, accessKey, maxCostWei,
        approve: async () => true,
        onSubmitted: journal,
      });
      await organizerWrites(() => client.createEntity(Organizers, {
        wallet: addr(target.wallet as Hex), userId: target.userId,
        promotedBy: addr(promotedBy as Hex), promotedAt: new Date().toISOString(),
      }, { expiration: ExpirationTime.max(), flags: { readonly: true } }));
      for (let attempt = 0; attempt < READBACK_ATTEMPTS; attempt++) {
        if (await isOrganizer(target.userId)) return;
        await pause(1_000);
      }
      throw new Error("Organizer promotion written but not readable yet");
    },
    async create({ wallet, nullifierHash, sessionHash, userId = createHash("sha256").update(nullifierHash).digest("hex") }) {
      const signer = localEnvSigner(publicClient, privateKey, journal);
      const client = guardedWalletClient({
        publicClient,
        signer,
        accessKey,
        maxCostWei,
        approve: async () => true, // maxCostWei is the approved budget for each sign-up.
        onSubmitted: journal,
      });
      await organizerWrites(() => client.createEntity(
        Accounts,
        { wallet: addr(wallet as Hex), nullifierHash, userId, sessionHash },
        { expiration: ExpirationTime.max(), flags: { readonly: true } },
      ));
      // Wait for indexing, so the next sign-up can't miss this record.
      for (let attempt = 0; attempt < READBACK_ATTEMPTS; attempt++) {
        if (await findByNullifierHash(nullifierHash)) return;
        await pause(1_000);
      }
      throw new Error("Account written but not readable yet");
    },
  };
}
