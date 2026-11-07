import { createPublicClient, createWalletClient, ExpirationTime } from '@arkiv-network/sdk'
import { rabdi } from '@arkiv-network/sdk/chains'
import { asc, eq, gt } from '@arkiv-network/sdk/query'
import { addr, defineSchema, key, str } from '@arkiv-network/sdk/schema'
import { getAddress, http, keccak256, parseEther, type Hex } from 'viem'
import { walletAccount, walletAddress } from '../utils/wallet'
import { api } from './api'
import { signedBy } from './auth'

/** Same schemas as server/src/arkiv. Everything on Arkiv is public, so the browser reads it directly. */
const Accounts = defineSchema('resona.account', {
  wallet: addr().indexed(), nullifierHash: str().indexed(), userId: str().optional().indexed(), sessionHash: str().optional(),
})
export const Organizers = defineSchema('resona.organizer', {
  wallet: addr().indexed(), userId: str().indexed(), promotedBy: addr().indexed(), promotedAt: str(),
})
const Events = defineSchema('resona.event', { eventId: str().indexed(), eventName: str(), organiser: addr().indexed(), eventDate: str(), priceWei: str() })
const Tickets = defineSchema('resona.ticket', {
  passId: str().indexed(), eventId: str().indexed(), holder: addr().indexed(), tier: str().indexed(), status: str().indexed(),
  ensName: str().optional(), ensNode: str().optional(), ensRegistry: addr().optional(), ensChainId: str().optional(),
})
const Payments = defineSchema('resona.payment', {
  txnHash: str().indexed(), eventId: str().indexed(), userId: str().indexed(), passId: str().indexed(), amountWei: str(), createdAt: str().indexed(),
})

const Checkins = defineSchema('resona.checkin', {
  eventId: str().indexed(), passId: str().indexed(), holder: addr().indexed(), ordinal: str(), distanceCm: str(), checkedInAt: str(),
})

export type ArkivEvent = { eventId: string; eventName: string; eventDate: string; priceWei: string; organiser: string }
export type ArkivTicket = { passId: string; eventId: string; tier: string; status: string; ensName?: string; createdAt: number }
export type ArkivCheckin = { eventId?: string; passId: string; holder: string; ordinal: number; distanceCm: string; checkedInAt: string }
export type ArkivPayment = { txnHash: string; eventId: string; passId: string; amountWei: string; createdAt: string }
export type AttendeeTicket = { passId: string; holder: string; tier: string; status: string; source: 'issued' | 'purchased' }

// The access key can't ship in a browser. Reads go through a small server relay that adds it, because
// the keyless endpoint runs out after a few pages. The wallet's own writes go straight to Arkiv.
const chain = rabdi({ accessKey: '' })
const reader = createPublicClient({ chain, transport: http('/api/arkiv', { timeout: 15_000, retryCount: 1 }), cacheTime: 0 })
const walletTransport = http(undefined, { timeout: 15_000, retryCount: 0 })
const TRANSFER_GAS = 21_000n
const RECORD_GAS = 2_000_000n // Two small records, about 340k gas each, with Arkiv's gas floor and a 2x margin.
const MIN_BALANCE = parseEther('0.005') // Covers the two transactions of a purchase at 1 gwei.
const today = () => new Date().toISOString().slice(0, 10)

export const explorerTx = (hash: string) => `https://rabdi.explorer.arkiv.network/tx/${hash}`
export const isUpcoming = (event: Pick<ArkivEvent, 'eventDate'>) => event.eventDate >= today()

let organizerAddress: Promise<Hex> | undefined
const organizer = () =>
  (organizerAddress ??= api.config().then((c) => {
    if (!c.organizer) throw new Error('arkiv_not_configured')
    return c.organizer as Hex
  }))

