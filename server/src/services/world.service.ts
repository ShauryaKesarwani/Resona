import { signRequest } from "@worldcoin/idkit-core/signing";
import type { WorldEnv } from "../config/env.ts";

export type VerifyResult = { ok: boolean; body: any };
export type Verifier = (rpId: string, idkitResponse: unknown) => Promise<VerifyResult>;

export const portalVerifier: Verifier = async (rpId, idkitResponse) => {
  const res = await fetch(`https://developer.world.org/api/v4/verify/${rpId}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(idkitResponse),
  });
  return { ok: res.ok, body: await res.json().catch(() => null) };
};

/** A session proof is signed without an action. A first sign-in is signed with one. */
export function signWorldRequest(world: WorldEnv, forSession = false) {
  const { sig, nonce, createdAt, expiresAt } = signRequest({ signingKeyHex: world.signingKey, action: forSession ? undefined : world.action });
  return { rp_id: world.rpId, nonce, created_at: createdAt, expires_at: expiresAt, signature: sig };
}
