import { formatEther } from 'viem'

/**
 * Each event gets its own picture from the one brand image, zoomed toward a point
 * that comes from the event's id. The same event always looks the same.
 */
export function eventArt(eventId: string) {
  const n = (from: number) => parseInt(eventId.slice(from, from + 4), 16) || 0
  return {
    zoom: 1.3 + (n(0) % 90) / 100,
    origin: `${35 + (n(4) % 40)}% ${45 + (n(8) % 35)}%`,
  }
}

export const tokens = (priceWei: string) => `${formatEther(BigInt(priceWei))} tGLM`

/** 2026-11-06, or a full timestamp, becomes 6 Nov 2026. Anything that is not a date is shown as it is. */
export function prettyDate(date: string) {
  const d = new Date(date.length === 10 ? `${date}T00:00:00Z` : date)
  return Number.isNaN(d.getTime()) ? date : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}
