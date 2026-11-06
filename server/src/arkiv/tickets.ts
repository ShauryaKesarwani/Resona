import { createHash, randomUUID } from "node:crypto";
import { createPublicClient, createWalletClient, ExpirationTime } from "@arkiv-network/sdk";
import { rabdi } from "@arkiv-network/sdk/chains";
import { asc, eq, gt } from "@arkiv-network/sdk/query";
import { addr, defineSchema, key, str } from "@arkiv-network/sdk/schema";
import { getAddress, http, isAddress, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { createQueue } from "../utils/queue.ts";
import { EventSchema } from "./records.ts";
import { gasFor, journal, organizerWrites } from "./writes.ts";

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
  hasClaimed(userId: string, eventId: string): Promise<boolean>;
  setStatus(passId: string, status: TicketStatus): Promise<Ticket>;
  commitClaim(passId: string, operationId: string, holder: string, userId: string): Promise<Ticket>;
  /** Tops a wallet up to a fixed amount of test tokens. A funded wallet gets nothing more. */
  fund(wallet: string): Promise<void>;
};

const notConfigured = async () => { throw new Error("Arkiv is not configured"); };
export const unconfiguredTickets: TicketStore = {
  ready: false,
  issue: notConfigured,
  ticket: async () => undefined,
  ticketsOf: async () => [],
  hasClaimed: async () => false,
  setStatus: notConfigured,
  commitClaim: notConfigured,
  fund: notConfigured,
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

const TICKET_FIELDS = { $key: true, passId: true, eventId: true, holder: true, tier: true, status: true, ensName: true, ensNode: true, ensRegistry: true, ensChainId: true } as const;
const PAGE = 100;
const FUND_WEI = 50_000_000_000_000_000n; // 0.05 tGLM: a demo ticket plus gas.

export const eventHash = (eventId: string) => createHash("sha256").update(eventId).digest("hex");

function ticketStatus(status: string): TicketStatus {
  if (["issued", "claimed", "skipped", "checked_in", "revoked"].includes(status)) return status as TicketStatus;
  throw new Error("Unsupported ticket status");
}

/** Records use the longest lifetime Arkiv allows, so past tickets stay visible to their owner. */
const keep = { expiration: ExpirationTime.max() };

export function createArkivTickets(privateKey: Hex, accessKey: string, defaultEventId: string) {
  if (!defaultEventId.trim()) throw new Error("eventId is required");
  const account = privateKeyToAccount(privateKey);
  const defaultEvent = eventHash(defaultEventId);
  const chain = rabdi({ accessKey });
  const transport = http(undefined, { timeout: 15_000, retryCount: 0 });
  const reader = createPublicClient({ chain, transport, cacheTime: 0 });
  const writer = createWalletClient({ chain, transport, account });
  const exclusive = createQueue();
  const claimed = new Set<string>();

  /** One write at a time, with a fresh nonce and explicit gas. An error here is never retried automatically. */
  const write = <T extends { txHash: Hex }>(label: string, operations: number, send: (tx: { nonce: number; gas: bigint; gasPrice: bigint }) => Promise<T>) =>
    organizerWrites(async () => {
      const nonce = await reader.getTransactionCount({ address: account.address, blockTag: "latest" });
      const gasPrice = BigInt(await reader.request({ method: "eth_gasPrice" } as never) as string);
      await journal(`intent ${label} nonce=${nonce}`);
      const result = await send({ nonce, gas: gasFor(operations), gasPrice });
      await journal(`done ${label} ${result.txHash}`);
      return result;
    });

  const toTicket = (row: any): Ticket => ({
    passId: row.passId.value, eventId: row.eventId.value, holder: row.holder.value.toLowerCase(), tier: row.tier.value,
    status: ticketStatus(row.status.value), entityKey: row.$key, ensName: row.ensName?.value,
    ensNode: row.ensNode?.value, ensRegistry: row.ensRegistry?.value, ensChainId: row.ensChainId?.value,
  });

  async function ticket(passId: string): Promise<Ticket | undefined> {
    const { entities } = await reader.select(TICKET_FIELDS)
      .from(TicketSchema, { onMismatch: "throw" }).ownedBy(account.address)
      .where(eq("passId", passId)).fetch();
    if (entities.length > 1) throw new Error("Duplicate ticket IDs on Arkiv");
    return entities[0] ? toTicket(entities[0]) : undefined;
  }

  async function hasClaimed(userId: string, eventId: string): Promise<boolean> {
    const id = `${eventId}:${userId}`;
    if (claimed.has(id)) return true;
    const { entities } = await reader.select({ operationId: true }).from(ClaimSchema, { onMismatch: "throw" }).createdBy(account.address)
      .where(eq("eventId", eventId)).where(eq("userId", userId)).limit(1).fetch();
    if (entities.length > 0) claimed.add(id);
    return entities.length > 0;
  }

  return {
    ready: true as const,
    organizer: account.address,
    issue: async (holder: string, tier: string) => {
      if (!isAddress(holder) || typeof tier !== "string" || !tier.trim()) throw new Error("A valid holder address and tier are required");
      const values = { passId: randomUUID(), eventId: defaultEvent, holder: getAddress(holder), tier: tier.trim(), status: "issued" };
      const result = await write(`issue ${values.passId}`, 1, (tx) => writer.createEntity(TicketSchema, { ...values, holder: addr(values.holder) }, keep, tx));
      return { ...values, holder: values.holder.toLowerCase(), status: "issued" as const, entityKey: result.entityKey, transactionHash: result.txHash };
    },
    ticket,
    ticketsOf: async (holder: string): Promise<Ticket[]> => {
      if (!isAddress(holder)) throw new Error("A valid holder address is required");
      const tickets: Ticket[] = [];
      let lastKey: Hex | undefined;
      do {
        const query = reader.select(TICKET_FIELDS)
          .from(TicketSchema, { onMismatch: "throw" }).ownedBy(account.address)
          .where(eq("holder", addr(getAddress(holder))))
          .orderBy(asc("$key")).limit(PAGE);
        const { entities } = await (lastKey ? query.where(gt("$key", key(lastKey))) : query).fetch();
        tickets.push(...entities.map(toTicket));
        lastKey = entities.length === PAGE ? entities.at(-1)?.$key : undefined;
      } while (lastKey);
      return tickets;
    },
    hasClaimed,
    setStatus: async (passId: string, status: TicketStatus) => {
      const existing = await ticket(passId);
      if (!existing) throw new Error("Ticket not found");
      await write(`status ${passId}`, 1, (tx) => writer.patchEntity(TicketSchema, existing.entityKey, { set: { status } }, tx));
      return { ...existing, status };
    },
    commitClaim: (passId: string, operationId: string, holder: string, userId: string) => exclusive(async () => {
      const existing = await ticket(passId);
      if (!existing || existing.holder !== holder.toLowerCase() || !["issued", "skipped"].includes(existing.status)) {
        throw new Error("Ticket is not eligible for claim");
      }
      if (await hasClaimed(userId, existing.eventId)) throw new Error("Human already claimed");
      await write(`claim ${passId}`, 2, (tx) => writer.executeBatch({
        creates: [{ schema: ClaimSchema, values: { operationId, eventId: existing.eventId, passId, holder: addr(getAddress(holder)), userId }, ...keep, flags: { readonly: true } }],
        patches: [{ schema: TicketSchema, entityKey: existing.entityKey, set: { status: "claimed" } }],
      }, tx));
      claimed.add(`${existing.eventId}:${userId}`);
      return { ...existing, status: "claimed" as const };
    }),
    createEvent: async (event: { slug: string; eventName: string; eventDate: string; priceWei: bigint }) => {
      const values = { eventId: eventHash(event.slug), eventName: event.eventName, organiser: addr(account.address), eventDate: event.eventDate, priceWei: event.priceWei.toString() };
      const result = await write(`event ${values.eventId}`, 1, (tx) => writer.createEntity(EventSchema, values, { ...keep, flags: { readonly: true } }, tx));
      return { eventId: values.eventId, entityKey: result.entityKey, transactionHash: result.txHash };
    },
    fund: (wallet: string) => organizerWrites(async () => {
      const balance = await reader.getBalance({ address: wallet as Hex });
      if (balance >= FUND_WEI / 2n) return;
      const nonce = await reader.getTransactionCount({ address: account.address, blockTag: "latest" });
      const gasPrice = BigInt(await reader.request({ method: "eth_gasPrice" } as never) as string);
      await journal(`intent fund ${wallet} nonce=${nonce}`);
      const hash = await writer.sendTransaction({ to: wallet as Hex, value: FUND_WEI - balance, gas: 21_000n, gasPrice, nonce, type: "legacy" });
      await journal(`done fund ${hash}`);
      const receipt = await reader.waitForTransactionReceipt({ hash, timeout: 30_000 });
      if (receipt.status !== "success") throw new Error("Funding reverted");
    }),
  };
}
