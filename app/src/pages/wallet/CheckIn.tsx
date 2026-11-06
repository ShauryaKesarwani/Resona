import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { CheckCircleIcon, DeviceMobileIcon, SpeakerHighIcon, WarningCircleIcon, WaveformIcon } from '../../components/icons'
import { Button } from '../../components/Button'
import { Screen, TopBar } from '../../components/Screen'
import { ordinal, refreshTickets, updateTicket, useTickets } from '../../data/mock'
import { api, waitForResult, waitUntilRunning, type CheckinResult } from '../../services/api'
import { explorerTx } from '../../services/arkiv'
import { signedBy } from '../../services/auth'
import { measure, micError, openMic } from '../../sonar/run'

type Phase = { name: 'ready' } | { name: 'starting' } | { name: 'code'; code: string } | { name: 'running'; step: number } | { name: 'done'; result: CheckinResult }

const steps = ['Playing and listening', 'Checking the distance']

const tips = [
  { icon: SpeakerHighIcon, text: 'Turn the volume all the way up.' },
  { icon: DeviceMobileIcon, text: 'Hold your phone about 30 cm from the door phone, speaker facing it.' },
  { icon: WaveformIcon, text: 'Keep your hand off the speaker and the microphone.' },
]

const START_ERRORS: Record<string, string> = {
  already_checked_in: 'You have already checked in for this event.',
  not_claimed: 'Claim this ticket first.',
  not_verified: 'Sign in with World ID before you check in.',
  ticket_revoked: 'The organizer revoked this ticket.',
  event_ended: 'This event has ended.',
  payment_not_found: 'We could not find the payment for this ticket on chain. Ask the organizer.',
  not_ticket_holder: 'This ticket belongs to a different wallet.',
  ticket_not_found: 'We could not find this ticket on Arkiv.',
}

const fails: Record<string, { title: string; body: string }> = {
  too_far: { title: 'Too far from the door phone', body: 'Move your phone to about 30 cm from the door phone and try again.' },
  no_sound: { title: 'The sound was not heard', body: 'Turn your volume up, move closer and try again.' },
  invalid: { title: 'That reading was not valid', body: 'Hold both phones still and try again.' },
  expired: { title: 'The check took too long', body: 'Start again on both phones.' },
  failed: { title: 'Could not save your check in', body: 'The distance passed, but Arkiv did not confirm it. Ask the door staff.' },
}

