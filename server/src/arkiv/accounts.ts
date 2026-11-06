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

export type Account = { wallet: string; nullifierHash: string; userId: string };
export type AccountRegistry = {
  /** False until Arkiv keys are set, so a World proof is never spent on a write that can't happen. */
  ready: boolean;
  findByWallet(wallet: string): Promise<Account | null>;
  findByNullifierHash(nullifierHash: string): Promise<Account | null>;
  create(account: Pick<Account, "wallet" | "nullifierHash">): Promise<void>;
};

export const Accounts = defineSchema("resona.account", {
  wallet: addr().indexed(),
  nullifierHash: str().indexed(),
  userId: str().optional().indexed(),
});

const JOURNAL = "arkiv-writes.log";
const READBACK_ATTEMPTS = 8;
const journal = (hash: string) => appendFile(JOURNAL, `${new Date().toISOString()} ${hash}\n`, { flush: true });
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Without keys nobody has an account yet, and sign-up says it's unavailable. */
export const unconfiguredAccounts: AccountRegistry = {
  ready: false,
  findByWallet: async () => null,
  findByNullifierHash: async () => null,
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
    publicClient.select({ wallet: true, nullifierHash: true, userId: true }).from(Accounts).createdBy(organizer).limit(1);

  const first = ({ entities }: Awaited<ReturnType<ReturnType<typeof accounts>["fetch"]>>): Account | null => {
    const entity = entities[0];
    return entity ? {
      wallet: String(entity.wallet.value).toLowerCase(),
      nullifierHash: entity.nullifierHash.value,
      userId: entity.userId?.value ?? createHash("sha256").update(entity.nullifierHash.value).digest("hex"),
    } : null;
  };

  const findByWallet = async (wallet: string) => first(await accounts().where(eq("wallet", addr(wallet as Hex))).fetch());
  const findByNullifierHash = async (nullifierHash: string) =>
    first(await accounts().where(eq("nullifierHash", nullifierHash)).fetch());

  return {
    ready: true,
    findByWallet,
    findByNullifierHash,
    async create({ wallet, nullifierHash }) {
      const userId = createHash("sha256").update(nullifierHash).digest("hex");
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
        { wallet: addr(wallet as Hex), nullifierHash, userId },
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
