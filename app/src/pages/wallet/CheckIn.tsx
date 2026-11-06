import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { CheckCircleIcon, SpeakerHighIcon, WarningCircleIcon, WaveformIcon, DeviceMobileIcon } from '../../components/icons'
import { SimTag } from '../../components/Bits'
import { Button } from '../../components/Button'
import { Screen, TopBar } from '../../components/Screen'
import { ordinal, recordCheckin, useCheckins, useTickets } from '../../data/mock'

type Phase = 'ready' | 'running' | 'pass' | 'too_far' | 'no_sound'
const steps = ['Waiting for the door phone', 'Playing and listening', 'Measuring the distance']

const tips = [
  { icon: SpeakerHighIcon, text: 'Turn the volume all the way up.' },
  { icon: DeviceMobileIcon, text: 'Hold your phone about 30\u00a0cm from the door phone, speaker facing it.' },
  { icon: WaveformIcon, text: 'Keep your hand off the speaker and the microphone.' },
]

/** W4. The holder's side of the check in. Steps are simulated until Person 1's sonar is wired in. */
export default function CheckIn() {
  const { id } = useParams()
  const ticket = useTickets().find((t) => t.id === id)
  const count = useCheckins().length
  const [phase, setPhase] = useState<Phase>('ready')
  const [step, setStep] = useState(0)
  const back = `/wallet/ticket/${id}`

  useEffect(() => {
    if (phase !== 'running') return
    const t = [setTimeout(() => setStep(1), 1000), setTimeout(() => setStep(2), 2200), setTimeout(() => finish('pass'), 3400)]
    return () => t.forEach(clearTimeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  function finish(r: 'pass' | 'too_far' | 'no_sound') {
    if (r === 'pass' && ticket && ticket.status !== 'checked_in') recordCheckin(ticket.pass, 'sound', { cm: 28 })
    setPhase(r)
  }

  if (!ticket) {
    return (
      <Screen>
        <TopBar back="/wallet" title="Check in" />
        <section className="flex flex-1 flex-col justify-center gap-2" role="alert">
          <h1 className="heading-5">We could not find this ticket</h1>
          <p className="body-3 text-text-muted">Go back to your tickets and pick one from the list.</p>
        </section>
        <Button to="/wallet">Go to your tickets</Button>
      </Screen>
    )
  }

  if (ticket.status === 'issued') {
    return (
      <Screen>
        <TopBar back={back} title="Check in" />
        <section className="flex flex-1 flex-col justify-center gap-2">
          <h1 className="heading-5">Claim this ticket first</h1>
          <p className="body-3 text-text-muted">The door only checks in claimed tickets. Claiming takes about a minute.</p>
        </section>
        <Button to={`/wallet/claim/${ticket.id}`}>Claim ticket</Button>
      </Screen>
    )
  }

  if (phase === 'pass') {
    return (
      <Screen>
        <TopBar back={back} title="Check in" />
        <section className="flex flex-1 flex-col justify-center gap-4" role="status">
          <CheckCircleIcon size={64} className="text-success" aria-hidden="true" />
          <h1 className="heading-3">You are in</h1>
          <p className="body-3 text-text-muted">
            The door measured 28&nbsp;cm and checked Pass&nbsp;{ticket.pass}. You are {ordinal(count)} through the door.
          </p>
          <SimTag>Simulated result, not written to Arkiv</SimTag>
        </section>
        <Button to={back}>Back to ticket</Button>
      </Screen>
    )
  }

  if (phase === 'too_far' || phase === 'no_sound') {
    return (
      <Screen>
        <TopBar back={back} title="Check in" />
        <section className="flex flex-1 flex-col justify-center gap-4" role="alert">
          <WarningCircleIcon size={64} className="text-danger" aria-hidden="true" />
          <h1 className="heading-3">{phase === 'too_far' ? 'Too far from the door phone' : 'The door phone was not heard'}</h1>
          <p className="body-3 text-text-muted">
            {phase === 'too_far'
              ? 'The door measured 212\u00a0cm. Move your phone to about 30\u00a0cm from the door phone and try again.'
              : 'We did not hear the door phone. Turn your volume up, move closer and try again.'}
          </p>
          <SimTag>Simulated result</SimTag>
        </section>
        <Button
          onClick={() => {
            setStep(0)
            setPhase('ready')
          }}
        >
          Try again
        </Button>
      </Screen>
    )
  }

  const running = phase === 'running'
  return (
    <Screen>
      <TopBar back={back} title="Check in" />

      <section className="flex flex-col items-center gap-4 py-4 text-center">
        <div className="relative my-4 grid size-40 place-items-center" aria-hidden="true">
          {running && (
            <>
              <span className="absolute inset-0 animate-ping-soft rounded-full border border-accent" />
              <span className="absolute inset-4 animate-ping-soft rounded-full border border-accent [animation-delay:400ms]" />
            </>
          )}
          <span className="grid size-28 place-items-center rounded-full border border-line bg-surface-raised">
            <span className="heading-3 font-mono">{ticket.pass}</span>
          </span>
        </div>
        <div>
          <h1 className="heading-5">Pass&nbsp;{ticket.pass}</h1>
          <p className="body-6 text-text-muted">Show this number to door staff if they ask for it</p>
        </div>
      </section>

      {!running && (
        <ul className="flex flex-col gap-2">
          {tips.map((t) => (
            <li key={t.text} className="flex items-center gap-3 rounded-xl border border-line px-4 py-3">
              <t.icon size={20} className="shrink-0 text-accent" aria-hidden="true" />
              <span className="body-6">{t.text}</span>
            </li>
          ))}
        </ul>
      )}

      {running && (
        <ol className="flex flex-col gap-2" aria-live="polite">
          {steps.map((s, i) => (
            <li
              key={s}
              className={`flex min-h-12 items-center gap-3 rounded-xl border border-line px-4 transition duration-500 ease-base ${
                i === step ? 'bg-surface-raised' : i < step ? 'text-text-muted' : 'text-text-muted opacity-40'
              }`}
            >
              <span
                aria-hidden="true"
                className={`size-2 rounded-full ${i === step ? 'animate-pulse bg-accent' : i < step ? 'bg-success' : 'bg-surface-high'}`}
              />
              <span className="body-5">{s}</span>
              {i < step && <span className="caption-4 ml-auto text-text-muted">Done</span>}
            </li>
          ))}
        </ol>
      )}

      <SimTag>{running ? 'Simulated check, no sound is played' : 'Simulated, sound is not wired in yet'}</SimTag>
      <div className="flex-1" />

      {!running && (
        <>
          <p className="body-6 text-center text-text-muted">Your phone plays a short sound and listens. Allow the microphone when asked.</p>
          <Button
            onClick={() => {
              setStep(0)
              setPhase('running')
            }}
          >
            Start check in
          </Button>
        </>
      )}
      {running && (
        <section aria-label="Demo control" className="flex flex-col gap-2 rounded-2xl border border-line p-3">
          <p className="caption-1 text-text-muted">Demo control: end the check with this result</p>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['pass', 'Pass at 28\u00a0cm'],
                ['too_far', 'Too far, 212\u00a0cm'],
                ['no_sound', 'No door sound'],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => finish(k)}
                className="button-sm min-h-12 rounded-lg border border-line bg-surface-raised px-3 text-text-muted transition duration-300 ease-base hover:bg-surface-inset active:scale-[0.98]"
              >
                {label}
              </button>
            ))}
          </div>
        </section>
      )}
    </Screen>
  )
}
