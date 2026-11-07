import type { CSSProperties } from 'react'

export type Phase = 'attack' | 'answer'

/** `playing` is false on rows that are not the current one, so they rest on their final frame. */
type Art = { phase: Phase; playing: boolean }

const anim = (style: CSSProperties) => ({ transformBox: 'fill-box', transformOrigin: 'center', ...style }) as CSSProperties

/** A small QR code, drawn from a fixed pattern. */
function Qr({ x, y, className }: { x: number; y: number; className: string }) {
  const cells = ['11101', '10011', '11100', '00101', '10111']
  return (
    <g className={className}>
      {cells.flatMap((row, r) =>
        [...row].map((on, c) => (on === '1' ? <rect key={`${r}${c}`} x={x + c * 4} y={y + r * 4} width="3.4" height="3.4" /> : null)),
      )}
    </g>
  )
}

/** The code is copied across a call and reaches the door. Then the door plays a sound, and it dies out long before the far phone. */
export function QrArt({ phase, playing }: Art) {
  const attack = phase === 'attack'
  return (
    <svg viewBox="0 0 200 88" className="w-full overflow-visible" aria-hidden="true">
      <rect x="14" y="16" width="36" height="56" rx="5" className="fill-none stroke-text-muted" />
      <Qr x={22} y={34} className="fill-text-muted" />
      <line x1="56" y1="44" x2="144" y2="44" strokeDasharray="2 5" className="stroke-text-muted" />
      <rect x="150" y="16" width="36" height="56" rx="5" className={`fill-none transition-colors duration-500 ${attack ? 'stroke-danger' : 'stroke-accent'}`} />
      {attack ? (
        <g key="copy" style={{ animation: 'travel-once 1400ms var(--ease-base) forwards', '--travel': '136px' } as CSSProperties}>
          <Qr x={22} y={34} className="fill-danger" />
        </g>
      ) : (
        <g key="rest" transform="translate(136 0)" opacity="0.35">
          <Qr x={22} y={34} className="fill-text-muted" />
        </g>
      )}
      {!attack &&
        [0, 1, 2].map((i) => (
          <circle
            key={i}
            cx="168"
            cy="44"
            r={playing ? 56 : 18 + i * 16}
            className={`fill-none stroke-accent ${playing ? 'animate-sonar' : ''}`}
            style={playing ? anim({ animationDelay: `${i * 500}ms` }) : { opacity: 0.45 - i * 0.12 }}
          />
        ))}
    </svg>
  )
}

/** Radio pulses hop through a relay so fast the far phone looks near. Sound crawls the same line, and a ruler grows with the delay. */
export function RelayArt({ phase, playing }: Art) {
  const attack = phase === 'attack'
  return (
    <svg viewBox="0 0 200 88" className="w-full overflow-visible" aria-hidden="true">
      <line x1="20" y1="36" x2="180" y2="36" className="stroke-text-muted" strokeDasharray="2 5" />
      <circle cx="20" cy="36" r="7" className="fill-none stroke-text-muted" />
      <circle cx="180" cy="36" r="7" className="fill-none stroke-text-muted" />
      <rect x="93" y="29" width="14" height="14" rx="2" transform="rotate(45 100 36)" className={`fill-surface transition-colors duration-500 ${attack ? 'stroke-danger' : 'stroke-text-muted'}`} />
      {attack &&
        [0, 1, 2].map((i) => (
          <circle
            key={i}
            cx="20"
            cy="36"
            r="3"
            className="fill-danger"
            style={{ animation: `travel 600ms linear ${i * 200}ms infinite`, '--travel': '160px' } as CSSProperties}
          />
        ))}
      {!attack && (
        <>
          {playing && <circle cx="20" cy="36" r="3" className="fill-accent" style={{ animation: 'travel 2600ms linear infinite', '--travel': '160px' } as CSSProperties} />}
          <line
            x1="20"
            y1="66"
            x2="180"
            y2="66"
            className="stroke-accent"
            strokeWidth="2"
            style={playing ? { transformBox: 'fill-box', transformOrigin: 'left', animation: 'grow 2600ms linear forwards' } : undefined}
          />
          <line x1="20" y1="60" x2="20" y2="72" className="stroke-accent" />
          <line x1="180" y1="60" x2="180" y2="72" className="stroke-accent" />
        </>
      )}
    </svg>
  )
}

const SEATS = [24, 62, 100, 138, 176]

/** Every ticket flies into one bot. Then each ticket settles over its own person. */
export function BotArt({ phase }: Art) {
  const attack = phase === 'attack'
  return (
    <svg viewBox="0 0 200 88" className="w-full overflow-visible" aria-hidden="true">
      {SEATS.map((x, i) => (
        <rect
          key={`${phase}${x}`}
          x={x - 9}
          y="14"
          width="18"
          height="12"
          rx="2"
          className={attack ? 'fill-none stroke-danger' : 'fill-none stroke-accent'}
          style={
            attack
              ? ({ transformBox: 'fill-box', transformOrigin: 'center', animation: `fly 900ms var(--ease-base) ${i * 140}ms forwards`, '--dx': `${100 - x}px`, '--dy': '46px' } as CSSProperties)
              : undefined
          }
        />
      ))}
      {attack ? (
        <rect x="88" y="58" width="24" height="24" rx="3" className="fill-none stroke-danger" />
      ) : (
        SEATS.map((x) => (
          <g key={x} className="fill-none stroke-accent">
            <circle cx={x} cy="52" r="6" />
            <path d={`M${x - 10} 78 a10 10 0 0 1 20 0`} />
          </g>
        ))
      )}
    </svg>
  )
}
