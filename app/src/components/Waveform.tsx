import { useEffect, useRef, type MutableRefObject } from 'react'
import type { Analysis } from '../sonar/analyze'

const BARS = 96
const AQUA = '#7ed6cf'
const WHITE = 'rgba(255,255,255,0.7)'

function sizeCanvas(canvas: HTMLCanvasElement) {
  const width = canvas.clientWidth * devicePixelRatio
  const height = canvas.clientHeight * devicePixelRatio
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width
    canvas.height = height
  }
  return { width, height, draw: canvas.getContext('2d') }
}

/** The microphone's level, scrolling left as sound arrives. The page feeds it blocks through `feed`. */
export function LiveWave({ feed }: { feed: MutableRefObject<((samples: Float32Array) => void) | null> }) {
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const peaks = new Array<number>(BARS).fill(0)
    let frame = 0
    const paint = () => {
      frame = 0
      const el = canvas.current
      if (!el) return
      const { width, height, draw } = sizeCanvas(el)
      if (!draw) return
      draw.clearRect(0, 0, width, height)
      draw.fillStyle = AQUA
      const slot = width / BARS
      peaks.forEach((p, i) => {
        const h = Math.max(2 * devicePixelRatio, Math.min(1, p * 6) * height)
        draw.fillRect(i * slot + slot * 0.2, (height - h) / 2, slot * 0.6, h)
      })
    }
    feed.current = (samples) => {
      let peak = 0
      for (let i = 0; i < samples.length; i++) peak = Math.max(peak, Math.abs(samples[i]))
      peaks.push(peak)
      peaks.shift()
      if (!frame) frame = requestAnimationFrame(paint)
    }
    paint()
    return () => {
      feed.current = null
      cancelAnimationFrame(frame)
    }
  }, [feed])

  return <canvas ref={canvas} aria-hidden="true" className="block h-24 w-full rounded-xl border border-line bg-surface-raised" />
}

/** What this phone heard: how well each sound matched the recording, with a mark where each one arrived. */
export function TraceChart({ analysis }: { analysis: Analysis }) {
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!canvas.current) return
    const { width, height, draw } = sizeCanvas(canvas.current)
    if (!draw) return
    draw.clearRect(0, 0, width, height)
    const traces = [
      { scores: analysis.holderScores, color: WHITE, arrival: analysis.holder },
      { scores: analysis.doorScores, color: AQUA, arrival: analysis.door },
    ]
    for (const { scores, color, arrival } of traces) {
      const perPixel = Math.max(1, Math.floor(scores.length / width))
      draw.strokeStyle = color
      draw.lineWidth = 1
      draw.beginPath()
      for (let x = 0; x < width; x++) {
        let top = 0
        for (let i = x * perPixel; i < Math.min(scores.length, (x + 1) * perPixel); i++) top = Math.max(top, scores[i])
        draw.moveTo(x, height)
        draw.lineTo(x, height - top * height)
      }
      draw.stroke()
      if (arrival) {
        draw.fillStyle = color
        draw.fillRect(arrival.frame / perPixel - 1, 0, 2 * devicePixelRatio, 8 * devicePixelRatio)
      }
    }
  }, [analysis])

  return (
    <figure className="flex flex-col gap-2">
      <canvas ref={canvas} role="img" aria-label="Where this phone heard each sound" className="block h-24 w-full rounded-xl border border-line bg-surface-raised" />
      <figcaption className="caption-4 flex flex-wrap gap-x-4 text-text-muted">
        <span className="inline-flex items-center gap-1">
          <span className="size-2 rounded-full bg-accent" aria-hidden="true" />
          The door’s sound
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="size-2 rounded-full bg-text" aria-hidden="true" />
          The holder’s sound
        </span>
      </figcaption>
    </figure>
  )
}
