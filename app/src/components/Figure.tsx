import colour from '../assets/figure-colour.webp'
import mono from '../assets/figure-mono.webp'

/**
 * Full bleed backdrop: two figures facing each other across the bright wall of lines, dimmed.
 * The left half is the same image mirrored, as a stand in until a real second figure exists.
 * Each half is stretched 25% wider than its box and pinned to the seam, so the seam side is cropped
 * and the pair sits closer together. `closing` slides the halves toward each other.
 */
export function PairBackdrop({ closing, instant }: { closing: boolean; instant: boolean }) {
  const half = (side: 'left' | 'right') => (
    <div
      className="relative h-full overflow-hidden transition-transform duration-[2400ms] ease-base"
      style={{ transform: closing && !instant ? `translateX(${side === 'left' ? '' : '-'}19vw)` : 'none' }}
    >
      <div className={`h-full ${side === 'left' ? '-scale-x-100' : ''}`}>
        <img
          src={colour}
          alt=""
          decoding="async"
          className="absolute top-0 right-0 h-full w-[125%] max-w-none object-cover"
          style={{ objectPosition: '50% 35%' }}
        />
      </div>
    </div>
  )
  return (
    <div
      role="img"
      aria-label="Two figures stand on either side of a bright wall of sound lines, facing each other."
      className="pointer-events-none absolute inset-x-0 top-0 h-[60dvh] overflow-hidden brightness-[0.6] lg:h-[68dvh]"
    >
      <div className="grid h-full grid-cols-2">
        {half('left')}
        {half('right')}
      </div>
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
