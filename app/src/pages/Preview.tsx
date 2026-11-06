import { useEffect, useMemo, useRef } from 'react'
import { DistanceGap, SonarRings } from '../components/Sonar'
import { LiveWave, TraceChart } from '../components/Waveform'
import type { Analysis } from '../sonar/analyze'
import { Screen, TopBar } from '../components/Screen'

/** Dev only. The check in visuals in each state, since the real ones need two phones. */
export default function Preview() {
  const feed = useRef<((samples: Float32Array) => void) | null>(null)
  useEffect(() => {
    let t = 0
    const timer = setInterval(() => {
      t++
      const burst = t % 40 > 22 && t % 40 < 30 ? 0.25 : 0.01
      feed.current?.(Float32Array.from({ length: 64 }, () => (Math.random() - 0.5) * burst * 2))
    }, 40)
    return () => clearInterval(timer)
  }, [])
  const analysis = useMemo(() => {
    const spike = (at: number) => Float32Array.from({ length: 6000 }, (_, i) => Math.max(Math.random() * 0.08, Math.exp(-Math.abs(i - at) / 20)))
    return { door: { frame: 1800 }, holder: { frame: 3600 }, doorScores: spike(1800), holderScores: spike(3600) } as unknown as Analysis
  }, [])
  return (
    <Screen>
      <TopBar back="/canvas" title="Check in visuals" />
      <p className="caption-4 text-text-muted">Listening</p>
      <SonarRings label="Sound leaving the phone" />
      <p className="caption-4 text-text-muted">Microphone, live</p>
      <LiveWave feed={feed} />
      <p className="caption-4 text-text-muted">What this phone heard</p>
      <TraceChart analysis={analysis} />
      <p className="caption-4 text-text-muted">Pass at 28 cm</p>
      <DistanceGap cm={28} good />
      <p className="caption-4 text-text-muted">Too far at 74 cm</p>
      <DistanceGap cm={74} good={false} />
    </Screen>
  )
}
