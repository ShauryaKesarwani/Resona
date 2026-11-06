import { randomUUID } from "node:crypto";
import { createPublicClient, createWalletClient, ExpirationTime } from "@arkiv-network/sdk";
import { rabdi } from "@arkiv-network/sdk/chains";
import { asc, eq, gt } from "@arkiv-network/sdk/query";
import { addr, defineSchema, key, str } from "@arkiv-network/sdk/schema";
import { getAddress, http, isAddress, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { TicketStatus } from "../db/store.ts";

export const TicketSchema = defineSchema("resona.ticket", {
  passId: str().indexed(),
  eventId: str().indexed(),
  holder: addr().indexed(),
  tier: str().indexed(),
  status: str().indexed(),
  ensName: str().optional(),
  ensNode: str().optional(),
  ensRegistry: addr().optional(),
  ensChainId: str().optional(),
});
export const ClaimSchema = defineSchema("resona.claim", {
  operationId: str().indexed(),
  eventId: str().indexed(),
  passId: str().indexed(),
  holder: addr().indexed(),
});

function ticketStatus(status: string): TicketStatus {
  if (status === "issued" || status === "claimed" || status === "skipped" || status === "checked_in" || status === "revoked") return status;
  throw new Error("Unsupported ticket status");
}

// Ticket lifetime is an explicit configuration: expired entities disappear from queries.
export function createArkivTickets(privateKey: Hex, accessKey: string, eventId: string, lifetimeDays: number) {
  if (!eventId.trim()) throw new Error("eventId is required");
  if (!Number.isInteger(lifetimeDays) || lifetimeDays < 1 || lifetimeDays > 180) {
    throw new Error("lifetimeDays must be an integer between 1 and 180");
  }
  const account = privateKeyToAccount(privateKey);
  const chain = rabdi({ accessKey });
  const reader = createPublicClient({ chain, transport: http() });
  const writer = createWalletClient({ chain, transport: http(), account });

  async function ticket(passId: string) {
    const { entities } = await reader.select({ $key: true, passId: true, holder: true, tier: true, status: true, ensName: true, ensNode: true, ensRegistry: true, ensChainId: true })
      .from(TicketSchema, { onMismatch: "throw" }).ownedBy(account.address)
      .where(eq("eventId", eventId)).where(eq("passId", passId)).fetch();
    if (entities.length > 1) throw new Error("Duplicate ticket IDs on Arkiv");
    const row = entities[0];
    if (!row) return undefined;
    return { passId: row.passId.value, holder: row.holder.value.toLowerCase(), tier: row.tier.value,
      status: ticketStatus(row.status.value), entityKey: row.$key, ensName: row.ensName?.value,
      ensNode: row.ensNode?.value, ensRegistry: row.ensRegistry?.value, ensChainId: row.ensChainId?.value };
  }

  return {
    organizer: account.address,
    async issue(holder: string, tier: string) {
      if (!isAddress(holder) || !tier.trim()) throw new Error("A valid holder address and tier are required");
      const ticket = { passId: randomUUID(), eventId, holder: getAddress(holder), tier: tier.trim(), status: "issued" };
      const result = await writer.createEntity(TicketSchema, { ...ticket, holder: addr(ticket.holder) }, {
        expiration: ExpirationTime.fromDays(lifetimeDays),
      });
      return { ...ticket, holder: ticket.holder.toLowerCase(), status: "issued" as const, entityKey: result.entityKey, transactionHash: result.txHash };
    },
    ticket,
    async commitClaim(passId: string, operationId: string, holder: string) {
      const existing = await ticket(passId);
      if (!existing || existing.holder !== holder.toLowerCase() || !["issued", "skipped"].includes(existing.status)) {
        throw new Error("Ticket is not eligible for claim");
      }
      await writer.executeBatch({
        creates: [{ schema: ClaimSchema, values: { operationId, eventId, passId, holder: addr(getAddress(holder)) }, expiration: ExpirationTime.fromDays(lifetimeDays), flags: { readonly: true } }],
        patches: [{ schema: TicketSchema, entityKey: existing.entityKey, set: { status: "claimed" } }],
      });
    },
    async setStatus(passId: string, status: TicketStatus) {
      const existing = await ticket(passId);
      if (!existing) throw new Error("Ticket not found");
      await writer.patchEntity(TicketSchema, existing.entityKey, { set: { status } });
    },
    async ticketsOf(holder: string) {
      if (!isAddress(holder)) throw new Error("A valid holder address is required");
      const tickets: Array<{ passId: string; eventId: string; holder: string; tier: string; status: TicketStatus; entityKey: Hex; ensName?: string; ensNode?: string; ensRegistry?: string; ensChainId?: string }> = [];
      let lastKey: Hex | undefined;
      do {
        const query = reader.select({ $key: true, passId: true, eventId: true, holder: true, tier: true, status: true, ensName: true, ensNode: true, ensRegistry: true, ensChainId: true })
          .from(TicketSchema, { onMismatch: "throw" }).ownedBy(account.address)
          .where(eq("eventId", eventId)).where(eq("holder", addr(getAddress(holder))))
          .orderBy(asc("$key")).limit(100);
        const { entities } = await (lastKey ? query.where(gt("$key", key(lastKey))) : query).fetch();
        tickets.push(...entities.map((row) => {
          return { entityKey: row.$key, passId: row.passId.value, eventId: row.eventId.value,
            holder: row.holder.value.toLowerCase(), tier: row.tier.value, status: ticketStatus(row.status.value),
            ensName: row.ensName?.value, ensNode: row.ensNode?.value, ensRegistry: row.ensRegistry?.value, ensChainId: row.ensChainId?.value };
        }));
        lastKey = entities.length === 100 ? entities.at(-1)?.$key : undefined;
      } while (lastKey);
      return tickets;
    },
  };
}
