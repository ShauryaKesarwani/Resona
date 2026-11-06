import { createHmac } from "node:crypto";
import { hashSignal } from "@worldcoin/idkit-core/hashing";
import type { AccountRegistry } from "../arkiv/accounts.ts";
import type { WorldEnv } from "../config/env.ts";
import { createQueue } from "../utils/queue.ts";
import { sameField, toDecimal } from "../utils/field.ts";
import { isWalletOwner, type Signed } from "../utils/signature.ts";
import type { Verifier, VerifyResult } from "./world.service.ts";

export type AuthConfig = Pick<WorldEnv, "rpId" | "action" | "environment"> & { nullifierHashKey: string };
export type AuthOutcome = { status: 200; wallet: string } | { status: 400 | 401 | 403 | 404 | 409 | 502 | 503; error: string };

const REPLAY_CODES = new Set(["nullifier_replayed", "max_verifications_reached"]);
const signups = createQueue();

export const hashNullifier = (key: string, nullifier: string) =>
  createHmac("sha256", key).update(toDecimal(nullifier)).digest("hex");

export const hashSession = (key: string, sessionId: string) =>
  createHmac("sha256", key).update(`session:${sessionId}`).digest("hex");

/** Session proofs already accepted. The wallet signature also stops a replay, so memory is enough here. */
const usedSessionProofs = new Set<string>();

const accepted = (result: VerifyResult, environment: string) =>
  result.ok && result.body?.success === true && result.body?.environment === environment;

/**
 * First sign-in: one World proof shows this is a new human and creates their World session.
 * An account made before sessions existed adds one here, and the wallet signature proves it is theirs.
 */
export async function signup(
  registry: AccountRegistry,
  config: AuthConfig,
  verify: Verifier,
  input: Partial<Signed> & { idkitResponse?: any },
): Promise<AuthOutcome> {
  if (!registry.ready) return { status: 503, error: "arkiv_not_configured" };
  if (!(await isWalletOwner("signup", input))) return { status: 401, error: "bad_signature" };
  const wallet = input.wallet!.toLowerCase();
  const proof = input.idkitResponse;
  const item = proof?.responses?.[0];
  if (proof?.environment !== config.environment) return { status: 400, error: "wrong_environment" };
  if (proof?.action !== config.action) return { status: 400, error: "wrong_action" };
  if (!item?.nullifier || !item?.signal_hash || typeof proof.session_id !== "string") return { status: 400, error: "malformed_proof" };
  if (!sameField(item.signal_hash, hashSignal(wallet))) return { status: 400, error: "wrong_wallet" };

  return signups(async () => {
    const nullifierHash = hashNullifier(config.nullifierHashKey, item.nullifier);
    const existing = await registry.findByNullifierHash(nullifierHash);
    if (existing?.wallet === wallet) return { status: 200, wallet };
    if (existing) return { status: 409, error: "human_has_account" };
    const owner = await registry.findByWallet(wallet);
    if (owner?.sessionHash) return { status: 409, error: "wallet_taken" };

    const result = await verify(config.rpId, proof);
    if (REPLAY_CODES.has(result.body?.code)) return { status: 409, error: "human_has_account" };
    if (!accepted(result, config.environment)) {
      console.error("World verify failed", result.body?.code, result.body?.detail);
      return { status: 400, error: "verification_failed" };
    }

    try {
      await registry.create({
        wallet, nullifierHash, userId: owner?.userId,
        sessionHash: hashSession(config.nullifierHashKey, proof.session_id),
      });
    } catch (error) {
      console.error("Arkiv account write failed:", error instanceof Error ? error.message : "unknown");
      return { status: 502, error: "arkiv_write_failed" };
    }
    return { status: 200, wallet };
  });
}

/** Every later sign-in: a World proof of this account's own session, from the wallet that owns it. */
export async function login(
  registry: AccountRegistry,
  config: AuthConfig,
  verify: Verifier,
  input: Partial<Signed> & { idkitResponse?: any },
): Promise<AuthOutcome> {
  if (!(await isWalletOwner("login", input))) return { status: 401, error: "bad_signature" };
  const wallet = input.wallet!.toLowerCase();
  const account = await registry.findByWallet(wallet);
  if (!account) return { status: 404, error: "no_account" };
  if (!account.sessionHash) return { status: 403, error: "no_session" };

  const proof = input.idkitResponse;
  const item = proof?.responses?.[0];
  const proofId = item?.session_nullifier?.[0];
  if (proof?.environment !== config.environment) return { status: 400, error: "wrong_environment" };
  if (typeof proof?.session_id !== "string" || !proofId || !item?.signal_hash) return { status: 400, error: "malformed_proof" };
  if (hashSession(config.nullifierHashKey, proof.session_id) !== account.sessionHash) return { status: 403, error: "wrong_session" };
  if (!sameField(item.signal_hash, hashSignal(wallet))) return { status: 400, error: "wrong_wallet" };
  if (usedSessionProofs.has(proofId)) return { status: 409, error: "proof_replayed" };

  const result = await verify(config.rpId, proof);
  if (!accepted(result, config.environment)) {
    console.error("World session verify failed", result.body?.code, result.body?.detail);
    return { status: 400, error: "verification_failed" };
  }
  usedSessionProofs.add(proofId);
  return { status: 200, wallet };
}