/** Read issued tickets and ask the server to verify buyer-written payment records. */
export async function organizerAttendees(eventId: string): Promise<{ tickets: AttendeeTicket[]; checkins: { passId: string; holder: string }[] }> {
  const owner = await organizer()
  const tickets: AttendeeTicket[] = []
  const checkins: { passId: string; holder: string }[] = []
  let last: Hex | undefined
  for (let page = 0; page < 10; page++) {
    const query = reader.select({ $key: true, passId: true, holder: true, tier: true, status: true })
      .from(Tickets, { onMismatch: 'throw' }).createdBy(owner).ownedBy(owner)
      .where(eq('eventId', eventId)).orderBy(asc('$key')).limit(100)
    const { entities } = await (last ? query.where(gt('$key', key(last))) : query).fetch()
    tickets.push(...entities.map((t) => ({ passId: t.passId.value, holder: String(t.holder.value).toLowerCase(), tier: t.tier.value, status: t.status.value, source: 'issued' as const })))
    if (entities.length < 100) break
    const next = entities.at(-1)?.$key
    if (!next || (last && next.toLowerCase() <= last.toLowerCase()) || page === 9) throw new Error('ticket_list_incomplete')
    last = next
  }
  const payments = await reader.select({ $creator: true, passId: true }).from(Payments, { onMismatch: 'throw' })
    .where(eq('eventId', eventId)).limit(51).fetch()
  if (payments.entities.length > 50) throw new Error('purchase_list_too_large')
  const candidates = payments.entities.map((p) => ({ passId: p.passId.value, holder: String(p.$creator).toLowerCase() }))
  if (candidates.length) {
    const verified = await api.verifyPurchases(eventId, candidates, await signedBy(`organizer-purchases:${eventId}`))
    tickets.push(...verified.tickets.map((t) => ({ ...t, holder: t.holder.toLowerCase(), source: 'purchased' as const })))
  }
  last = undefined
  for (let page = 0; page < 10; page++) {
    const query = reader.select({ $key: true, passId: true, holder: true })
      .from(Checkins, { onMismatch: 'throw' }).createdBy(owner)
      .where(eq('eventId', eventId)).orderBy(asc('$key')).limit(100)
    const entities: ReadonlyArray<{ $key: Hex; passId: { value: string }; holder: { value: string } }> =
      (await (last ? query.where(gt('$key', key(last))) : query).fetch()).entities
    checkins.push(...entities.map((c) => ({ passId: c.passId.value, holder: String(c.holder.value).toLowerCase() })))
    if (entities.length < 100) break
    const next: Hex | undefined = entities.at(-1)?.$key
    if (!next || (last && next.toLowerCase() <= last.toLowerCase()) || page === 9) throw new Error('checkin_list_incomplete')
    last = next
  }
  return { tickets, checkins }
}

/** Every event from the organizer. Anyone can write this schema, so only the organizer's records count. */
export async function allEvents(): Promise<ArkivEvent[]> {
  const { entities } = await reader
    .select({ eventId: true, eventName: true, eventDate: true, priceWei: true, organiser: true })
    .from(Events)
    .createdBy(await organizer())
    .limit(100)
    .fetch()
  return entities.map((e) => ({
    eventId: e.eventId.value, eventName: e.eventName.value, eventDate: e.eventDate.value,
    priceWei: e.priceWei.value, organiser: String(e.organiser.value),
  }))
}

/** Events owned by this signed-in organizer, plus legacy events owned by the shared server wallet. */
export async function organizerEvents(): Promise<ArkivEvent[]> {
  const [events, sharedWriter] = await Promise.all([allEvents(), organizer()])
  const wallet = walletAddress().toLowerCase()
  return events.filter((event) => event.organiser.toLowerCase() === wallet || event.organiser.toLowerCase() === sharedWriter.toLowerCase())
}

