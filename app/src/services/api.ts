import type { IDKitResult, RpContext } from '@worldcoin/idkit'

export type ServerTicket = { passId: string; holder: string; tier: string; status: 'issued' | 'claimed' | 'skipped' }
export type WorldConfig = {
  appId: `app_${string}`
  action: string
  environment: 'production' | 'staging'
  allowSkip: boolean
}

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

export const api = {
  config: () => request<WorldConfig>('/api/config'),
  sign: () => request<RpContext>('/api/world/sign', {}),
  tickets: (holder: string) => request<ServerTicket[]>(`/api/tickets?holder=${holder}`),
  issue: (holder: string, tier: string) => request<ServerTicket>('/api/issue', { holder, tier }),
  claim: (passId: string, wallet: string, idkitResponse: IDKitResult) =>
    request<ServerTicket>('/api/claim', { passId, wallet, idkitResponse }),
  skip: (passId: string, wallet: string) => request<ServerTicket>('/api/claim/skip', { passId, wallet }),
}
