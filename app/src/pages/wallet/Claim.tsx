import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { CheckCircleIcon, SkipForwardIcon, WarningCircleIcon } from '../../components/icons'
import { SimTag } from '../../components/Bits'
import { Button } from '../../components/Button'
import { Screen, TopBar } from '../../components/Screen'
import { DetailSkeleton } from '../../components/Skeleton'
import { short, updateTicket, useTickets, useTicketsState, wallet } from '../../data/mock'
import { api } from '../../services/api'
import { signedBy } from '../../services/auth'

type Phase = 'idle' | 'busy' | 'rejected' | 'done'
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** W3. Two steps: confirm name, then claim. The wallet proves who you are, so there is no World ID step here. */
export default function Claim() {
  const { id } = useParams()
  const ticket = useTickets().find((t) => t.id === id)
  const [step, setStep] = useState(1)
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState<string>()
  const [verified, setVerified] = useState(false)
  const back = `/wallet/ticket/${id}`
  const state = useTicketsState()

  if (!ticket && state === 'loading') {
    return (
      <Screen>
        <TopBar back={back} title="Claim ticket" />
        <DetailSkeleton label="Loading ticket" picture={false} />
      </Screen>
    )
  }

  if (!ticket || ticket.past || (ticket.status !== 'issued' && ticket.status !== 'skipped' && phase !== 'done')) {
    return (
      <Screen>
        <TopBar back={back} title="Claim ticket" />
        <section className="flex flex-1 flex-col justify-center gap-2">
          <h1 className="heading-5">{!ticket ? 'We could not find this ticket' : ticket.past ? 'This event has ended' : 'This ticket is already claimed'}</h1>
          <p className="body-3 text-text-muted">Go back to the ticket to see what you can do with it.</p>
        </section>
        <Button to={back}>Back to ticket</Button>
      </Screen>
    )
  }

  async function next(to: number, ms: number) {
    setPhase('busy')
    await wait(ms)
    setPhase('idle')
    setStep(to)
  }

  async function lock() {
    setPhase('busy')
    setError(undefined)
    try {
      const passId = ticket!.id
      const claimed = await api.claim(passId, await signedBy(`claim:${passId}`))
      updateTicket(ticket!.id, { status: claimed.status })
      setVerified(claimed.status === 'claimed')
      setPhase('done')
    } catch (err) {
      if ((err as Error).message === 'human_already_claimed') return setPhase('rejected')
      setPhase('idle')
      setError('We could not claim this ticket. Try again.')
    }
  }

  if (phase === 'done') {
    const skipped = !verified
    return (
      <Screen>
        <TopBar back={back} title="Claim ticket" />
        <section className="flex flex-1 flex-col justify-center gap-4" role="status">
          {skipped ? (
            <SkipForwardIcon size={48} className="text-text-muted" aria-hidden="true" />
          ) : (
            <CheckCircleIcon size={48} className="text-success" aria-hidden="true" />
          )}
          <h1 className="heading-4">{skipped ? 'Verification skipped' : 'Ticket claimed'}</h1>
          <p className="body-3 text-text-muted">
            {skipped
              ? `Pass\u00a0${ticket.pass} is saved to this phone without a World ID check. You can sign in later from the ticket.`
              : `Pass\u00a0${ticket.pass} is locked to this phone. Bring this phone to the door to check in.`}
          </p>
          <SimTag>Simulated phone lock</SimTag>
        </section>
        <Button to={back}>Back to ticket</Button>
      </Screen>
    )
  }

  if (phase === 'rejected') {
    return (
      <Screen>
        <TopBar back={back} title="Claim ticket" />
        <section className="flex flex-1 flex-col justify-center gap-4" role="alert">
          <WarningCircleIcon size={48} className="text-danger" aria-hidden="true" />
          <h1 className="heading-4">This person has already claimed</h1>
          <p className="body-3 text-text-muted">
            This account has already claimed a ticket for {ticket.event}. Each person can claim one ticket per event.
            Ask the organizer if you think this is a mistake.
          </p>
        </section>
        <Button variant="secondary" onClick={() => { setPhase('idle'); setStep(2) }}>
          Try again
        </Button>
        <Button to={back}>Back to ticket</Button>
      </Screen>
    )
  }

  const busy = phase === 'busy'
  return (
    <Screen>
      <TopBar back={back} title="Claim ticket" />
      <div aria-label={`Step ${step} of 2`} className="flex gap-1">
        {[1, 2].map((n) => (
          <span key={n} className={`h-1 flex-1 rounded-full ${n <= step ? 'bg-accent' : 'bg-surface-high'}`} />
        ))}
      </div>
      <p className="caption-1 tabular-nums text-text-muted">Step&nbsp;{step} of&nbsp;2</p>

      {step === 1 && (
        <section className="flex flex-col gap-4">
          <h1 className="heading-4">Confirm your name</h1>
          <p className="body-3 text-text-muted">
            The ticket goes to the wallet your name points to. Check that it matches this phone.
          </p>
          <div className="border-y border-line">
            <div className="flex flex-col gap-1 py-4">
              <p className="title-2">{wallet.name}</p>
              <p className="body-6 font-mono text-text-muted">{short(wallet.address)}</p>
              <p className="caption-1 mt-2 flex items-center gap-1 text-success">
                <CheckCircleIcon size={16} aria-hidden="true" />
                Name points to this wallet
              </p>
            </div>
          </div>
          <SimTag />
        </section>
      )}

      {step === 2 && (
        <section className="flex flex-col gap-4">
          <h1 className="heading-4">Lock to this phone</h1>
          <p className="body-3 text-text-muted">
            After this, the ticket only checks in from this phone. A copy or screenshot on another phone will not work.
          </p>
          {error && <p className="body-3 text-danger" role="alert">{error}</p>}
          <SimTag />
        </section>
      )}

      <div className="flex-1" />

      {step === 1 && (
        <Button busy={busy} onClick={() => next(2, 600)}>
          {busy ? 'Checking name' : 'Confirm name'}
        </Button>
      )}
      {step === 2 && (
        <Button busy={busy} onClick={lock}>
          {busy ? 'Locking ticket' : 'Lock ticket to this phone'}
        </Button>
      )}
    </Screen>
  )
}
