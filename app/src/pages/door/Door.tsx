import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ClockCounterClockwiseIcon, WarningCircleIcon } from '../../components/icons'
import { Row } from '../../components/Bits'
import { Button } from '../../components/Button'
import { DistanceGap, SonarRings } from '../../components/Sonar'
import { LiveWave, TraceChart } from '../../components/Waveform'
import type { Analysis } from '../../sonar/analyze'
import { GatewayFlow } from '../../components/GatewayFlow'
import { QrScanner } from '../../components/QrScanner'
import { Screen, TopBar } from '../../components/Screen'
import { ordinal, short } from '../../data/mock'
import { api, waitForNextAttempt, waitForResult, type CheckinResult } from '../../services/api'
import { explorerTx } from '../../services/arkiv'
import { measure, micError, openMic, problemText } from '../../sonar/run'
import { checkinCode } from '../../utils/checkinCode'

const PIN_KEY = 'resona.doorPin'
type Holder = { holder: string; tier: string }
type Phase = { name: 'ready' } | { name: 'scanning' } | { name: 'running'; step: number } | { name: 'done'; result: CheckinResult; who: Holder }

const steps = ['Connecting to the holder’s phone', 'Playing and listening', 'Checking the distance']

const JOIN_ERRORS: Record<string, string> = {
  code_not_found: 'That code has finished or expired. Ask the holder to tap Start check in again.',
  bad_door_pin: 'That door PIN is wrong.',
  check_running: 'This check is already running. Wait for it to finish.',
  door_pin_not_configured: 'The organizer must set a door PIN before selecting a ticket for check-in.',
}

const fails: Record<string, { title: string; body: string }> = {
  too_far: { title: 'Too far away', body: 'Ask the holder to hold their phone about 30 cm from yours, then try again.' },
  no_sound: { title: 'The sound was not heard', body: 'Ask the holder to turn the volume up. Hold the phones closer, then try again.' },
  invalid: { title: 'That reading was not valid', body: 'Hold both phones still, then try again.' },
  expired: { title: 'The check took too long', body: 'The other phone did not finish. Try again.' },
  failed: { title: 'Could not save this check in', body: 'The distance passed, but Arkiv did not confirm it. Do not admit yet. Ask the organizer to check.' },
}

