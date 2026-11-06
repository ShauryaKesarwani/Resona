import { useSyncExternalStore } from 'react'
import { allEvents, myCheckedInPasses, myTickets } from '../services/arkiv'
import { walletAddress } from '../utils/wallet'

/**
 * This wallet's tickets, read from Arkiv and held for the screens. Nothing here is simulated.
 */
export type Status = 'issued' | 'claimed' | 'skipped' | 'checked_in' | 'revoked'
export type Level = 'Orb verified' | 'Camera verified' | 'Government ID' | 'Not verified'

export type Ticket = {
  id: string
  eventId: string
  pass: number
  ens: string
  event: string
  tier: string
  level: Level
  status: Status
  /** The event's date has gone by. */
  past: boolean
  /** Set while the organizer has not yet decided a transfer request. */
  transferExpires?: number
}

export const wallet = {
  name: 'Resona wallet',
  address: walletAddress(),
  network: 'Rabdi',
}

export const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`

let tickets: Ticket[] = []
let ticketsState: 'loading' | 'ready' | 'failed' = 'loading'

const subs = new Set<() => void>()
const subscribe = (f: () => void) => {
  subs.add(f)
  return () => subs.delete(f)
}

export const useTickets = () => useSyncExternalStore(subscribe, () => tickets)
export const useTicketsState = () => useSyncExternalStore(subscribe, () => ticketsState)

export function updateTicket(id: string, patch: Partial<Ticket>) {
  tickets = tickets.map((t) => (t.id === id ? { ...t, ...patch } : t))
  subs.forEach((f) => f())
}

export const transferWindowMs = 24 * 60 * 60 * 1000

const tierNames: Record<string, string> = { general: 'General admission', partner: 'Partner discount', builder: 'Builder' }

let refreshing: Promise<void> | undefined

/** Reads this wallet's tickets from Arkiv, once at a time. */
export const refreshTickets = () => (refreshing ??= loadTickets().finally(() => (refreshing = undefined)))

async function loadTickets() {
  try {
    const [rows, events, entered] = await Promise.all([myTickets(), allEvents(), myCheckedInPasses()])
    const today = new Date().toISOString().slice(0, 10)
    tickets = rows.map((row, index) => {
      const event = events.find((e) => e.eventId === row.eventId)
      const local = tickets.find((t) => t.id === row.passId)
      return {
        id: row.passId,
        eventId: row.eventId,
        pass: index + 1,
        ens: row.ensName ?? `${row.passId.slice(0, 8)}…`,
        event: event?.eventName ?? 'Event details not published',
        tier: tierNames[row.tier] ?? row.tier,
        level: row.status === 'claimed' || row.status === 'checked_in' ? 'Orb verified' : 'Not verified',
        status: entered.has(row.passId) ? 'checked_in' : (row.status as Status),
        past: event ? event.eventDate < today : false,
        transferExpires: local?.transferExpires,
      }
    })
    ticketsState = 'ready'
  } catch {
    ticketsState = 'failed'
  }
  subs.forEach((f) => f())
}

refreshTickets()

export const ordinal = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}