/** W4. The holder's side: the wallet proves it is here, then this phone exchanges real sound with the door. */
export default function CheckIn() {
  const { id } = useParams()
  const ticket = useTickets().find((t) => t.id === id)
  const [phase, setPhase] = useState<Phase>({ name: 'ready' })
  const [error, setError] = useState('')
  const alive = useRef(true)
  const back = `/wallet/ticket/${id}`

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  async function start() {
    setError('')
    setPhase({ name: 'starting' })
    let mic: Awaited<ReturnType<typeof openMic>>
    try {
      mic = await openMic()
    } catch (err) {
      setPhase({ name: 'ready' })
      return setError(micError(err))
    }
    try {
      const passId = ticket!.id
      const session = await api.checkinStart(passId, await signedBy(`checkin:${passId}`))
      if (!alive.current) return
      setPhase({ name: 'code', code: session.code })
      const state = await waitUntilRunning(session.id, () => alive.current)
      if (!alive.current) return
      if (state !== 'running') return setPhase({ name: 'done', result: { state: 'expired' } })

      setPhase({ name: 'running', step: 0 })
      const elapsedSeconds = await measure(mic.audio, mic.sampleRate, session.seed, 'holder')
      setPhase({ name: 'running', step: 1 })
      await api.checkinReport(session.id, { role: 'holder', elapsedSeconds, ...(await signedBy(`checkin-report:${session.id}:${elapsedSeconds}`)) }).catch(() => {})
      const result = await waitForResult(session.id)
      if (!alive.current) return
      if (result.state === 'pass') {
        updateTicket(passId, { status: 'checked_in' })
        refreshTickets()
      }
      setPhase({ name: 'done', result })
    } catch (err) {
      setPhase({ name: 'ready' })
      setError(START_ERRORS[(err as Error).message] ?? 'The check did not finish. Try again.')
    } finally {
      await mic.audio.close()
    }
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

  if (phase.name === 'done' && phase.result.state === 'pass') {
    const { cm, ordinal: place, transactionHash } = phase.result
    return (
      <Screen>
        <TopBar back={back} title="Check in" />
        <section className="flex flex-1 flex-col justify-center gap-4" role="status">
          <CheckCircleIcon size={64} className="text-success" aria-hidden="true" />
          <h1 className="heading-3">You are in</h1>
          <p className="body-3 text-text-muted">
            The phones measured <span className="font-mono tabular-nums">{Math.round(cm ?? 0)}&nbsp;cm</span>. You are {ordinal(place ?? 0)} through the door.
          </p>
          {transactionHash && (
            <a href={explorerTx(transactionHash)} target="_blank" rel="noreferrer" className="body-5 inline-flex min-h-12 items-center text-accent">
              See the Arkiv record
            </a>
          )}
        </section>
        <Button to={back}>Back to ticket</Button>
      </Screen>
    )
  }

  if (phase.name === 'done') {
    const { state, cm } = phase.result
    const f = fails[state] ?? fails.expired
    return (
      <Screen>
        <TopBar back={back} title="Check in" />
        <section className="flex flex-1 flex-col justify-center gap-4" role="alert">
          <WarningCircleIcon size={64} className="text-danger" aria-hidden="true" />
          <h1 className="heading-3">{f.title}</h1>
          {state === 'too_far' && cm !== undefined && <p className="title-2 font-mono tabular-nums">{Math.round(cm)}&nbsp;cm</p>}
          <p className="body-3 text-text-muted">{f.body}</p>
        </section>
        <Button onClick={() => setPhase({ name: 'ready' })}>Try again</Button>
      </Screen>
    )
  }

  if (phase.name === 'code') {
    return (
      <Screen>
        <TopBar back={back} title="Check in" />
        <section className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <h1 className="heading-5">Show this to the door</h1>
          <QRCodeSVG value={phase.code} size={220} marginSize={2} className="rounded-xl" aria-label={`QR code for ${phase.code}`} />
          <p className="heading-3 font-mono tabular-nums tracking-widest">{phase.code}</p>
          <p className="body-6 text-text-muted" aria-live="polite">
            Keep this screen open. The sound starts when the door joins.
          </p>
        </section>
      </Screen>
    )
  }

  if (phase.name === 'running') {
    return (
      <Screen>
        <TopBar title="Check in" heading />
        <p className="body-3 text-text-muted">Hold the phones about 30&nbsp;cm apart and keep them still.</p>
        <ol className="flex flex-col gap-2" aria-live="polite">
          {steps.map((s, i) => (
            <li key={s} className={`flex min-h-12 items-center gap-3 rounded-xl border border-line px-4 ${i === phase.step ? 'bg-surface-raised' : 'text-text-muted'}`}>
              <span aria-hidden="true" className={`size-2 rounded-full ${i === phase.step ? 'animate-pulse bg-accent' : i < phase.step ? 'bg-success' : 'bg-surface-high'}`} />
              <span className="body-5">{s}</span>
            </li>
          ))}
        </ol>
      </Screen>
    )
  }

  return (
    <Screen>
      <TopBar back={back} title="Check in" />
      <h1 className="heading-4">Pass&nbsp;{ticket.pass}</h1>
      <p className="body-6 text-text-muted">
        {ticket.event}, {ticket.tier}
      </p>
      <ul className="flex flex-col gap-2">
        {tips.map((t) => (
          <li key={t.text} className="flex items-center gap-3 rounded-xl border border-line px-4 py-3">
            <t.icon size={20} className="shrink-0 text-accent" aria-hidden="true" />
            <span className="body-6">{t.text}</span>
          </li>
        ))}
      </ul>
      <p role={error ? 'alert' : undefined} className="body-6 text-danger empty:hidden">
        {error}
      </p>
      <div className="flex-1" />
      <p className="body-6 text-center text-text-muted">Your phone plays a short sound and listens. Allow the microphone when asked.</p>
      <Button busy={phase.name === 'starting'} onClick={start}>
        {phase.name === 'starting' ? 'Getting ready' : 'Start check in'}
      </Button>
    </Screen>
  )
}
