import { useEffect, useRef, useState } from 'react'
import { Button } from '../components/Button'
import { Screen, TopBar } from '../components/Screen'
import { analyzeRecording, type Analysis, type Problem } from '../sonar/analyze.ts'
import { SonarAudio, type MicSettings } from '../sonar/audio.ts'
import { makeCode, type Role } from '../sonar/codes.ts'
import type { Verdict } from '../sonar/distance.ts'

const RECORD_SECONDS = 6
const PLAY_AT: Record<Role, number> = { door: 1.5, holder: 3 }
const RESULT_WAIT_MS = 8000
const POLL_MS = 250
const DOOR_COLOR = '#7ed6cf'
const HOLDER_COLOR = '#ffc857'

const PROBLEM_TEXT: Record<Problem, string> = {
  'no-door-sound': "Couldn't hear the door's sound. Turn the volume up and hold the phones closer.",
  'no-holder-sound': "Couldn't hear the holder's sound. Turn the volume up and hold the phones closer.",
  overlap: 'The two sounds overlapped. Tap Start on both phones within a second of each other.',
  dropout: 'The browser lost some audio during the test. Try again.',
}

type LabResult = { cm: number; verdict: Verdict }
type HistoryRow = LabResult & { run: number }

function drawScores(canvas: HTMLCanvasElement, analysis: Analysis) {
  const width = canvas.clientWidth * devicePixelRatio
  const height = canvas.clientHeight * devicePixelRatio
  canvas.width = width
  canvas.height = height
  const draw = canvas.getContext('2d')
  if (!draw) return

  const traces = [
    { scores: analysis.doorScores, color: DOOR_COLOR, arrival: analysis.door },
    { scores: analysis.holderScores, color: HOLDER_COLOR, arrival: analysis.holder },
  ]
  for (const { scores, color, arrival } of traces) {
    const perPixel = Math.max(1, Math.floor(scores.length / width))
    draw.strokeStyle = color
    draw.lineWidth = 1
    draw.beginPath()
    for (let x = 0; x < width; x++) {
      let top = 0
      for (let i = x * perPixel; i < Math.min(scores.length, (x + 1) * perPixel); i++) {
        top = Math.max(top, scores[i])
      }
      draw.moveTo(x, height)
      draw.lineTo(x, height - top * height)
    }
    draw.stroke()
    if (arrival) {
      draw.fillStyle = color
      draw.fillRect(arrival.frame / perPixel - 1, 0, 2, 8 * devicePixelRatio)
    }
  }
}

function formatSetting(value: boolean | string | undefined) {
  if (value === undefined) return 'unknown'
  return value ? 'ON' : 'off'
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-text-muted">{label}</dt>
      <dd className="font-mono">{value}</dd>
    </div>
  )
}

