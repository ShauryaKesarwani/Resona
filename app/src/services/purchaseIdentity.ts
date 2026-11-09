/** Payment metadata only: this marker does not prove a World identity. */
export function unverifiedPurchaseId(wallet: string): string {
  return `unverified:${wallet.toLowerCase()}`
}
