import colour from '../assets/figure-colour.webp'
import mono from '../assets/figure-mono.webp'

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
