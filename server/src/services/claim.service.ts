import { randomUUID } from "node:crypto";
import type { AccountRegistry } from "../arkiv/accounts.ts";
import type { Ticket, TicketStore } from "../arkiv/tickets.ts";
import { isWalletOwner, type Signed } from "../utils/signature.ts";

export type Outcome = { status: 200; ticket: Ticket } | { status: 401 | 403 | 404 | 409; error: string };

/** Wallet signatures authenticate ticket actions; Arkiv stores the ticket and claim. */
export async function claim(
  tickets: TicketStore,
  registry: AccountRegistry,
  allowSkip: boolean,
  input: Partial<Signed> & { passId: string },
): Promise<Outcome> {
  if (!(await isWalletOwner(`claim:${input.passId}`, input))) return { status: 401, error: "bad_signature" };
  const wallet = input.wallet!.toLowerCase();
  const ticket = await tickets.ticket(input.passId);
  if (!ticket) return { status: 404, error: "ticket_not_found" };
  if (ticket.holder !== wallet) return { status: 403, error: "not_ticket_holder" };
  if (ticket.status !== "issued" && ticket.status !== "skipped") return { status: 409, error: "already_claimed" };

  const account = await registry.findByWallet(wallet);
  if (account) {
    if (await tickets.hasClaimed(account.userId, ticket.eventId)) return { status: 409, error: "human_already_claimed" };
    try {
      const claimed = await tickets.commitClaim(ticket.passId, randomUUID(), wallet, account.userId);
      return { status: 200, ticket: claimed };
    } catch (error) {
      if (error instanceof Error && error.message === "Human already claimed") return { status: 409, error: "human_already_claimed" };
      if (error instanceof Error && error.message === "Ticket is not eligible for claim") return { status: 409, error: "already_claimed" };
      throw error;
    }
  }
  if (!allowSkip) return { status: 403, error: "no_account" };
  if (ticket.status === "skipped") return { status: 200, ticket };
  const skipped = await tickets.setStatus(ticket.passId, "skipped");
  return { status: 200, ticket: skipped };
}