/** Developer page for testing sonar between two phones, without tickets or wallets. */
export default function Lab() {
  const [room, setRoom] = useState('lab')
  const [role, setRole] = useState<Role>('door')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [settings, setSettings] = useState<MicSettings | null>(null)
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [result, setResult] = useState<LabResult | null>(null)
  const [history, setHistory] = useState<HistoryRow[]>([])
  const audio = useRef<SonarAudio | null>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const runCount = useRef(0)

  useEffect(() => {
    if (canvas.current && analysis) drawScores(canvas.current, analysis)
  }, [analysis])

  useEffect(
    () => () => {
      void audio.current?.close()
      audio.current = null
    },
    [],
  )

  async function waitForResult(): Promise<LabResult | null> {
    const deadline = Date.now() + RESULT_WAIT_MS
    while (Date.now() < deadline) {
      const response = await fetch(`/api/lab/${encodeURIComponent(room)}`)
      const body = (await response.json()) as { result: LabResult | null }
      if (body.result) return body.result
      await new Promise((done) => setTimeout(done, POLL_MS))
    }
    return null
  }

  async function start() {
    setBusy(true)
    setError('')
    setResult(null)
    setAnalysis(null)
    try {
      let sampleRate = settings?.sampleRate
      if (!audio.current || !sampleRate) {
        setStatus('Opening the microphone…')
        const opened = new SonarAudio()
        const mic = await opened.open()
        setSettings(mic)
        audio.current = opened
        sampleRate = mic.sampleRate
      }

      setStatus(`Recording for ${RECORD_SECONDS} seconds. Hold the phones still.`)
      const recording = await audio.current.run(makeCode(room, role, sampleRate), PLAY_AT[role], RECORD_SECONDS)

      setStatus('Analysing…')
      await new Promise((done) => setTimeout(done, 0))
      const measured = analyzeRecording(recording, room)
      setAnalysis(measured)

      if (measured.elapsedSeconds === null) {
        setError(PROBLEM_TEXT[measured.problem ?? 'dropout'])
        setStatus('')
        return
      }

      setStatus('Waiting for the other phone…')
      const response = await fetch(`/api/lab/${encodeURIComponent(room)}/report`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ role, elapsedSeconds: measured.elapsedSeconds }),
      })
      if (!response.ok) throw new Error('The server rejected the report.')

      const combined = await waitForResult()
      if (!combined) {
        setError("No result from the other phone. Check that it's in the same room, with the other role.")
        setStatus('')
        return
      }
      runCount.current += 1
      const run = runCount.current
      setResult(combined)
      setHistory((rows) => [{ ...combined, run }, ...rows].slice(0, 20))
      setStatus('')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
      setStatus('')
    } finally {
      setBusy(false)
    }
  }

  const processingOn = settings && (settings.echoCancellation || settings.noiseSuppression || settings.autoGainControl)
  const panel = 'rounded-2xl border border-line bg-surface-raised p-4'

  return (
    <Screen>
      <TopBar back="/enter" title="Sonar lab" />
      <p className="body-3 text-text-muted">
        Open this page on two phones. Use the same room, pick different roles, and tap Start on both within a second.
      </p>

      <label className="body-3 flex flex-col gap-1 text-text-muted">
        Room
        <input
          value={room}
          onChange={(event) => setRoom(event.target.value)}
          disabled={busy}
          className="min-h-12 rounded-xl border border-line bg-surface-raised px-3 text-text"
        />
      </label>

      <div className="grid grid-cols-2 gap-2">
        {(['door', 'holder'] as const).map((option) => (
          <Button
            key={option}
            size="md"
            variant="secondary"
            className={role === option ? 'border-accent! text-accent!' : ''}
            aria-pressed={role === option}
            onClick={() => setRole(option)}
            disabled={busy}
          >
            {option === 'door' ? 'Door' : 'Holder'}
          </Button>
        ))}
      </div>

      <Button onClick={start} busy={busy} disabled={!room.trim()}>
        {busy ? 'Running…' : 'Start'}
      </Button>

      {status && <p className="body-3 text-text-muted">{status}</p>}
      {error && <p className="body-3 rounded-xl bg-danger/15 p-3 text-danger">{error}</p>}
      {processingOn && (
        <p className="body-3 rounded-xl bg-surface-warm p-3 text-[#ffc857]">
          This browser kept mic processing on, which can remove or shift the sound. Results may not be reliable.
        </p>
      )}

      {result && (
        <div
          className={`rounded-2xl p-6 text-center ${result.verdict === 'near' ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger'}`}
        >
          <strong className="heading-3 block">{Math.round(result.cm)} cm</strong>
          {result.verdict === 'near' && 'Pass'}
          {result.verdict === 'far' && 'Too far'}
          {result.verdict === 'invalid' && 'Invalid reading, try again'}
        </div>
      )}

      {analysis && (
        <section className={panel}>
          <h2 className="title-3">This phone's recording</h2>
          <canvas ref={canvas} className="mt-2 block h-32 w-full rounded-lg bg-surface" />
          <p className="body-6 mt-1 text-text-muted">
            <span style={{ color: DOOR_COLOR }}>Door's sound</span> and{' '}
            <span style={{ color: HOLDER_COLOR }}>holder's sound</span>. Clear spikes are good.
          </p>
          <dl className="body-5 mt-3 flex flex-col gap-1">
            <Fact label="Door match" value={analysis.door ? analysis.door.score.toFixed(3) : 'not found'} />
            <Fact label="Holder match" value={analysis.holder ? analysis.holder.score.toFixed(3) : 'not found'} />
            <Fact
              label="Elapsed"
              value={analysis.elapsedSeconds === null ? '–' : `${analysis.elapsedSeconds.toFixed(5)} s`}
            />
            <Fact label="Clipped audio" value={`${(analysis.clippedFraction * 100).toFixed(2)}%`} />
          </dl>
        </section>
      )}

      {settings && (
        <section className={panel}>
          <h2 className="title-3">Microphone</h2>
          <dl className="body-5 mt-2 flex flex-col gap-1">
            <Fact label="Echo cancellation" value={formatSetting(settings.echoCancellation)} />
            <Fact label="Noise suppression" value={formatSetting(settings.noiseSuppression)} />
            <Fact label="Auto gain" value={formatSetting(settings.autoGainControl)} />
            <Fact label="Sample rate" value={`${settings.sampleRate} Hz`} />
          </dl>
        </section>
      )}

      {history.length > 0 && (
        <section className={panel}>
          <h2 className="title-3">Readings on this phone</h2>
          <dl className="body-5 mt-2 flex flex-col gap-1">
            {history.map((row) => (
              <Fact key={row.run} label={`Run ${row.run}`} value={`${Math.round(row.cm)} cm, ${row.verdict}`} />
            ))}
          </dl>
        </section>
      )}
    </Screen>
  )
}
