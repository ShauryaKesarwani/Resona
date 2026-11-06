import { useSyncExternalStore } from 'react'
import { api } from '../services/api'
import { walletAddress } from '../utils/wallet'

/**
 * Simulated data. Everything here is fake and shown with a "Simulated" tag in the UI.
 * The shapes follow docs/ARCHITECTURE.md (resona.ticket) so the server or Arkiv can replace this file.
 */
export type Status = 'issued' | 'claimed' | 'skipped' | 'checked_in'
export type Level = 'Orb verified' | 'Camera verified' | 'Government ID'

export type Ticket = {
  id: string
  pass: number
  ens: string
  event: string
  tier: string
  level: Level
  status: Status
  /** Set while the organizer has not yet decided a transfer request. */
  transferExpires?: number
}

export const wallet = {
  name: 'skes.eth',
  address: walletAddress(),
  network: 'Sepolia',
}

export const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`

let tickets: Ticket[] = [
  { id: '7', pass: 7, ens: '7.ethglobal-mumbai.eth', event: 'ETHGlobal Mumbai', tier: 'General admission', level: 'Orb verified', status: 'issued' },
  { id: '12', pass: 12, ens: '12.ethglobal-mumbai.eth', event: 'ETHGlobal Mumbai', tier: 'Partner discount', level: 'Camera verified', status: 'claimed' },
  { id: '3', pass: 3, ens: '3.ethglobal-mumbai.eth', event: 'ETHGlobal Mumbai', tier: 'Builder', level: 'Orb verified', status: 'checked_in' },
]

const subs = new Set<() => void>()
const subscribe = (f: () => void) => {
  subs.add(f)
  return () => subs.delete(f)
}

export const useTickets = () => useSyncExternalStore(subscribe, () => tickets)

export function updateTicket(id: string, patch: Partial<Ticket>) {
  tickets = tickets.map((t) => (t.id === id ? { ...t, ...patch } : t))
  subs.forEach((f) => f())
}

export const transferWindowMs = 24 * 60 * 60 * 1000

/** Pass 7 is real: each browser wallet gets its own server ticket behind it. The other passes stay simulated. */
const REAL_PASS = '7'
let realPass: Promise<string> | undefined

async function loadRealPass() {
  const rows = await api.tickets(wallet.address)
  const row = rows[0] ?? (await api.issue(wallet.address, 'general'))
  updateTicket(REAL_PASS, { status: row.status })
  return row.passId
}

export function serverPass() {
  realPass ??= loadRealPass().catch((err) => {
    realPass = undefined
    throw err
  })
  return realPass
}

serverPass().catch(() => {})

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

let checkins: Checkin[] = [
  { id: 'c3', pass: 25, name: 'devansh.eth', at: Date.now() - 2 * min, method: 'sound', cm: 31, ordinal: 3 },
  { id: 'c2', pass: 18, name: 'mira.eth', at: Date.now() - 9 * min, method: 'manual', reason: 'Speaker not working', ordinal: 2 },
  { id: 'c1', pass: 3, name: 'skes.eth', at: Date.now() - 14 * min, method: 'sound', cm: 24, ordinal: 1 },
]

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
