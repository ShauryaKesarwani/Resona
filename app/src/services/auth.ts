import { useEffect, useState } from 'react'
import { signWithWallet, walletAddress } from '../utils/wallet'
import { api } from './api'

const GUEST_KEY = 'resona.guest'

export const continueAsGuest = () => localStorage.setItem(GUEST_KEY, 'true')

/** Proves this device holds the wallet. The text must match server/src/utils/signature.ts. */
export async function signedBy(purpose: string) {
  const wallet = walletAddress()
  const timestamp = Date.now()
  const signature = await signWithWallet(`Resona ${purpose} ${wallet} ${timestamp}`)
  return { wallet, timestamp, signature }
}

/** Signed in means this wallet has an account on Arkiv. Skipping counts as a guest, for the demo only. */
export function useSignedIn() {
  const [signedIn, setSignedIn] = useState<boolean>()

  useEffect(() => {
    let current = true
    signedBy('login')
      .then(api.session)
      .then(() => current && setSignedIn(true))
      .catch(() => current && setSignedIn(localStorage.getItem(GUEST_KEY) === 'true'))
    return () => {
      current = false
    }
  }, [])

  return signedIn
}
