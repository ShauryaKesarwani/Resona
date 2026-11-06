import { hashSignal } from "@worldcoin/idkit-core/hashing";
import type { WorldEnv } from "../config/env.ts";
import type { Store, Ticket } from "../db/store.ts";
import { sameField, toDecimal } from "../utils/field.ts";
import type { Verifier } from "./world.service.ts";

export type ClaimConfig = Pick<WorldEnv, "rpId" | "action" | "environment" | "allowSkip">;
export type Outcome =
  | { status: 200; ticket: Ticket }
  | { status: 400 | 403 | 404 | 409; error: string };

const REPLAY_CODES = new Set(["nullifier_replayed", "max_verifications_reached"]);

function holderTicket(store: Store, passId: string, wallet: string) {
  const ticket = store.ticket(passId);
  if (!ticket) return { status: 404, error: "ticket_not_found" } as const;
  if (ticket.holder !== wallet.toLowerCase()) return { status: 403, error: "not_ticket_holder" } as const;
  if (ticket.status === "claimed") return { status: 409, error: "already_claimed" } as const;
  return ticket;
}

export async function claim(
  store: Store,
  config: ClaimConfig,
  verify: Verifier,
  input: { passId: string; wallet: string; idkitResponse: any },
): Promise<Outcome> {
  const ticket = holderTicket(store, input.passId, input.wallet);
  if ("error" in ticket) return ticket;

  const proof = input.idkitResponse;
  const item = proof?.responses?.[0];
  if (proof?.environment !== config.environment) return { status: 400, error: "wrong_environment" };
  if (proof?.action !== config.action) return { status: 400, error: "wrong_action" };
  if (!item?.nullifier || !item?.signal_hash) return { status: 400, error: "malformed_proof" };
  if (!sameField(item.signal_hash, hashSignal(input.wallet.toLowerCase()))) {
    return { status: 400, error: "wrong_wallet" };
  }

  const result = await verify(config.rpId, proof);
  if (REPLAY_CODES.has(result.body?.code)) return { status: 409, error: "human_already_claimed" };
  if (!result.ok || result.body?.success !== true || result.body?.environment !== config.environment) {
    console.error("World verify failed", result.body?.code, result.body?.detail);
    return { status: 400, error: "verification_failed" };
  }

  if (!store.useNullifier(toDecimal(item.nullifier), config.action)) {
    return { status: 409, error: "human_already_claimed" };
  }
  store.setStatus(ticket.passId, "claimed");
  return { status: 200, ticket: store.ticket(ticket.passId)! };
}

/** Demo only. A skipped ticket can still be verified later. */
export function skip(store: Store, config: ClaimConfig, input: { passId: string; wallet: string }): Outcome {
  if (!config.allowSkip) return { status: 403, error: "skip_disabled" };
  const ticket = holderTicket(store, input.passId, input.wallet);
  if ("error" in ticket) return ticket;
  store.setStatus(ticket.passId, "skipped");
  return { status: 200, ticket: store.ticket(ticket.passId)! };
}
