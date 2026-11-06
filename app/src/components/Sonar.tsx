import { useEffect, useState } from 'react'

/** Rings leave this phone while it listens. With reduced motion they stand still as three outlines. */
export function SonarRings({ label }: { label: string }) {
  return (
    <div role="img" aria-label={label} className="relative mx-auto grid size-64 place-items-center">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="animate-sonar absolute inset-0 rounded-full border border-accent opacity-40"
          style={{ animationDelay: `${i * 800}ms`, scale: 1 - i * 0.28 }}
        />
      ))}
      <span className="size-4 rounded-full bg-accent" />
    </div>
  )
}

/** Two phones as two dots. The gap between them is the measured distance. */
export function DistanceGap({ cm, good }: { cm: number; good: boolean }) {
  const [settled, setSettled] = useState(false)
  useEffect(() => {
    const frame = requestAnimationFrame(() => setSettled(true))
    return () => cancelAnimationFrame(frame)
  }, [])
  const half = Math.max(16, (Math.min(cm, 100) / 100) * 128)
  const x = settled ? half : 128
  const dot = 'absolute top-1/2 left-1/2 -mt-3 -ml-3 size-6 rounded-full transition-transform duration-700 ease-base'
  return (
    <div role="img" aria-label={`The phones are ${Math.round(cm)} centimetres apart`} className="relative mx-auto h-28 w-80 max-w-full">
      <span className="absolute top-1/2 left-1/2 -ml-32 h-px w-64 bg-line transition-transform duration-700 ease-base" style={{ transform: `scaleX(${x / 128})` }} />
      <span className={`${dot} bg-text`} style={{ transform: `translateX(${-x}px)` }} />
      <span className={`${dot} ${good ? 'bg-accent' : 'bg-danger'}`} style={{ transform: `translateX(${x}px)` }} />
      <span className={`title-2 absolute bottom-0 left-1/2 -translate-x-1/2 font-mono whitespace-nowrap tabular-nums ${good ? 'text-accent' : 'text-danger'}`}>
        {Math.round(cm)}&nbsp;cm
      </span>
    </div>
  )
}
