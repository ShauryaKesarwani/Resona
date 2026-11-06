import { useState } from 'react'
import colour from '../assets/figure-colour.webp'
import mono from '../assets/figure-mono.webp'
import vortex from '../assets/hero-vortex.webp'

/**
 * Full bleed hero backdrop: a grayscale vortex with aqua bleeding through the bright streak.
 * `closing` pushes the image in toward the figure while the screen fades to black.
 */
export function HeroBackdrop({ closing, instant }: { closing: boolean; instant: boolean }) {
  const [loaded, setLoaded] = useState(false)
  return (
    <div
      role="img"
      aria-label="A lone figure stands on a dark plain beneath a huge spiral of light streaks curving into a black centre."
      className="pointer-events-none absolute inset-x-0 top-0 h-[58dvh] overflow-hidden brightness-[0.7] lg:h-[min(100dvh,56.25vw)]"
    >
      <img
        src={vortex}
        alt=""
        decoding="async"
        fetchPriority="high"
        onLoad={() => setLoaded(true)}
        className={`size-full object-cover transition-[opacity,transform] duration-[600ms,1400ms] ease-base ${loaded ? 'opacity-100' : 'opacity-0'}`}
        style={{
          objectPosition: '47% 50%',
          transformOrigin: '47% 75%',
          transform: closing && !instant ? 'scale(1.12)' : 'none',
        }}
      />
    </div>
  )
}

/**
 * The primary image: a lone figure on a dark plane with lines of sound curving past.
 * One canvas, cropped per screen with `ratio` and `position`, so a later swap
 * for the two figure version changes no layout.
 */
export function Figure({
  ratio = '4 / 3',
  position = '50% 60%',
  variant = 'colour',
  alt = 'A lone figure stands on a dark plane while glowing lines of sound curve past them.',
  className = '',
}: {
  ratio?: string
  position?: string
  variant?: 'colour' | 'mono'
  alt?: string
  className?: string
}) {
  return (
    <div className={`overflow-hidden rounded-2xl bg-surface ${className}`} style={{ aspectRatio: ratio }}>
      <img
        src={variant === 'colour' ? colour : mono}
        alt={alt}
        decoding="async"
        className="size-full object-cover"
        style={{ objectPosition: position }}
      />
    </div>
  )
}
