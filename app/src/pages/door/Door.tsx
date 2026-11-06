import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircleIcon, ClockCounterClockwiseIcon, WarningCircleIcon } from '../../components/icons'
import { Row } from '../../components/Bits'
import { Button } from '../../components/Button'
import { Figure } from '../../components/Figure'
import { QrScanner } from '../../components/QrScanner'
import { Screen, TopBar } from '../../components/Screen'
import { ordinal, short } from '../../data/mock'
import { api, waitForNextAttempt, waitForResult, type CheckinResult } from '../../services/api'
import { explorerTx } from '../../services/arkiv'
import { measure, micError, openMic, problemText } from '../../sonar/run'

const PIN_KEY = 'resona.doorPin'
type Holder = { holder: string; tier: string }
type Phase = { name: 'ready' } | { name: 'scanning' } | { name: 'running'; step: number } | { name: 'done'; result: CheckinResult; who: Holder }

const steps = ['Connecting to the holder’s phone', 'Playing and listening', 'Checking the distance']

const JOIN_ERRORS: Record<string, string> = {
  code_not_found: 'That code is not active. Ask the holder to tap Start check in again.',
  bad_door_pin: 'That door PIN is wrong.',
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
  const [phase, setPhase] = useState<Phase>({ name: 'ready' })
  const [code, setCode] = useState('')
  const [pin, setPin] = useState(() => localStorage.getItem(PIN_KEY) ?? '')
  const [pinRequired, setPinRequired] = useState(false)
  const [error, setError] = useState('')
  const alive = useRef(true)
  const live = useRef<{ close: () => void; id: string; doorToken: string; attempt: number } | null>(null)

  useEffect(() => {
    alive.current = true
    api.config().then((c) => setPinRequired(!!c.doorPinRequired)).catch(() => setError('Could not reach the Resona server.'))
    return () => {
      alive.current = false
      live.current?.close()
    }
  }, [])

  const check = useCallback(async (entered: string) => {
    setError('')
    setPhase({ name: 'running', step: 0 })
    let mic: Awaited<ReturnType<typeof openMic>>
    try {
      mic = await openMic()
    } catch (err) {
      setPhase({ name: 'ready' })
      return setError(micError(err))
    }
    try {
      const session = await api.checkinJoin(entered, localStorage.getItem(PIN_KEY) ?? '')
      let { seed, attempt } = session
      const check = { close: () => void mic.audio.close(), id: session.id, doorToken: session.doorToken, attempt }
      live.current = check
      // The mic stays open between tries, so a retry needs no new code and no new tap on the other phone.
      while (alive.current && live.current === check) {
        setPhase({ name: 'running', step: 1 })
        const measured = await measure(mic.audio, mic.sampleRate, seed, 'door')
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
      await mic.audio.close()
      setPhase({ name: 'ready' })
      setError(JOIN_ERRORS[(err as Error).message] ?? 'The check did not finish. Start again on both phones.')
    }
  }, [])

  const savePin = () => localStorage.setItem(PIN_KEY, pin.trim())
  const next = () => {
    live.current?.close()
    live.current = null
    setCode('')
    setPhase({ name: 'ready' })
  }
  const tryAgain = () => {
    const check = live.current
    if (check) api.checkinRetry(check.id, { doorToken: check.doorToken }).catch(() => setError('Could not start another try.'))
  }
  const scanned = useCallback((value: string) => void check(value.trim()), [check])
  const noCamera = useCallback(() => {
    setPhase({ name: 'ready' })
    setError('The camera is not available here. Type the code instead.')
  }, [])

  function submit(e: FormEvent) {
    e.preventDefault()
    const value = code.trim()
    if (pinRequired && !pin.trim()) return setError('Enter the door PIN.')
    if (!/^\d{6}$/.test(value)) return setError('The code on the holder’s phone has 6 digits.')
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
            <div className="flex items-center gap-3">
              <CheckCircleIcon size={48} className="text-success" aria-hidden="true" />
              <h1 className="heading-3 text-success">Pass</h1>
            </div>
            <div className="rounded-2xl border border-line bg-surface-raised p-2">
              <div className="rounded-lg bg-surface-inset">
                <Row label="Distance">
                  <span className="font-mono tabular-nums">{Math.round(result.cm ?? 0)}&nbsp;cm</span>
                </Row>
                <Row label="Holder">
                  <span className="font-mono">{short(who.holder)}</span>
                </Row>
                <Row label="Place through the door">
                  <span className="tabular-nums">{ordinal(result.ordinal ?? 0)}</span>
                </Row>
              </div>
            </div>
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
    const f = fails[result.state] ?? fails.expired
    return (
      <Screen>
        <TopBar back="/enter" title="Result" />
        <section className="flex flex-1 flex-col justify-center gap-4" role="alert">
          <div className="flex items-center gap-3">
            <WarningCircleIcon size={48} className="text-danger" aria-hidden="true" />
            <h1 className="heading-3 text-danger">Not admitted</h1>
          </div>
          <h2 className="heading-6">{f.title}</h2>
          {result.cm !== undefined && result.state === 'too_far' && (
            <p className="title-2 font-mono tabular-nums">{Math.round(result.cm)}&nbsp;cm</p>
          )}
          {result.state === 'no_sound' && <p className="title-3">{problemText(result.problem)}</p>}
          <p className="body-3 text-text-muted">{f.body}</p>
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
        <p className="body-3 text-text-muted">Hold the phones about 30&nbsp;cm apart and keep them still.</p>
        <ol className="flex flex-col gap-2" aria-live="polite">
          {steps.map((s, i) => (
            <li
              key={s}
              className={`flex min-h-12 items-center gap-3 rounded-xl border border-line px-4 ${
                i === phase.step ? 'bg-surface-raised' : i < phase.step ? 'text-text-muted' : 'text-text-muted'
              }`}
            >
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
      <TopBar back="/enter" />
      {phase.name === 'scanning' ? <QrScanner onCode={scanned} onFail={noCamera} /> : <Figure ratio="16 / 7" position="50% 45%" />}
      <h1 className="heading-4">Ready for the next ticket</h1>
      <p className="body-3 text-text-muted">Ask the holder to tap Start check in, then scan or type their code.</p>

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
        <Link to="/door/recent" className="body-5 flex min-h-12 items-center gap-2 self-center text-text-muted">
          <ClockCounterClockwiseIcon size={20} aria-hidden="true" />
          Recent check ins
        </Link>
        <Button
          type="button"
          variant="secondary"
          size="md"
          onClick={() => {
            if (pinRequired && !pin.trim()) return setError('Enter the door PIN.')
            savePin()
            setError('')
            setPhase(phase.name === 'scanning' ? { name: 'ready' } : { name: 'scanning' })
          }}
        >
          {phase.name === 'scanning' ? 'Stop scanning' : 'Scan ticket'}
        </Button>
        <Button type="submit">Check in</Button>
      </form>
    </Screen>
  )
}
