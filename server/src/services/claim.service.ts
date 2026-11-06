import type { AccountRegistry } from "../arkiv/accounts.ts";
import type { Store, Ticket } from "../db/store.ts";
import { isWalletOwner, type Signed } from "../utils/signature.ts";

export type Outcome = { status: 200; ticket: Ticket } | { status: 401 | 403 | 404 | 409; error: string };

/** The wallet is the login, so claiming needs a signature and not a new World proof. */
export async function claim(
  store: Store,
  registry: AccountRegistry,
  allowSkip: boolean,
  input: Partial<Signed> & { passId: string },
): Promise<Outcome> {
  if (!(await isWalletOwner(`claim:${input.passId}`, input))) return { status: 401, error: "bad_signature" };
  const wallet = input.wallet!.toLowerCase();
  const ticket = store.ticket(input.passId);
  if (!ticket) return { status: 404, error: "ticket_not_found" };
  if (ticket.holder !== wallet) return { status: 403, error: "not_ticket_holder" };
  if (ticket.status === "claimed") return { status: 409, error: "already_claimed" };

  if (await registry.findByWallet(wallet)) {
    if (store.hasClaimed(wallet)) return { status: 409, error: "human_already_claimed" };
    store.setStatus(ticket.passId, "claimed");
  } else if (allowSkip) {
    store.setStatus(ticket.passId, "skipped"); // Demo only: a guest who skipped World ID.
  } else {
    return { status: 403, error: "no_account" };
  }
  return { status: 200, ticket: store.ticket(ticket.passId)! };
}
