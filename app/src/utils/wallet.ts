import { generatePrivateKey, privateKeyToAddress } from 'viem/accounts'

const WALLET_KEY = 'resona.walletKey'

/** Demo wallet: a key created on first open and kept in this browser. */
export function walletAddress(): string {
  let key = localStorage.getItem(WALLET_KEY) as `0x${string}` | null
  if (!key) {
    key = generatePrivateKey()
    localStorage.setItem(WALLET_KEY, key)
  }
  return privateKeyToAddress(key).toLowerCase()
}