/** D1. The real door: joins the holder's check in, exchanges sound, and shows the server's decision. */
export default function Door() {
  const [params, setParams] = useSearchParams()
  const selectedPass = params.get('passId') ?? ''
  const [phase, setPhase] = useState<Phase>({ name: 'ready' })
  const [code, setCode] = useState('')
  const [pin, setPin] = useState(() => localStorage.getItem(PIN_KEY) ?? '')
  const [pinRequired, setPinRequired] = useState(false)
  const [error, setError] = useState('')
  const [trace, setTrace] = useState<Analysis | null>(null)
  const feed = useRef<((samples: Float32Array) => void) | null>(null)
  const alive = useRef(true)
  const busy = useRef(false)
  const live = useRef<{ close: () => void; id: string; doorToken: string; attempt: number } | null>(null)

  useEffect(() => {
    alive.current = true
    api.config().then((c) => setPinRequired(!!c.doorPinRequired)).catch(() => setError('Could not reach the Resona server.'))
    return () => {
      alive.current = false
      live.current?.close()
    }
  }, [])

  const check = useCallback(async (entered: string, selected = false) => {
    // A double tap must not join twice: the second try would fail and hide the check that is running.
    if (busy.current) return
    busy.current = true
    setError('')
    setPhase({ name: 'running', step: 0 })
    let mic: Awaited<ReturnType<typeof openMic>>
    try {
      mic = await openMic()
    } catch {
      busy.current = false
      setPhase({ name: 'ready' })
      return setError(micError())
    }
    try {
      const session = selected
        ? await api.checkinJoinSelected(entered, localStorage.getItem(PIN_KEY) ?? '')
        : await api.checkinJoin(entered, localStorage.getItem(PIN_KEY) ?? '')
      let { seed, attempt } = session
      const check = { close: () => void mic.audio.close(), id: session.id, doorToken: session.doorToken, attempt }
      live.current = check
      // The mic stays open between tries, so a retry needs no new code and no new tap on the other phone.
      while (alive.current && live.current === check) {
        setPhase({ name: 'running', step: 1 })
        const measured = await measure(mic.audio, mic.sampleRate, seed, 'door', { onBlock: (b) => feed.current?.(b), onAnalysis: setTrace })
        setPhase({ name: 'running', step: 2 })
        await api.checkinReport(session.id, { role: 'door', attempt, doorToken: session.doorToken, ...measured }).catch(() => {})
        const result = await waitForResult(session.id)
        if (!alive.current || live.current !== check) return
        setPhase({ name: 'done', result, who: session })
        if (result.state === 'pass' || result.state === 'failed') return
        const next = await waitForNextAttempt(session.id, attempt, () => alive.current && live.current === check)
        if (!next) return
        ;({ seed, attempt } = next)
        check.attempt = attempt
      }
    } catch (err) {
      busy.current = false
      await mic.audio.close()
      setPhase({ name: 'ready' })
      const reason = (err as Error).message
      setError(selected && reason === 'code_not_found'
        ? 'The holder has not started a check-in for this ticket, or it has expired. Ask them to start again.'
        : JOIN_ERRORS[reason] ?? 'The check did not finish. Start again on both phones.')
    }
  }, [])

  const savePin = () => localStorage.setItem(PIN_KEY, pin.trim())
  const next = () => {
    live.current?.close()
    live.current = null
    busy.current = false
    setCode('')
    setParams({})
    setPhase({ name: 'ready' })
  }
  const tryAgain = () => {
    const check = live.current
    if (check) api.checkinRetry(check.id, { doorToken: check.doorToken }).catch(() => setError('Could not start another try.'))
  }
  const scanned = useCallback((value: string) => {
    const code = checkinCode(value)
    if (!code) {
      setPhase({ name: 'ready' })
      setError('That is not a check-in QR code. Scan the code on the holder’s check-in screen or type its 6 digits.')
      return
    }
    setCode(code)
    void check(code)
  }, [check])
  const noCamera = useCallback(() => {
    setPhase({ name: 'ready' })
    setError('The camera is not available here. Type the code instead.')
  }, [])

  function submit(e: FormEvent) {
    e.preventDefault()
    const value = checkinCode(code)
    if (pinRequired && !pin.trim()) return setError('Enter the door PIN.')
    if (!value) return setError('The code on the holder’s phone has 6 digits.')
    savePin()
    check(value)
  }

  if (phase.name === 'done') {
    const { result, who } = phase
    if (result.state === 'pass') {
      return (
        <Screen>
          <TopBar back="/enter" title="Result" />
          <section className="flex flex-1 flex-col justify-center gap-6" role="status">
            <DistanceGap cm={result.cm ?? 0} good />
            <h1 className="heading-3 text-center text-success">Pass</h1>
            <div className="rounded-2xl border border-line bg-surface-raised p-2">
              <div className="rounded-lg bg-surface-inset">
                <Row label="Holder">
                  <span className="font-mono">{short(who.holder)}</span>
                </Row>
                <Row label="Place through the door">
                  <span className="tabular-nums">{ordinal(result.ordinal ?? 0)}</span>
                </Row>
              </div>
            </div>
            {trace && <TraceChart analysis={trace} />}
            {result.transactionHash && (
              <a href={explorerTx(result.transactionHash)} target="_blank" rel="noreferrer" className="body-5 inline-flex min-h-12 items-center text-accent">
                See the Arkiv record
              </a>
            )}
          </section>
          <Button onClick={next}>Next person</Button>
        </Screen>
      )
    }
    const f = result.state === 'failed' && result.problem
      ? { title: 'Ticket no longer eligible', body: 'The ticket, World eligibility or payment changed during this check. Do not admit. Ask the organizer to check.' }
      : fails[result.state] ?? fails.expired
    return (
      <Screen>
        <TopBar back="/enter" title="Result" />
        <section className="flex flex-1 flex-col justify-center gap-4" role="alert">
          {result.cm !== undefined && result.state === 'too_far' ? (
            <DistanceGap cm={result.cm} good={false} />
          ) : (
            <WarningCircleIcon size={48} className="mx-auto text-danger" aria-hidden="true" />
          )}
          <h1 className="heading-3 text-center text-danger">Not admitted</h1>
          <h2 className="heading-6 text-center">{f.title}</h2>
          {result.state === 'no_sound' && <p className="title-3 text-center">{problemText(result.problem)}</p>}
          <p className="body-3 text-center text-text-muted">{f.body}</p>
          {trace && <TraceChart analysis={trace} />}
        </section>
        {result.state !== 'failed' && <Button onClick={tryAgain}>Try again</Button>}
        <Button variant={result.state === 'failed' ? 'primary' : 'secondary'} size={result.state === 'failed' ? 'lg' : 'md'} onClick={next}>
          Next person
        </Button>
      </Screen>
    )
  }

  if (phase.name === 'running') {
    return (
      <Screen>
        <TopBar title="Checking" heading />
        <section className="flex flex-1 flex-col items-center justify-center gap-8 text-center" aria-live="polite">
          <SonarRings label="Listening for the holder’s phone" />
          <div className="w-full">
            <LiveWave feed={feed} />
            <p className="caption-4 mt-2 text-text-muted">What this microphone hears</p>
          </div>
          <div className="flex flex-col gap-2">
            <p className="heading-4">{steps[phase.step]}</p>
            <p className="body-3 text-text-muted">Hold the phones about 30&nbsp;cm apart and keep them still.</p>
          </div>
        </section>
      </Screen>
    )
  }

  return (
    <Screen>
      <TopBar back="/enter" />
      {phase.name === 'scanning' ? <QrScanner onCode={scanned} onFail={noCamera} /> : <GatewayFlow className="h-40 w-full rounded-2xl border border-line" />}
      <h1 className="heading-4">Ready for the next ticket</h1>
      {selectedPass && <div className="rounded-xl border border-line bg-surface-raised p-4">
        <p className="title-4">Selected ticket</p>
        <p className="caption-5 font-mono text-text-muted [overflow-wrap:anywhere]">{selectedPass}</p>
        <p className="body-6 text-text-muted">Ask the holder to tap Start check in on their phone first.</p>
        <button type="button" className="body-5 min-h-12 text-accent" onClick={() => setParams({})}>Clear selection</button>
      </div>}
      <p className="body-3 text-text-muted">{phase.name === 'scanning' ? 'Point your camera at the QR code on the holder’s check-in screen.' : 'Ask the holder to tap Start check in, then scan their QR code or type its 6 digits.'}</p>

      <form onSubmit={submit} noValidate className="flex flex-1 flex-col gap-4">
        {pinRequired && (
          <label className="flex flex-col gap-2">
            <span className="title-4">Door PIN</span>
            <input
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              onBlur={savePin}
              type="password"
              autoComplete="off"
              className="min-h-14 rounded-xl border border-line bg-surface-raised px-4 text-base"
            />
          </label>
        )}
        <label className="flex flex-col gap-2">
          <span className="title-4">Code on the holder’s phone</span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode="numeric"
            autoComplete="off"
            placeholder="6 digits"
            aria-invalid={!!error}
            className="min-h-14 rounded-xl border border-line bg-surface-raised px-4 font-mono text-base tabular-nums placeholder:text-text-muted"
          />
        </label>
        <p role={error ? 'alert' : undefined} className="body-6 text-danger empty:hidden">
          {error}
        </p>
        <div className="flex-1" />
        {selectedPass && <Button type="button" onClick={() => {
          if (!pinRequired) return setError('The organizer must set a door PIN before selecting a ticket for check-in. Scan or type the code instead.')
          if (!pin.trim()) return setError('Enter the door PIN.')
          savePin()
          void check(selectedPass, true)
        }}>Check in selected ticket</Button>}
        <Link to="/door/recent" className="body-5 flex min-h-12 items-center gap-2 self-center text-text-muted">
          <ClockCounterClockwiseIcon size={20} aria-hidden="true" />
          Recent check ins
        </Link>
        <Button
          type="button"
          variant={phase.name === 'scanning' ? 'secondary' : 'primary'}
          onClick={() => {
            if (pinRequired && !pin.trim()) return setError('Enter the door PIN.')
            savePin()
            setError('')
            setPhase(phase.name === 'scanning' ? { name: 'ready' } : { name: 'scanning' })
          }}
        >
          {phase.name === 'scanning' ? 'Stop scanning' : 'Scan check-in QR code'}
        </Button>
        <Button type="submit" variant="secondary" size="md">Check in with code</Button>
      </form>
    </Screen>
  )
}
