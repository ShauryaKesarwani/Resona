import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { WarningCircleIcon } from '@phosphor-icons/react'
import { Figure } from '../components/Figure'
import { Button } from '../components/Button'
import { Screen, TopBar } from '../components/Screen'
import { WorldStep } from '../components/WorldStep'
import { api } from '../services/api'
import { continueAsGuest, markSignedIn, saveWorldSession, signedBy, worldSession } from '../services/auth'
import { walletAddress } from '../utils/wallet'

const MESSAGES: Record<string, string> = {
  wrong_wallet: 'This proof belongs to a different wallet.',
  wrong_session: 'This World ID session belongs to a different account.',
  no_session: 'This account has no World ID session yet.',
  no_account: 'This wallet has no account yet.',
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
  const enter = () => {
    markSignedIn()
    navigate(/^\/(?!\/)/.test(next) ? next : '/wallet', { replace: true })
  }
  const enterUnverified = () => {
    continueAsGuest()
    navigate(/^\/(?!\/)/.test(next) ? next : '/wallet', { replace: true })
  }
  const session = worldSession()

  if (taken) {
    return (
      <Screen>
        <TopBar back="/" title="Sign in" right={null} />
        <section className="flex flex-1 flex-col justify-center gap-4" role="alert">
          <WarningCircleIcon size={48} className="text-danger" aria-hidden="true" />
          <h1 className="heading-4">You already have an account</h1>
          <p className="body-3 text-text-muted">
            This World ID may have already been used to sign up. If you have access to your old Resona account, you can move it here.
          </p>
          <Button to="/account-transfer">Move an existing account</Button>
          <Button variant="secondary" onClick={enterUnverified}>Continue without World ID</Button>
        </section>
      </Screen>
    )
  }

  return (
    <Screen>
      <TopBar back="/" title="Sign in" right={null} />
      <Figure ratio="16 / 7" position="50% 45%" />
      <h1 className="heading-4 mt-2">{session ? 'Welcome back' : 'Open your account'}</h1>
      <p className="body-3 text-text-muted">
        {session
          ? 'Approve in World ID to sign in. It proves you are the same person, without sharing who you are.'
          : 'Continue without World ID for testing, or verify to use World-protected features.'}
      </p>
      <div className="flex-1" />
      <WorldStep
        signal={wallet}
        messages={MESSAGES}
        session={session}
        submit={async (result) => {
          if (session) return api.login(await signedBy('login'), result)
          await api.signup(await signedBy('signup'), result)
          if ('session_id' in result && result.session_id) saveWorldSession(result.session_id)
        }}
        onDone={enter}
        onCode={(code) => {
          if (!REPEAT_CODES.has(code)) return false
          setTaken(true)
          return true
        }}
      />
      <Button variant="secondary" size="md" onClick={enterUnverified}>Continue without World ID</Button>
      <Button variant="secondary" size="md" to="/account-transfer">Move an existing account</Button>
    </Screen>
  )
}