/** Tickets the organizer issued to this wallet, plus the ones this wallet bought itself. */
export async function myTickets(): Promise<ArkivTicket[]> {
  const holder = getAddress(walletAddress())
  const query = () =>
    reader
      .select({ passId: true, eventId: true, tier: true, status: true, ensName: true, $createdAt: true })
      .from(Tickets)
      .where(eq('holder', addr(holder)))
      .limit(100)
  const [issued, bought] = await Promise.all([query().createdBy(await organizer()).ownedBy(await organizer()).fetch(), query().createdBy(holder).fetch()])
  return [...issued.entities, ...bought.entities]
    .map((t) => ({
      passId: t.passId.value, eventId: t.eventId.value, tier: t.tier.value, status: t.status.value,
      ensName: t.ensName?.value, createdAt: Number(t.$createdAt),
    }))
    .sort((a, b) => a.createdAt - b.createdAt)
}

// The query builder is awaitable, so this must stay a plain function: awaiting it would run the query early.
const checkinQuery = (organizerAddress: Hex) =>
  reader
    .select({ eventId: true, passId: true, holder: true, ordinal: true, distanceCm: true, checkedInAt: true })
    .from(Checkins)
    .createdBy(organizerAddress)
    .limit(100) // The most Arkiv returns in one query.

/** Everyone through the door, newest first. Only the organizer's records count. */
export async function recentCheckins(): Promise<ArkivCheckin[]> {
  const { entities } = await checkinQuery(await organizer()).fetch()
  return entities
    .map((c) => ({
      eventId: c.eventId.value, passId: c.passId.value, holder: String(c.holder.value), ordinal: Number(c.ordinal.value),
      distanceCm: c.distanceCm.value, checkedInAt: c.checkedInAt.value,
    }))
    .sort((a, b) => b.checkedInAt.localeCompare(a.checkedInAt))
}

/** Every door check in for one wallet, newest first. Public: anyone can read a profile. */
export async function checkinsFor(holder: string): Promise<(ArkivCheckin & { eventId: string })[]> {
  const { entities } = await reader
    .select({ eventId: true, passId: true, holder: true, ordinal: true, distanceCm: true, checkedInAt: true })
    .from(Checkins)
    .createdBy(await organizer())
    .where(eq('holder', addr(getAddress(holder))))
    .limit(100)
    .fetch()
  return entities
    .map((c) => ({
      eventId: c.eventId.value, passId: c.passId.value, holder: String(c.holder.value), ordinal: Number(c.ordinal.value),
      distanceCm: c.distanceCm.value, checkedInAt: c.checkedInAt.value,
    }))
    .sort((a, b) => b.checkedInAt.localeCompare(a.checkedInAt))
}

/** This wallet's passes that have been through the door. */
export async function myCheckedInPasses(): Promise<Set<string>> {
  const { entities } = await checkinQuery(await organizer()).where(eq('holder', addr(getAddress(walletAddress())))).fetch()
  return new Set(entities.map((c) => c.passId.value))
}

