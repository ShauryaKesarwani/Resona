import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Avatar, SimTag, StatusPill } from '../../components/Bits'
import { Button } from '../../components/Button'
import { Screen, TopBar } from '../../components/Screen'
import { findPass, wallet } from '../../data/mock'

export type Outcome = 'pass' | 'too_far' | 'no_sound' | 'not_claimed' | 'already_in'

const steps = ['Waiting for the holder’s phone', 'Playing and listening', 'Measuring the distance']
const forced: { key: Outcome; label: string }[] = [
  { key: 'pass', label: 'Pass at 28\u00a0cm' },
  { key: 'too_far', label: 'Too far, 212\u00a0cm' },
  { key: 'no_sound', label: 'No partner sound' },
  { key: 'not_claimed', label: 'Not claimed' },
  { key: 'already_in', label: 'Already checked in' },
]

/** The result the real sonar would give, from the ticket's own status. */
function natural(status: string): Outcome {
  if (status === 'issued') return 'not_claimed'
  if (status === 'checked_in') return 'already_in'
  return 'pass'
}

/** D2. Live progress while the phones exchange sound. Steps are simulated until Person 1's sonar is wired in. */
export default function Checking() {
  const [q] = useSearchParams()
  const pass = q.get('pass')
  const ticket = findPass(pass)
  const navigate = useNavigate()
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (!ticket) return
    const t = [setTimeout(() => setStep(1), 1000), setTimeout(() => setStep(2), 2200), setTimeout(() => {
      navigate(`/door/result?pass=${ticket.pass}&r=${natural(ticket.status)}`, { replace: true })
    }, 3400)]
    return () => t.forEach(clearTimeout)
  }, [ticket, navigate])

  if (!ticket) {
    return (
      <Screen>
        <TopBar back="/door" title="Checking" />
        <section className="flex flex-1 flex-col justify-center gap-2" role="alert">
          <h1 className="heading-5">No pass selected</h1>
          <p className="body-3 text-text-muted">Go back and type a pass number to start a check in.</p>
        </section>
        <Button to="/door">Back to the door</Button>
      </Screen>
    )
  }

  return (
    <Screen>
      <TopBar back="/door" title="Checking" heading />
      <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface-raised p-4">
        <Avatar name={wallet.name} size={48} />
        <div className="min-w-0 flex-1">
          <p className="title-2 [overflow-wrap:anywhere]">{wallet.name}</p>
          <p className="body-6 text-text-muted">
            Pass&nbsp;{ticket.pass}, {ticket.tier}
          </p>
        </div>
        <StatusPill status={ticket.status} />
      </div>

      <ol className="flex flex-col gap-2" aria-live="polite">
        {steps.map((s, i) => (
          <li
            key={s}
            className={`flex min-h-12 items-center gap-3 rounded-xl border border-line px-4 transition duration-500 ease-base ${
              i === step ? 'bg-surface-raised text-text' : i < step ? 'text-text-muted' : 'text-text-muted opacity-40'
            }`}
          >
            <span
              aria-hidden="true"
              className={`size-2 rounded-full ${i === step ? 'animate-pulse bg-accent' : i < step ? 'bg-success' : 'bg-surface-high'}`}
            />
            <span className="body-5">{s}</span>
            {i < step && <span className="caption-4 ml-auto">Done</span>}
          </li>
        ))}
      </ol>
      <SimTag>Simulated check, no sound is played</SimTag>

      <div className="flex-1" />
      <section aria-label="Demo control" className="flex flex-col gap-2 rounded-2xl border border-line p-3">
        <p className="caption-1 text-text-muted">Demo control: end the check with this result</p>
        <div className="flex flex-wrap gap-2">
          {forced.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => navigate(`/door/result?pass=${ticket.pass}&r=${f.key}`, { replace: true })}
              className="button-sm min-h-12 rounded-lg border border-line bg-surface-raised px-3 text-text-muted transition duration-300 ease-base hover:bg-surface-inset active:scale-[0.98]"
            >
              {f.label}
            </button>
          ))}
        </div>
        <p className="caption-5 text-text-muted">Left alone, the check ends by itself with the result the ticket status gives.</p>
      </section>
    </Screen>
  )
}
