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
