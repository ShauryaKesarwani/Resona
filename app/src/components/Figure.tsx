import colour from '../assets/figure-colour.webp'
import mono from '../assets/figure-mono.webp'

/**
 * Two figures facing each other across the bright wall of lines.
 * The left half is the same image mirrored, as a stand in until a real second figure is generated.
 * Replace the left `<img>` with that file and nothing else changes.
 */
export function FigurePair({
  className = '',
  alt = 'Two figures stand on either side of a bright wall of sound lines, facing each other.',
}: {
  className?: string
  alt?: string
}) {
  return (
    <div role="img" aria-label={alt} className={`grid grid-cols-2 overflow-hidden rounded-2xl bg-surface ${className}`}>
      <img src={colour} alt="" decoding="async" className="size-full -scale-x-100 object-cover" style={{ objectPosition: '50% 45%' }} />
      <img src={colour} alt="" decoding="async" className="size-full object-cover" style={{ objectPosition: '50% 45%' }} />
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
