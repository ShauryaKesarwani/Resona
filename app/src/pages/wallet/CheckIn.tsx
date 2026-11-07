import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { DeviceMobileIcon, SpeakerHighIcon, WarningCircleIcon, WaveformIcon } from '../../components/icons'
import { Button } from '../../components/Button'
import { DistanceGap, SonarRings } from '../../components/Sonar'
import { GatewayFlow } from '../../components/GatewayFlow'
import { LiveWave, TraceChart } from '../../components/Waveform'
import type { Analysis } from '../../sonar/analyze'
import { Screen, TopBar } from '../../components/Screen'
import { DetailSkeleton } from '../../components/Skeleton'
import { ordinal, refreshTickets, updateTicket, useTickets, useTicketsState, wallet } from '../../data/mock'
import { api, waitForNextAttempt, waitForResult, waitUntilRunning, type CheckinResult } from '../../services/api'
import { explorerTx } from '../../services/arkiv'
import { signedBy } from '../../services/auth'
import { measure, micError, openMic, problemText } from '../../sonar/run'

type Phase = { name: 'ready' } | { name: 'starting' } | { name: 'code'; code: string } | { name: 'running'; step: number } | { name: 'done'; result: CheckinResult }


const tips = [
  { icon: SpeakerHighIcon, text: 'Turn the volume all the way up.' },
  { icon: DeviceMobileIcon, text: 'Hold your phone about 30 cm from the door phone, speaker facing it.' },
  { icon: WaveformIcon, text: 'Keep your hand off the speaker and the microphone.' },
]

const START_ERRORS: Record<string, string> = {
  already_checked_in: 'You have already checked in for this event.',
  not_claimed: 'Claim this ticket first.',
  not_verified: 'Sign in with World ID before you check in.',
  human_already_claimed: 'Your World account already has a ticket claimed for this event.',
  ticket_revoked: 'The organizer revoked this ticket.',
  event_ended: 'This event has ended.',
  payment_not_found: 'We could not find the payment for this ticket on chain. Ask the organizer.',
  not_ticket_holder: 'This ticket belongs to a different wallet.',
  ticket_not_found: 'We could not find this ticket on Arkiv.',
  ens_pass_not_verified: 'This pass could not be verified for this wallet. Ask the organizer to check it.',
  ens_verification_failed: 'The pass could not be checked, so check in stopped. Try again when the connection is back.',
}

const fails: Record<string, { title: string; body: string }> = {
  too_far: { title: 'Too far from the door phone', body: 'Move your phone to about 30 cm from the door phone and try again.' },
  no_sound: { title: 'The sound was not heard', body: 'Turn your volume up, move closer and try again.' },
  invalid: { title: 'That reading was not valid', body: 'Hold both phones still and try again.' },
  expired: { title: 'The check took too long', body: 'The other phone did not finish. Try again.' },
  failed: { title: 'Could not save your check in', body: 'The distance passed, but Arkiv did not confirm it. Ask the door staff.' },
}

