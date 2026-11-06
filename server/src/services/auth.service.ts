import { createHmac } from "node:crypto";
import { hashSignal } from "@worldcoin/idkit-core/hashing";
import { isAddress } from "viem";
import type { AccountRegistry } from "../arkiv/accounts.ts";
import type { WorldEnv } from "../config/env.ts";
import { createQueue } from "../utils/queue.ts";
import { sameField, toDecimal } from "../utils/field.ts";
import { isWalletOwner, type Signed } from "../utils/signature.ts";
import type { Verifier } from "./world.service.ts";

export type AuthConfig = Pick<WorldEnv, "rpId" | "action" | "environment"> & { nullifierHashKey: string };
export type AuthOutcome = { status: 200; wallet: string } | { status: 400 | 401 | 404 | 409 | 502 | 503; error: string };

const REPLAY_CODES = new Set(["nullifier_replayed", "max_verifications_reached"]);
const signups = createQueue();

export const hashNullifier = (key: string, nullifier: string) =>
  createHmac("sha256", key).update(toDecimal(nullifier)).digest("hex");

/** One World ID, one wallet: the first wallet a person signs up with is theirs. */
export async function signup(
  registry: AccountRegistry,
  config: AuthConfig,
  verify: Verifier,
  input: { wallet: string; idkitResponse: any },
): Promise<AuthOutcome> {
  if (!registry.ready) return { status: 503, error: "arkiv_not_configured" };
  if (typeof input.wallet !== "string" || !isAddress(input.wallet, { strict: false })) {
    return { status: 400, error: "invalid_wallet" };
  }
  const wallet = input.wallet.toLowerCase();
  const proof = input.idkitResponse;
  const item = proof?.responses?.[0];
  if (proof?.environment !== config.environment) return { status: 400, error: "wrong_environment" };
  if (proof?.action !== config.action) return { status: 400, error: "wrong_action" };
  if (!item?.nullifier || !item?.signal_hash) return { status: 400, error: "malformed_proof" };
  if (!sameField(item.signal_hash, hashSignal(wallet))) return { status: 400, error: "wrong_wallet" };

  return signups(async () => {
    const nullifierHash = hashNullifier(config.nullifierHashKey, item.nullifier);
    const existing = await registry.findByNullifierHash(nullifierHash);
    if (existing?.wallet === wallet) return { status: 200, wallet };
    if (existing) return { status: 409, error: "human_has_account" };
    if (await registry.findByWallet(wallet)) return { status: 409, error: "wallet_taken" };

    const result = await verify(config.rpId, proof);
    if (REPLAY_CODES.has(result.body?.code)) return { status: 409, error: "human_has_account" };
    if (!result.ok || result.body?.success !== true || result.body?.environment !== config.environment) {
      console.error("World verify failed", result.body?.code, result.body?.detail);
      return { status: 400, error: "verification_failed" };
    }

    try {
      await registry.create({ wallet, nullifierHash });
    } catch (error) {
      console.error("Arkiv account write failed:", error instanceof Error ? error.message : "unknown");
      return { status: 502, error: "arkiv_write_failed" };
    }
    return { status: 200, wallet };
  });
}

/** Returning user: a signature proves the wallet, and Arkiv proves it has an account. */
export async function session(registry: AccountRegistry, input: Partial<Signed>): Promise<AuthOutcome> {
  if (!(await isWalletOwner("login", input))) return { status: 401, error: "bad_signature" };
  const wallet = input.wallet!.toLowerCase();
  if (!(await registry.findByWallet(wallet))) return { status: 404, error: "no_account" };
  return { status: 200, wallet };
}
