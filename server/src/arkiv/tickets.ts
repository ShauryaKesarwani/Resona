import { createHash, randomUUID } from "node:crypto";
import { createPublicClient, createWalletClient, ExpirationTime } from "@arkiv-network/sdk";
import { rabdi } from "@arkiv-network/sdk/chains";
import { asc, eq, gt } from "@arkiv-network/sdk/query";
import { addr, defineSchema, key, str } from "@arkiv-network/sdk/schema";
import { getAddress, http, isAddress, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { createQueue } from "../utils/queue.ts";
import { CheckinSchema, EventSchema, PaymentSchema } from "./records.ts";
import { gasFor, journal, organizerWrites } from "./writes.ts";

export type TicketStatus = "issued" | "claimed" | "skipped" | "checked_in" | "revoked";
export type Ticket = {
  passId: string; eventId: string; holder: string; tier: string; status: TicketStatus;
  entityKey: Hex; ensName?: string; ensNode?: string; ensRegistry?: string; ensChainId?: string;
};
export type IssuedTicket = Ticket & { transactionHash: Hex };
export type TransferStatus = "pending" | "processing" | "approved" | "declined" | "cancelled" | "expired" | "needs_review";
export type TransferRequest = {
  requestId: string; eventId: string; passId: string; fromHolder: string; toHolder: string;
  status: TransferStatus; requestedAt: string; expiresAt: string; unregisterTxHash?: string; registerTxHash?: string;
};
export type TicketStore = {
  ready: boolean;
  issue(holder: string, tier: string, eventId?: string): Promise<IssuedTicket>;
  canManageEvent(eventId: string, organizer: string): Promise<boolean>;
  ticket(passId: string): Promise<Ticket | undefined>;
  ticketsOf(holder: string): Promise<Ticket[]>;
  hasClaimed(userId: string, eventId: string): Promise<boolean>;
  setStatus(passId: string, status: TicketStatus): Promise<Ticket>;
  transfer(passId: string): Promise<TransferRequest | undefined>;
  requestTransfer(passId: string, fromHolder: string, toHolder: string, requestId: string, now: string, expiresAt: string): Promise<TransferRequest>;
  cancelTransfer(passId: string, fromHolder: string): Promise<void>;
  declineTransfer(passId: string, requestId: string): Promise<void>;
  transfersForEvent(eventId: string): Promise<TransferRequest[]>;
  beginTransfer(passId: string, requestId: string): Promise<TransferRequest>;
  finishTransfer(passId: string, requestId: string, unregisterTxHash: string, registerTxHash: string): Promise<void>;
  reviewTransfer(passId: string, requestId: string): Promise<void>;
  commitClaim(passId: string, operationId: string, holder: string, userId: string): Promise<Ticket>;
  /** Tops a wallet up to a fixed amount of test tokens. A funded wallet gets nothing more. */
  fund(wallet: string): Promise<void>;
  /** Publishes an event the organizer can sell tickets for. */
  createEvent(event: { slug: string; eventName: string; eventDate: string; priceWei: bigint; organizer: string }): Promise<{ eventId: string; entityKey: Hex; transactionHash: Hex }>;
};

const notConfigured = async () => { throw new Error("Arkiv is not configured"); };
export type DoorTicket = Ticket & { bought: boolean };
export type Admission = { ordinal: number; transactionHash: Hex; entityKey: Hex };
export type AdmissionEligibility = { ticket: DoorTicket; userId?: string; verificationLevel: "world_linked" | "not_verified" };
export type CheckinStore = Pick<TicketStore, "hasClaimed"> & {
  /** The ticket for this holder, whether the organizer issued it or the holder's own wallet bought it. */
  doorTicket(passId: string, holder: string): Promise<DoorTicket | undefined>;
  /** A bought ticket is written by its buyer, so it only counts if the payment is really on chain. */
  paymentIsValid(ticket: DoorTicket): Promise<boolean>;
  eventEnded(eventId: string): Promise<boolean>;
  hasCheckedIn(eventId: string, holder: string): Promise<boolean>;
  hasPendingTransfer(passId: string): Promise<boolean>;
  /** Revalidate inside the serialized write, not before waiting for its queue. */
  commitCheckin(ticket: DoorTicket, distanceCm: number, revalidate: () => Promise<AdmissionEligibility>): Promise<Admission>;
};

export const unconfiguredTickets: TicketStore & CheckinStore = {
  ready: false,
  issue: notConfigured,
  canManageEvent: async () => false,
  ticket: async () => undefined,
  ticketsOf: async () => [],
  hasClaimed: async () => false,
  setStatus: notConfigured,
  transfer: async () => undefined,
  requestTransfer: notConfigured,
  cancelTransfer: notConfigured,
  declineTransfer: notConfigured,
  transfersForEvent: async () => [],
  beginTransfer: notConfigured,
  finishTransfer: notConfigured,
  reviewTransfer: notConfigured,
  commitClaim: notConfigured,
  fund: notConfigured,
  createEvent: notConfigured,
  doorTicket: async () => undefined,
  paymentIsValid: async () => false,
  eventEnded: async () => false,
  hasCheckedIn: async () => false,
  hasPendingTransfer: async () => false,
  commitCheckin: notConfigured,
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
export const TransferSchema = defineSchema("resona.transfer", {
  requestId: str().indexed(), eventId: str().indexed(), passId: str().indexed(),
  fromHolder: addr().indexed(), toHolder: addr().indexed(), status: str().indexed(),
  requestedAt: str().indexed(), expiresAt: str().indexed(), unregisterTxHash: str().optional(), registerTxHash: str().optional(),
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
  const admitted = new Set<string>();
  const lastOrdinal = new Map<string, number>();

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
      .from(TicketSchema, { onMismatch: "throw" }).createdBy(account.address).ownedBy(account.address)
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

  async function event(eventId: string) {
    const { entities } = await reader.select({ eventDate: true, priceWei: true, organiser: true })
      .from(EventSchema, { onMismatch: "throw" }).createdBy(account.address).where(eq("eventId", eventId)).limit(1).fetch();
    return entities[0];
  }

  async function hasCheckedIn(eventId: string, holder: string): Promise<boolean> {
    if (admitted.has(`${eventId}:${holder}`)) return true;
    const { entities } = await reader.select({ passId: true }).from(CheckinSchema, { onMismatch: "throw" }).createdBy(account.address)
      .where(eq("eventId", eventId)).where(eq("holder", addr(getAddress(holder)))).limit(1).fetch();
    return entities.length > 0;
  }

  const TRANSFER_FIELDS = { $key: true, requestId: true, eventId: true, passId: true, fromHolder: true, toHolder: true,
    status: true, requestedAt: true, expiresAt: true, unregisterTxHash: true, registerTxHash: true } as const;
  const activeTransfer = (status: string, expiresAt: string) =>
    ["pending", "processing", "needs_review"].includes(status) && (status !== "pending" || expiresAt > new Date().toISOString());
  const toTransfer = (row: any): TransferRequest => ({
    requestId: row.requestId.value, eventId: row.eventId.value, passId: row.passId.value,
    fromHolder: row.fromHolder.value.toLowerCase(), toHolder: row.toHolder.value.toLowerCase(),
    status: row.status.value === "pending" && row.expiresAt.value <= new Date().toISOString() ? "expired" : row.status.value as TransferStatus,
    requestedAt: row.requestedAt.value, expiresAt: row.expiresAt.value,
    unregisterTxHash: row.unregisterTxHash?.value, registerTxHash: row.registerTxHash?.value,
  });
  async function transfer(passId: string): Promise<TransferRequest | undefined> {
    const { entities } = await reader.select(TRANSFER_FIELDS).from(TransferSchema, { onMismatch: "throw" })
      .createdBy(account.address).ownedBy(account.address).where(eq("passId", passId)).limit(10).fetch();
    const rows = entities.map(toTransfer).sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
    return rows.find((row) => activeTransfer(row.status, row.expiresAt)) ?? rows[0];
  }
  async function hasPendingTransfer(passId: string): Promise<boolean> {
    const current = await transfer(passId);
    return !!current && activeTransfer(current.status, current.expiresAt);
  }
  async function transferEntity(passId: string, requestId?: string) {
    const query = reader.select(TRANSFER_FIELDS).from(TransferSchema, { onMismatch: "throw" })
      .createdBy(account.address).ownedBy(account.address).where(eq("passId", passId));
    const { entities } = await (requestId ? query.where(eq("requestId", requestId)) : query).limit(10).fetch();
    const row = entities.find((item: any) => !requestId || item.requestId.value === requestId);
    if (!row) throw new Error("Transfer request not found");
    return { row, request: toTransfer(row) };
  }

  return {
    ready: true as const,
    organizer: account.address,
    issue: async (holder: string, tier: string, eventId = defaultEvent) => {
      if (!isAddress(holder) || typeof tier !== "string" || !tier.trim()) throw new Error("A valid holder address and tier are required");
      const selectedEvent = await event(eventId);
      if (!selectedEvent) throw new Error("Event not found");
      const values = { passId: randomUUID(), eventId, holder: getAddress(holder), tier: tier.trim(), status: "issued" };
      const result = await write(`issue ${values.passId}`, 1, (tx) => writer.createEntity(TicketSchema, { ...values, holder: addr(values.holder) }, keep, tx));
      return { ...values, holder: values.holder.toLowerCase(), status: "issued" as const, entityKey: result.entityKey, transactionHash: result.txHash };
    },
    canManageEvent: async (eventId: string, organizer: string) => {
      const selected = await event(eventId);
      // Older shared events were written with the server wallet as the organizer.
      return !!selected && (selected.organiser.value.toLowerCase() === organizer.toLowerCase()
        || selected.organiser.value.toLowerCase() === account.address.toLowerCase());
    },
    ticket,
    ticketsOf: async (holder: string): Promise<Ticket[]> => {
      if (!isAddress(holder)) throw new Error("A valid holder address is required");
      const tickets: Ticket[] = [];
      let lastKey: Hex | undefined;
      do {
        const query = reader.select(TICKET_FIELDS)
          .from(TicketSchema, { onMismatch: "throw" }).createdBy(account.address).ownedBy(account.address)
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
    transfer,
    requestTransfer: (passId: string, fromHolder: string, toHolder: string, requestId: string, requestedAt: string, expiresAt: string) => exclusive(async () => {
      const existing = await ticket(passId);
      if (!existing || existing.holder !== fromHolder.toLowerCase() || existing.status !== "claimed") throw new Error("ticket_not_transferable");
      const eventDetails = await event(existing.eventId);
      if (!eventDetails || eventDetails.eventDate.value < new Date().toISOString().slice(0, 10)) throw new Error("event_ended");
      if (await hasCheckedIn(existing.eventId, existing.holder)) throw new Error("ticket_already_used");
      if (await hasPendingTransfer(passId)) throw new Error("transfer_already_pending");
      const values = { requestId, eventId: existing.eventId, passId, fromHolder: addr(getAddress(fromHolder)), toHolder: addr(getAddress(toHolder)), status: "pending", requestedAt, expiresAt };
      await write(`transfer request ${requestId}`, 1, (tx) => writer.createEntity(TransferSchema, values, keep, tx));
      return { ...values, fromHolder: fromHolder.toLowerCase(), toHolder: toHolder.toLowerCase(), status: "pending" as const };
    }),
    cancelTransfer: (passId: string, fromHolder: string) => exclusive(async () => {
      const { row, request } = await transferEntity(passId);
      if (request.fromHolder !== fromHolder.toLowerCase() || request.status !== "pending") throw new Error("transfer_not_cancellable");
      await write(`transfer cancel ${request.requestId}`, 1, (tx) => writer.patchEntity(TransferSchema, row.$key, { set: { status: "cancelled" } }, tx));
    }),
    declineTransfer: (passId: string, requestId: string) => exclusive(async () => {
      const { row, request } = await transferEntity(passId, requestId);
      if (request.status !== "pending" || request.expiresAt <= new Date().toISOString()) throw new Error("transfer_not_pending");
      await write(`transfer decline ${requestId}`, 1, (tx) => writer.patchEntity(TransferSchema, row.$key, { set: { status: "declined" } }, tx));
    }),
    transfersForEvent: async (eventId: string) => {
      const { entities } = await reader.select(TRANSFER_FIELDS).from(TransferSchema, { onMismatch: "throw" })
        .createdBy(account.address).ownedBy(account.address).where(eq("eventId", eventId)).limit(100).fetch();
      return entities.map(toTransfer).filter((row) => activeTransfer(row.status, row.expiresAt) || row.status === "approved");
    },
    beginTransfer: (passId: string, requestId: string) => exclusive(async () => {
      const { row, request } = await transferEntity(passId, requestId);
      if (request.status !== "pending" || request.expiresAt <= new Date().toISOString()) throw new Error("transfer_not_pending");
      await write(`transfer processing ${requestId}`, 1, (tx) => writer.patchEntity(TransferSchema, row.$key, { set: { status: "processing" } }, tx));
      return { ...request, status: "processing" };
    }),
    finishTransfer: (passId: string, requestId: string, unregisterTxHash: string, registerTxHash: string) => exclusive(async () => {
      const { row, request } = await transferEntity(passId, requestId);
      if (request.status !== "processing") throw new Error("transfer_not_processing");
      const existing = await ticket(passId);
      if (!existing || existing.holder !== request.fromHolder || existing.status !== "claimed") throw new Error("ticket_changed_during_transfer");
      const hashes = { unregisterTxHash, registerTxHash };
      await write(`transfer complete ${requestId}`, 2, (tx) => writer.executeBatch({ patches: [
        { schema: TicketSchema, entityKey: existing.entityKey, set: { holder: addr(getAddress(request.toHolder)), status: "issued" } },
        { schema: TransferSchema, entityKey: row.$key, set: { status: "approved", ...hashes } },
      ] }, tx));
    }),
    reviewTransfer: (passId: string, requestId: string) => exclusive(async () => {
      const { row, request } = await transferEntity(passId, requestId);
      if (request.status === "approved" || request.status === "declined" || request.status === "cancelled") return;
      await write(`transfer review ${requestId}`, 1, (tx) => writer.patchEntity(TransferSchema, row.$key, { set: { status: "needs_review" } }, tx));
    }),
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
    createEvent: async (event: { slug: string; eventName: string; eventDate: string; priceWei: bigint; organizer: string }) => {
      const values = { eventId: eventHash(event.slug), eventName: event.eventName, organiser: addr(getAddress(event.organizer)), eventDate: event.eventDate, priceWei: event.priceWei.toString() };
      const result = await write(`event ${values.eventId}`, 1, (tx) => writer.createEntity(EventSchema, values, { ...keep, flags: { readonly: true } }, tx));
      return { eventId: values.eventId, entityKey: result.entityKey, transactionHash: result.txHash };
    },
    doorTicket: async (passId: string, holder: string): Promise<DoorTicket | undefined> => {
      const issued = await ticket(passId);
      if (issued) return { ...issued, bought: false };
      const { entities } = await reader.select(TICKET_FIELDS).from(TicketSchema, { onMismatch: "throw" })
        .createdBy(getAddress(holder)).where(eq("passId", passId)).limit(1).fetch();
      return entities[0] ? { ...toTicket(entities[0]), bought: true } : undefined;
    },
    paymentIsValid: async (bought: DoorTicket): Promise<boolean> => {
      const buyer = getAddress(bought.holder);
      const { entities } = await reader.select({ txnHash: true, eventId: true }).from(PaymentSchema, { onMismatch: "throw" })
        .createdBy(buyer).where(eq("passId", bought.passId)).limit(1).fetch();
      const payment = entities[0];
      if (!payment || payment.eventId.value !== bought.eventId) return false;
      const txnHash = payment.txnHash.value;
      // One payment can only back one ticket.
      const { entities: uses } = await reader.select({ passId: true }).from(PaymentSchema, { onMismatch: "throw" })
        .createdBy(buyer).where(eq("txnHash", txnHash)).limit(2).fetch();
      if (uses.length !== 1) return false;
      const details = await event(bought.eventId);
      if (!details) return false;
      const [transaction, receipt] = await Promise.all([
        reader.getTransaction({ hash: txnHash as Hex }),
        reader.getTransactionReceipt({ hash: txnHash as Hex }),
      ]).catch(() => [null, null] as const);
      return !!transaction && !!receipt && receipt.status === "success"
        && getAddress(transaction.from) === buyer
        && !!transaction.to && getAddress(transaction.to) === getAddress(details.organiser.value)
        && transaction.value >= BigInt(details.priceWei.value);
    },
    eventEnded: async (eventId: string) => {
      const details = await event(eventId);
      return !!details && details.eventDate.value < new Date().toISOString().slice(0, 10);
    },
    hasCheckedIn,
    hasPendingTransfer,
    /** The admission and the ticket's new status land together. A failure here is never written twice. */
    commitCheckin: (door: DoorTicket, distanceCm: number, revalidate: () => Promise<AdmissionEligibility>) => exclusive(async (): Promise<Admission> => {
      if (await hasCheckedIn(door.eventId, door.holder)) throw new Error("Already checked in");
      if (!door.bought && await hasPendingTransfer(door.passId)) throw new Error("Ticket transfer is pending review");
      const page = await reader.select({ passId: true }).from(CheckinSchema, { onMismatch: "throw" }).createdBy(account.address)
        .where(eq("eventId", door.eventId)).limit(1).withCount().fetch();
      // Arkiv's index can lag behind a write that just landed, so the count never goes backwards.
      const ordinal = Math.max(Number(page.count), lastOrdinal.get(door.eventId) ?? 0) + 1;
      let admittedUserId: string | undefined;
      const result = await write(`checkin ${door.passId}`, 2, async (tx) => {
        // Run after both the claim/check-in queue and signer queue have been acquired.
        const current = await revalidate();
        const values = {
          eventId: door.eventId, passId: door.passId, holder: addr(getAddress(door.holder)), ordinal: String(ordinal),
          distanceCm: String(Math.round(distanceCm)), checkedInAt: new Date().toISOString(), verificationLevel: current.verificationLevel,
        };
        const creates = [{ schema: CheckinSchema, values, ...keep, flags: { readonly: true } }];
        if (door.bought) {
          if (!current.userId) return writer.executeBatch({ creates }, tx);
          admittedUserId = current.userId;
          return writer.executeBatch({ creates: [
            ...creates,
            { schema: ClaimSchema, values: {
              operationId: randomUUID(), eventId: door.eventId, passId: door.passId,
              holder: addr(getAddress(door.holder)), userId: admittedUserId,
            }, ...keep, flags: { readonly: true } },
          ] }, tx);
        }
        return writer.executeBatch({
          creates, patches: [{ schema: TicketSchema, entityKey: current.ticket.entityKey, set: { status: "checked_in" } }],
        }, tx);
      });
      if (admittedUserId) claimed.add(`${door.eventId}:${admittedUserId}`);
      admitted.add(`${door.eventId}:${door.holder}`);
      lastOrdinal.set(door.eventId, ordinal);
      return { ordinal, transactionHash: result.txHash, entityKey: result.createdEntities[0] };
    }),
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
