import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { WarningCircleIcon } from '@phosphor-icons/react'
import { Figure } from '../components/Figure'
import { Screen, TopBar } from '../components/Screen'
import { WorldStep } from '../components/WorldStep'
import { api } from '../services/api'
import { continueAsGuest } from '../services/auth'
import { walletAddress } from '../utils/wallet'

const MESSAGES: Record<string, string> = {
  wrong_wallet: 'This proof belongs to a different wallet.',
  wallet_taken: 'This wallet already belongs to another person.',
  verification_failed: 'World ID could not verify this proof. Try again.',
  arkiv_not_configured: 'Sign up is not available right now. You can skip for now.',
  arkiv_write_failed: 'We could not save your account. Try again in a moment.',
}

/** World can refuse a repeat itself, before the proof ever reaches our server. */
const REPEAT_CODES = new Set(['human_has_account', 'nullifier_replayed', 'max_verifications_reached'])

/** One World ID gets one Resona account, tied to the wallet created on this device. */
export default function SignIn() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [taken, setTaken] = useState(false)
  const wallet = walletAddress()
  const next = params.get('next') ?? ''
  const enter = () => navigate(/^\/(?!\/)/.test(next) ? next : '/enter', { replace: true })

  if (taken) {
    return (
      <Screen>
        <TopBar back="/" title="Sign in" />
        <section className="flex flex-1 flex-col justify-center gap-4" role="alert">
          <WarningCircleIcon size={48} className="text-danger" aria-hidden="true" />
          <h1 className="heading-4">You already have an account</h1>
          <p className="body-3 text-text-muted">
            Each person gets one Resona account, and yours is on another device or browser. Open Resona there to sign in.
          </p>
        </section>
      </Screen>
    )
  }

  return (
    <Screen>
      <TopBar back="/" title="Sign in" />
      <Figure ratio="16 / 7" position="50% 45%" />
      <h1 className="heading-4 mt-2">Sign in with World ID</h1>
      <p className="body-3 text-text-muted">You only do this once. World ID proves you are human without sharing who you are.</p>
      <div className="flex-1" />
      <WorldStep
        signal={wallet}
        messages={MESSAGES}
        submit={(result) => api.signup(wallet, result)}
        onDone={enter}
        onSkip={() => {
          continueAsGuest()
          enter()
        }}
        onCode={(code) => {
          if (!REPEAT_CODES.has(code)) return false
          setTaken(true)
          return true
        }}
      />
    </Screen>
  )
}