/** W4. The holder's side: the wallet proves it is here, then this phone exchanges real sound with the door. */
export default function CheckIn() {
  const { id } = useParams()
  const ticket = useTickets().find((t) => t.id === id)
  const [phase, setPhase] = useState<Phase>({ name: 'ready' })
  const [error, setError] = useState('')
  const [trace, setTrace] = useState<Analysis | null>(null)
  const feed = useRef<((samples: Float32Array) => void) | null>(null)
  const alive = useRef(true)
  const live = useRef<{ close: () => void; id: string; attempt: number } | null>(null)
  const back = `/wallet/ticket/${id}`
  const state = useTicketsState()

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      live.current?.close()
    }
  }, [])

  async function start() {
    setError('')
    setPhase({ name: 'starting' })
    let mic: Awaited<ReturnType<typeof openMic>>
    try {
      mic = await openMic()
    } catch {
      setPhase({ name: 'ready' })
      return setError(micError())
    }
    try {
      const passId = ticket!.id
      const session = await api.checkinStart(passId, await signedBy(`checkin:${passId}`))
      if (!alive.current) return
      setPhase({ name: 'code', code: session.code })
      const state = await waitUntilRunning(session.id, () => alive.current)
      if (!alive.current) return
      if (state !== 'running') {
        await mic.audio.close()
        return setPhase({ name: 'done', result: { state: 'expired' } })
      }

      let { seed, attempt } = session
      const check = { close: () => void mic.audio.close(), id: session.id, attempt }
      live.current = check
      // The mic stays open between tries, so either phone can start the next one with a single tap.
      while (alive.current) {
        setPhase({ name: 'running', step: 0 })
        const measured = await measure(mic.audio, mic.sampleRate, seed, 'holder', { onBlock: (b) => feed.current?.(b), onAnalysis: setTrace })
        setPhase({ name: 'running', step: 1 })
        const signed = await signedBy(`checkin-report:${session.id}:${attempt}:${measured.elapsedSeconds}`)
        await api.checkinReport(session.id, { role: 'holder', attempt, ...measured, ...signed }).catch(() => {})
        const result = await waitForResult(session.id)
        if (!alive.current) return
        if (result.state === 'pass') {
          updateTicket(passId, { status: 'checked_in' })
          refreshTickets()
        }
        setPhase({ name: 'done', result })
        if (result.state === 'pass' || result.state === 'failed') {
          live.current = null
          return void (await mic.audio.close())
        }
        const next = await waitForNextAttempt(session.id, attempt, () => alive.current)
        if (!next) return
        ;({ seed, attempt } = next)
        check.attempt = attempt
      }
    } catch (err) {
      live.current = null
      await mic.audio.close()
      setPhase({ name: 'ready' })
      setError(START_ERRORS[(err as Error).message] ?? 'The check did not finish. Try again.')
    }
  }

  async function tryAgain() {
    const check = live.current
    if (!check) return setPhase({ name: 'ready' })
    await api.checkinRetry(check.id, await signedBy(`checkin-retry:${check.id}:${check.attempt}`)).catch(() => setError('Could not start another try.'))
  }

  if (!ticket && state === 'loading') {
    return (
      <Screen>
        <TopBar back={back} title="Check in" />
        <DetailSkeleton label="Loading ticket" picture={false} />
      </Screen>
    )
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
        <section className="stagger flex flex-1 flex-col justify-center gap-4" role="status">
          <DistanceGap cm={cm ?? 0} good />
          <h1 className="heading-3 text-center">You are in</h1>
          <p className="body-3 text-center text-text-muted">You are {ordinal(place ?? 0)} through the door.</p>
          {trace && <TraceChart analysis={trace} />}
          {transactionHash && (
            <a href={explorerTx(transactionHash)} target="_blank" rel="noreferrer" className="body-5 inline-flex min-h-12 items-center text-accent">
              See the Arkiv record
            </a>
          )}
        </section>
        <Button to={`/u/${wallet.address}`}>View your trophy</Button>
        <Button variant="secondary" size="md" to={back}>
          Back to ticket
        </Button>
      </Screen>
    )
  }

  if (phase.name === 'done') {
    const { state, cm, problem } = phase.result
    const f = state === 'failed' && problem
      ? { title: 'Ticket no longer eligible', body: START_ERRORS[problem] ?? 'This ticket changed during the check. Ask the organizer before trying again.' }
      : fails[state] ?? fails.expired
    return (
      <Screen>
        <TopBar back={back} title="Check in" />
        <section className="stagger flex flex-1 flex-col justify-center gap-4" role="alert">
          {state === 'too_far' && cm !== undefined ? (
            <DistanceGap cm={cm} good={false} />
          ) : (
            <WarningCircleIcon size={64} className="mx-auto text-danger" aria-hidden="true" />
          )}
          <h1 className="heading-3 text-center">{f.title}</h1>
          {state === 'no_sound' && <p className="title-3 text-center">{problemText(problem)}</p>}
          <p className="body-3 text-center text-text-muted">{f.body}</p>
          {trace && <TraceChart analysis={trace} />}
        </section>
        {state === 'failed' ? <Button to={back}>Back to ticket</Button> : <Button onClick={tryAgain}>Try again</Button>}
      </Screen>
    )
  }

  if (phase.name === 'code') {
    return (
      <Screen>
        <TopBar back={back} title="Check in" right={null} />
        <section className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <h1 className="heading-5">Show this to the door</h1>
          <QRCodeSVG value={phase.code} size={220} marginSize={2} className="rounded-md" aria-label={`QR code for ${phase.code}`} />
          <p className="heading-3 font-mono tabular-nums tracking-widest">{phase.code}</p>
          <GatewayFlow className="h-28 w-full" />
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
        <TopBar title="Check in" heading right={null} />
        <section className="flex flex-1 flex-col items-center justify-center gap-8 text-center" aria-live="polite">
          <SonarRings label="Sound leaving your phone" />
          <div className="w-full">
            <LiveWave feed={feed} />
            <p className="caption-4 mt-2 text-text-muted">What your microphone hears</p>
          </div>
          <div className="flex flex-col gap-2">
            <p className="heading-4">{phase.step === 0 ? 'Listening' : 'Checking the distance'}</p>
            <p className="body-3 text-text-muted">Hold the phones about 30&nbsp;cm apart and keep them still.</p>
          </div>
        </section>
      </Screen>
    )
  }

  return (
    <Screen>
      <TopBar back={back} title="Check in" />
      <header className="flex flex-col gap-1">
        <h1 className="heading-4">Before you check in</h1>
        <p className="body-6 text-text-muted tabular-nums">
          Pass&nbsp;{ticket.pass}, {ticket.event}
        </p>
      </header>
      <div className="border-y border-line py-4">
        <DistanceGap cm={30} good />
        <p className="body-6 text-center text-text-muted">Phones about this far apart, speakers facing each other.</p>
      </div>
      <ul className="flex flex-col">
        {tips.map((t) => (
          <li key={t.text} className="flex items-center gap-3 py-3 not-first:border-t not-first:border-line">
            <t.icon size={20} className="shrink-0 text-accent" aria-hidden="true" />
            <span className="body-5">{t.text}</span>
          </li>
        ))}
      </ul>
      <p role={error ? 'alert' : undefined} className="body-6 text-danger empty:hidden">
        {error}
      </p>
      <div className="flex-1" />
      <p className="body-6 text-center text-text-muted">Next, your phone asks to use the microphone. It only listens for the door’s sound.</p>
      <Button busy={phase.name === 'starting'} onClick={start}>
        {phase.name === 'starting' ? 'Getting ready' : 'Start check in'}
      </Button>
    </Screen>
  )
}