/** This wallet's purchases, newest first. One human has one wallet, so this is their whole history. */
export async function myPurchases(): Promise<ArkivPayment[]> {
  const { entities } = await reader
    .select({ txnHash: true, eventId: true, passId: true, amountWei: true, createdAt: true })
    .from(Payments)
    .createdBy(getAddress(walletAddress()))
    .limit(100)
    .fetch()
  return entities
    .map((p) => ({ txnHash: p.txnHash.value, eventId: p.eventId.value, passId: p.passId.value, amountWei: p.amountWei.value, createdAt: p.createdAt.value }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

async function userIdOf(wallet: Hex) {
  const { entities } = await reader
    .select({ userId: true, nullifierHash: true })
    .from(Accounts)
    .createdBy(await organizer())
    .where(eq('wallet', addr(wallet)))
    .limit(1)
    .fetch()
  const row = entities[0]
  if (!row) throw new Error('no_account')
  if (row.userId?.value) return row.userId.value
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(row.nullifierHash.value))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

type Pending = { rawTransaction: Hex; txnHash: Hex; recording?: boolean }
const pendingKey = (eventId: string) => `resona.purchase.${eventId}`
const loadPending = (eventId: string): Pending | null => JSON.parse(localStorage.getItem(pendingKey(eventId)) ?? 'null')
const savePending = (eventId: string, pending: Pending) => localStorage.setItem(pendingKey(eventId), JSON.stringify(pending))

async function gasPrice() {
  return BigInt((await reader.request({ method: 'eth_gasPrice' } as never)) as string)
}

/** Signs the payment and saves it before sending, so a lost response can't lead to paying twice. */
async function signPayment(event: ArkivEvent, wallet: Hex): Promise<Pending> {
  const signed = await walletAccount().signTransaction({
    type: 'legacy',
    chainId: chain.id,
    nonce: await reader.getTransactionCount({ address: wallet, blockTag: 'latest' }),
    gas: TRANSFER_GAS,
    gasPrice: await gasPrice(),
    to: getAddress(event.organiser as Hex),
    value: BigInt(event.priceWei),
  })
  const pending = { rawTransaction: signed, txnHash: keccak256(signed) }
  savePending(event.eventId, pending)
  return pending
}

export type BuyStep = 'funding' | 'paying' | 'recording'
export class PurchaseError extends Error {
  txnHash?: string
  constructor(code: string, txnHash?: string) {
    super(code)
    this.txnHash = txnHash
  }
}

/**
 * The wallet pays the event's organizer on Rabdi, then writes its own ticket and payment records.
 * The one human, one ticket check runs here, so the door must confirm the payment before admitting a bought ticket.
 */
export async function buy(event: ArkivEvent, onStep: (step: BuyStep) => void) {
  const wallet = getAddress(walletAddress())
  const userId = await userIdOf(wallet)
  let pending = loadPending(event.eventId)

  if (!pending) {
    if (!isUpcoming(event)) throw new PurchaseError('event_ended')
    if ((await myTickets()).some((t) => t.eventId === event.eventId)) throw new PurchaseError('human_already_claimed')
    if ((await reader.getBalance({ address: wallet })) < BigInt(event.priceWei) + MIN_BALANCE) {
      onStep('funding')
      await api.fund(await signedBy('fund'))
    }
    pending = await signPayment(event, wallet)
  }

  onStep('paying')
  const { rawTransaction, txnHash } = pending
  const client = createWalletClient({ chain, transport: walletTransport, account: walletAccount() })
  const landed = await reader.getTransactionReceipt({ hash: txnHash }).catch(() => null)
  if (!landed) await client.sendRawTransaction({ serializedTransaction: rawTransaction }).catch(() => {})
  const receipt = landed ?? (await reader.waitForTransactionReceipt({ hash: txnHash, timeout: 30_000 }).catch(() => null))
  if (!receipt) throw new PurchaseError('payment_not_confirmed', txnHash)
  if (receipt.status !== 'success') {
    localStorage.removeItem(pendingKey(event.eventId))
    throw new PurchaseError('payment_failed', txnHash)
  }

  onStep('recording')
  if (pending.recording) {
    // An earlier write may have landed. Check it, and never write the records a second time.
    const found = (await myPurchases()).find((p) => p.txnHash === txnHash)
    if (!found) throw new PurchaseError('purchase_needs_review', txnHash)
    localStorage.removeItem(pendingKey(event.eventId))
    return found.passId
  }

  savePending(event.eventId, { ...pending, recording: true })
  const passId = crypto.randomUUID()
  const expiration = ExpirationTime.max()
  await client
    .executeBatch(
      {
        creates: [
          { schema: Tickets, values: { passId, eventId: event.eventId, holder: addr(wallet), tier: 'general', status: 'claimed' }, expiration },
          {
            schema: Payments,
            values: { txnHash, eventId: event.eventId, userId, passId, amountWei: event.priceWei, createdAt: new Date().toISOString() },
            expiration,
            flags: { readonly: true },
          },
        ],
      },
      { nonce: await reader.getTransactionCount({ address: wallet, blockTag: 'latest' }), gas: RECORD_GAS, gasPrice: await gasPrice() },
    )
    .catch(() => {
      throw new PurchaseError('purchase_needs_review', txnHash)
    })
  localStorage.removeItem(pendingKey(event.eventId))
  return passId
}
