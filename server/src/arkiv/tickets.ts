import { createHash, randomUUID } from "node:crypto";
import { createPublicClient, createWalletClient, ExpirationTime } from "@arkiv-network/sdk";
import { rabdi } from "@arkiv-network/sdk/chains";
import { asc, eq, gt } from "@arkiv-network/sdk/query";
import { addr, defineSchema, key, str } from "@arkiv-network/sdk/schema";
import { getAddress, http, isAddress, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { createQueue } from "../utils/queue.ts";

export type TicketStatus = "issued" | "claimed" | "skipped" | "checked_in" | "revoked";
export type Ticket = {
  passId: string; eventId: string; holder: string; tier: string; status: TicketStatus;
  entityKey: Hex; ensName?: string; ensNode?: string; ensRegistry?: string; ensChainId?: string;
};
export type IssuedTicket = Ticket & { transactionHash: Hex };
export type TicketStore = {
  ready: boolean;
  issue(holder: string, tier: string): Promise<IssuedTicket>;
  ticket(passId: string): Promise<Ticket | undefined>;
  ticketsOf(holder: string): Promise<Ticket[]>;
  hasClaimed(userId: string): Promise<boolean>;
  setStatus(passId: string, status: TicketStatus): Promise<Ticket>;
  commitClaim(passId: string, operationId: string, holder: string, userId: string): Promise<Ticket>;
};

export const unconfiguredTickets: TicketStore = {
  ready: false,
  issue: async () => { throw new Error("Arkiv is not configured"); },
  ticket: async () => undefined,
  ticketsOf: async () => [],
  hasClaimed: async () => false,
  setStatus: async () => { throw new Error("Arkiv is not configured"); },
  commitClaim: async () => { throw new Error("Arkiv is not configured"); },
};

export const TicketSchema = defineSchema("resona.ticket", {
  passId: str().indexed(), eventId: str().indexed(), holder: addr().indexed(),
  tier: str().indexed(), status: str().indexed(), ensName: str().optional(),
  ensNode: str().optional(), ensRegistry: addr().optional(), ensChainId: str().optional(),
});
export const ClaimSchema = defineSchema("resona.claim", {
  operationId: str().indexed(), eventId: str().indexed(), passId: str().indexed(),
  holder: addr().indexed(), userId: str().indexed(),
});

function ticketStatus(status: string): TicketStatus {
  if (["issued", "claimed", "skipped", "checked_in", "revoked"].includes(status)) return status as TicketStatus;
  throw new Error("Unsupported ticket status");
}
export function createArkivTickets(privateKey: Hex, accessKey: string, eventId: string, lifetimeDays: number) {
  if (!eventId.trim()) throw new Error("eventId is required");
  if (!Number.isInteger(lifetimeDays) || lifetimeDays < 1 || lifetimeDays > 180) {
    throw new Error("lifetimeDays must be an integer between 1 and 180");
  }
  const account = privateKeyToAccount(privateKey);
  const eventHash = createHash("sha256").update(eventId).digest("hex");
  const chain = rabdi({ accessKey });
  const reader = createPublicClient({ chain, transport: http() });
  const writer = createWalletClient({ chain, transport: http(), account });
  const runClaim = createQueue();
  const claimedUserIds = new Set<string>();

  async function ticket(passId: string): Promise<Ticket | undefined> {
    const { entities } = await reader.select({ $key: true, passId: true, eventId: true, holder: true, tier: true, status: true, ensName: true, ensNode: true, ensRegistry: true, ensChainId: true })
      .from(TicketSchema, { onMismatch: "throw" }).ownedBy(account.address)
      .where(eq("eventId", eventHash)).where(eq("passId", passId)).fetch();
    if (entities.length > 1) throw new Error("Duplicate ticket IDs on Arkiv");
    const row = entities[0];
    if (!row) return undefined;
    return { passId: row.passId.value, eventId: row.eventId.value, holder: row.holder.value.toLowerCase(), tier: row.tier.value,
      status: ticketStatus(row.status.value), entityKey: row.$key, ensName: row.ensName?.value,
      ensNode: row.ensNode?.value, ensRegistry: row.ensRegistry?.value, ensChainId: row.ensChainId?.value };
  }

  async function hasClaimed(userId: string): Promise<boolean> {
    if (claimedUserIds.has(userId)) return true;
    const { entities } = await reader.select({ operationId: true }).from(ClaimSchema, { onMismatch: "throw" }).ownedBy(account.address)
      .where(eq("eventId", eventHash)).where(eq("userId", userId)).limit(1).fetch();
    if (entities.length > 0) claimedUserIds.add(userId);
    return entities.length > 0;
  }

  return {
    ready: true as const,
    organizer: account.address,
    issue: async (holder: string, tier: string) => {
      if (!isAddress(holder) || typeof tier !== "string" || !tier.trim()) throw new Error("A valid holder address and tier are required");
      const values = { passId: randomUUID(), eventId: eventHash, holder: getAddress(holder), tier: tier.trim(), status: "issued" };
      const result = await writer.createEntity(TicketSchema, { ...values, holder: addr(values.holder) }, { expiration: ExpirationTime.fromDays(lifetimeDays) });
      return { ...values, holder: values.holder.toLowerCase(), status: "issued" as const, entityKey: result.entityKey, transactionHash: result.txHash };
    },
    ticket,
    ticketsOf: async (holder: string): Promise<Ticket[]> => {
      if (!isAddress(holder)) throw new Error("A valid holder address is required");
      const tickets: Ticket[] = [];
      let lastKey: Hex | undefined;
      do {
        const query = reader.select({ $key: true, passId: true, eventId: true, holder: true, tier: true, status: true, ensName: true, ensNode: true, ensRegistry: true, ensChainId: true })
          .from(TicketSchema, { onMismatch: "throw" }).ownedBy(account.address)
          .where(eq("eventId", eventHash)).where(eq("holder", addr(getAddress(holder))))
          .orderBy(asc("$key")).limit(100);
        const { entities } = await (lastKey ? query.where(gt("$key", key(lastKey))) : query).fetch();
        tickets.push(...entities.map((row) => ({ entityKey: row.$key, passId: row.passId.value, eventId: row.eventId.value,
          holder: row.holder.value.toLowerCase(), tier: row.tier.value, status: ticketStatus(row.status.value),
          ensName: row.ensName?.value, ensNode: row.ensNode?.value, ensRegistry: row.ensRegistry?.value, ensChainId: row.ensChainId?.value })));
        lastKey = entities.length === 100 ? entities.at(-1)?.$key : undefined;
      } while (lastKey);
      return tickets;
    },
    hasClaimed,
    setStatus: async (passId: string, status: TicketStatus) => {
      const existing = await ticket(passId);
      if (!existing) throw new Error("Ticket not found");
      await writer.patchEntity(TicketSchema, existing.entityKey, { set: { status } });
      return { ...existing, status };
    },
    commitClaim: (passId: string, operationId: string, holder: string, userId: string) => runClaim(async () => {
      const existing = await ticket(passId);
      if (!existing || existing.holder !== holder.toLowerCase() || !["issued", "skipped"].includes(existing.status)) {
        throw new Error("Ticket is not eligible for claim");
      }
      if (await hasClaimed(userId)) throw new Error("Human already claimed");
      await writer.executeBatch({
        creates: [{ schema: ClaimSchema, values: { operationId, eventId: eventHash, passId, holder: addr(getAddress(holder)), userId }, expiration: ExpirationTime.fromDays(lifetimeDays), flags: { readonly: true } }],
        patches: [{ schema: TicketSchema, entityKey: existing.entityKey, set: { status: "claimed" } }],
      });
      claimedUserIds.add(userId);
      return { ...existing, status: "claimed" as const };
    }),
  };
}
