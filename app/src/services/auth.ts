import { signWithWallet, walletAddress } from '../utils/wallet.ts'

const GUEST_KEY = 'resona.guest'
const SIGNED_IN_KEY = 'resona.signedIn'
const WORLD_SESSION_KEY = 'resona.worldSession'

export const continueAsGuest = () => {
  localStorage.removeItem(SIGNED_IN_KEY)
  localStorage.setItem(GUEST_KEY, 'true')
}
export const markSignedIn = () => {
  localStorage.removeItem(GUEST_KEY)
  localStorage.setItem(SIGNED_IN_KEY, 'true')
}
/** This browser's sign-in state, not an independently verified credential level. */
export const worldSignInStatus = () => localStorage.getItem(SIGNED_IN_KEY) === 'true' && localStorage.getItem(GUEST_KEY) !== 'true'

/** Ends this sign in. The wallet and World session stay, because World ID refuses a second sign up. */
export function signOut() {
  localStorage.removeItem(SIGNED_IN_KEY)
  localStorage.removeItem(GUEST_KEY)
}

/** The World session made at first sign in. Each later sign in proves it again in World App. */
export const worldSession = () => localStorage.getItem(WORLD_SESSION_KEY) as `session_${string}` | null
export const saveWorldSession = (id: string) => localStorage.setItem(WORLD_SESSION_KEY, id)

/** Proves this device holds the wallet. The text must match server/src/utils/signature.ts. */
export async function signedBy(purpose: string) {
  const wallet = walletAddress()
  const timestamp = Date.now()
  const signature = await signWithWallet(`Resona ${purpose} ${wallet} ${timestamp}`)
  return { wallet, timestamp, signature }
}

/** Signed in lasts until sign out, so a reload doesn't send someone back to World App. Skipping is a guest, for the demo only. */
export const useSignedIn = () =>
  localStorage.getItem(SIGNED_IN_KEY) === 'true' || localStorage.getItem(GUEST_KEY) === 'true'
