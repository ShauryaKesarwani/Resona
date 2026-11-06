import { useSyncExternalStore } from 'react'
import { allEvents, myTickets } from '../services/arkiv'
import { walletAddress } from '../utils/wallet'

/**
 * Tickets are real and read from Arkiv. Check ins are still simulated until the door is wired up.
 */
export type Status = 'issued' | 'claimed' | 'skipped' | 'checked_in' | 'revoked'
export type Level = 'Orb verified' | 'Camera verified' | 'Government ID' | 'Not verified'

export type Ticket = {
  id: string
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

/** Reads this wallet's tickets from Arkiv, once at a time. A check in stays on this phone until the door is real. */
export const refreshTickets = () => (refreshing ??= loadTickets().finally(() => (refreshing = undefined)))

async function loadTickets() {
  try {
    const [rows, events] = await Promise.all([myTickets(), allEvents()])
    const today = new Date().toISOString().slice(0, 10)
    tickets = rows.map((row, index) => {
      const event = events.find((e) => e.eventId === row.eventId)
      const local = tickets.find((t) => t.id === row.passId)
      return {
        id: row.passId,
        pass: index + 1,
        ens: row.ensName ?? `${row.passId.slice(0, 8)}…`,
        event: event?.eventName ?? 'Event details not published',
        tier: tierNames[row.tier] ?? row.tier,
        level: row.status === 'claimed' || row.status === 'checked_in' ? 'Orb verified' : 'Not verified',
        status: local?.status === 'checked_in' ? 'checked_in' : (row.status as Status),
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

/** Door side. A check in is a sound pass or a manual entry by staff. */
export type Checkin = {
  id: string
  pass: number
  name: string
  at: number
  method: 'sound' | 'manual'
  cm?: number
  reason?: string
  ordinal: number
}

export const doorStaff = 'Door A'
const min = 60000

let checkins: Checkin[] = []

export const useCheckins = () => useSyncExternalStore(subscribe, () => checkins)

export const findPass = (pass: string | null) => tickets.find((t) => String(t.pass) === (pass ?? '').trim())

export function recordCheckin(pass: number, method: 'sound' | 'manual', extra: { cm?: number; reason?: string }) {
  const t = tickets.find((x) => x.pass === pass)
  checkins = [
    { id: `c${Date.now()}`, pass, name: wallet.name, at: Date.now(), method, ordinal: checkins.length + 1, ...extra },
    ...checkins,
  ]
  if (t) tickets = tickets.map((x) => (x.id === t.id ? { ...x, status: 'checked_in' } : x))
  subs.forEach((f) => f())
}

export const ordinal = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

export const ago = (at: number) => {
  const m = Math.max(0, Math.round((Date.now() - at) / min))
  return m < 1 ? 'Just now' : m === 1 ? '1\u00a0min ago' : `${m}\u00a0min ago`
}
