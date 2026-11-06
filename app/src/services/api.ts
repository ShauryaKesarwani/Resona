import type { IDKitResult, RpContext } from '@worldcoin/idkit'

export type ServerTicket = { passId: string; holder: string; tier: string; status: 'issued' | 'claimed' | 'skipped' }
export type EnsPass = { enabled: true; name: string; chainId: 11155111; registry: string; owner: string; expiry: string; matchesHolder: boolean; linked: boolean; active: boolean }
export type EnsTransferCheck = { result: 'blocked' | 'transferable' | 'not_verified'; pass: EnsPass; tokenId?: string; error?: string }
export type WorldConfig = {
  appId: `app_${string}`
  action: string
  environment: 'production' | 'staging'
  allowSkip: boolean
  organizer?: string
  doorPinRequired?: boolean
}
export type CheckinResult = { state: string; cm?: number; ordinal?: number; transactionHash?: string; attempt?: number; seed?: string; problem?: string }

async function request<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? `request_failed_${res.status}`)
  return data
}

type Signed = { wallet: string; timestamp: number; signature: string }

export const api = {
  config: () => request<WorldConfig>('/api/config'),
  sign: (session: boolean) => request<RpContext>('/api/world/sign', { session }),
  signup: (signed: Signed, idkitResponse: IDKitResult) => request<{ wallet: string }>('/api/auth/signup', { ...signed, idkitResponse }),
  login: (signed: Signed, idkitResponse: IDKitResult) => request<{ wallet: string }>('/api/auth/login', { ...signed, idkitResponse }),
  tickets: (holder: string) => request<ServerTicket[]>(`/api/tickets?holder=${holder}`),
  issue: (holder: string, tier: string, signed: Signed) => request<ServerTicket>('/api/issue', { holder, tier, ...signed }),
  claim: (passId: string, signed: Signed) => request<ServerTicket>('/api/claim', { passId, ...signed }),
  ensPass: (passId: string) => request<EnsPass>(`/api/ens/pass/${encodeURIComponent(passId)}`),
  ensTransferCheck: (passId: string, recipient: string) => request<EnsTransferCheck>(`/api/ens/pass/${encodeURIComponent(passId)}/transfer-check`, { recipient }),
  fund: (signed: Signed) => request<{ wallet: string }>('/api/fund', signed),
  checkinStart: (passId: string, signed: Signed) => request<{ id: string; code: string; seed: string; attempt: number }>('/api/checkin/start', { passId, ...signed }),
  checkinJoin: (code: string, pin: string) =>
    request<{ id: string; seed: string; attempt: number; doorToken: string; holder: string; tier: string }>('/api/checkin/join', { code, pin }),
  checkinStatus: (id: string) => request<CheckinResult>(`/api/checkin/${id}`),
  checkinReport: (id: string, report: Record<string, unknown>) => request<object>(`/api/checkin/${id}/report`, report),
  checkinRetry: (id: string, proof: Record<string, unknown>) => request<object>(`/api/checkin/${id}/retry`, proof),
}

const POLL_MS = 250
const RESULT_WAIT_MS = 30_000
const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms))

/** The holder's phone waits here until the door joins, and both start recording. */
export async function waitUntilRunning(id: string, keepGoing: () => boolean) {
  while (keepGoing()) {
    // A lost connection keeps waiting, but a session the server no longer has can never start.
    const { state } = await api.checkinStatus(id).catch((err: Error) => ({ state: err.message === 'session_not_found' ? 'expired' : 'waiting' }))
    if (state !== 'waiting') return state
    await sleep(POLL_MS)
  }
  return 'expired'
}

/** After a failed try, both phones wait here. Either phone tapping Try again starts the next try on both. */
export async function waitForNextAttempt(id: string, attempt: number, keepGoing: () => boolean) {
  while (keepGoing()) {
    const result = await api.checkinStatus(id).catch(() => null)
    if (result?.state === 'running' && (result.attempt ?? 0) > attempt && result.seed) return { attempt: result.attempt!, seed: result.seed }
    await sleep(POLL_MS)
  }
  return null
}

/** Both phones wait here for the server's decision. */
export async function waitForResult(id: string): Promise<CheckinResult> {
  const deadline = Date.now() + RESULT_WAIT_MS
  while (Date.now() < deadline) {
    const result = await api.checkinStatus(id).catch(() => null)
    if (result && result.state !== 'running' && result.state !== 'saving') return result
    await sleep(POLL_MS)
  }
  return { state: 'expired' }
}
