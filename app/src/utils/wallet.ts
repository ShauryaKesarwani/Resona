import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'

const WALLET_KEY = 'resona.walletKey'

/** Each user's wallet: a private key created on first open, which never leaves this device. */
function walletAccount() {
  let key = localStorage.getItem(WALLET_KEY) as `0x${string}` | null
  if (!key) {
    key = generatePrivateKey()
    localStorage.setItem(WALLET_KEY, key)
  }
  return privateKeyToAccount(key)
}

export const walletAddress = () => walletAccount().address.toLowerCase()

export const signWithWallet = (message: string) => walletAccount().signMessage({ message })
