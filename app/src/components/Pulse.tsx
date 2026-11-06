import { useEffect, useRef } from 'react'
import mp4 from '../assets/pulse.mp4'
import poster from '../assets/pulse-poster.jpg'
import webm from '../assets/pulse.webm'

/**
 * The brand's sound waveform, as a looping video in aqua and blue on black.
 * It blends with screen, so the black disappears on any dark surface. It holds still under reduced motion.
 */
export function Pulse({ className = '', still = false }: { className?: string; still?: boolean }) {
  const video = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const el = video.current
    if (!el) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (still || reduced) el.pause()
    else el.play().catch(() => {})
  }, [still])

  return (
    <video
      ref={video}
      aria-hidden="true"
      tabIndex={-1}
      muted
      loop
      playsInline
      autoPlay
      preload="auto"
      poster={poster}
      className={`pointer-events-none mix-blend-screen select-none ${className}`}
    >
      <source src={webm} type="video/webm" />
      <source src={mp4} type="video/mp4" />
    </video>
  )
}
