import { useEffect, useRef } from 'react'

type Ripple = { x: number; y: number; start: number }

const EDGE = [59, 130, 246] // blue at the edges
const CORE = [126, 214, 207] // brand aqua at the pinch
const REFUSED = [229, 115, 107] // danger, when the phones are too far apart
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/**
 * Two fans of dotted streams curve in from the left and right edges and pinch at the middle, like two phones meeting.
 * `gap` pulls the two fans apart, from 0 (touching) to 1 (back at the edges), and `refused` turns their tips red.
 * A tap sends a ripple through the dots. With reduced motion it draws one still frame and ignores taps.
 */
export function GatewayFlow({ className = '', still = false, gap = 0, refused = false }: { className?: string; still?: boolean; gap?: number; refused?: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const target = useRef({ gap, refused: refused ? 1 : 0 })
  const repaint = useRef<() => void>(() => {})
  useEffect(() => {
    target.current = { gap, refused: refused ? 1 : 0 }
    repaint.current()
  }, [gap, refused])

  useEffect(() => {
    const el = canvas.current
    if (!el) return
    const draw = el.getContext('2d')
    if (!draw) return
    const reduced = still || window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const ripples: Ripple[] = []
    let frame = 0
    let width = 0
    let height = 0
    let dpr = 1
    let gapNow = target.current.gap
    let refusedNow = target.current.refused

    const resize = () => {
      dpr = Math.min(devicePixelRatio, 2)
      width = el.clientWidth
      height = el.clientHeight
      el.width = width * dpr
      el.height = height * dpr
    }

    const paint = (now: number) => {
      draw.setTransform(dpr, 0, 0, dpr, 0, 0)
      draw.clearRect(0, 0, width, height)
      const cx = width / 2
      const cy = height / 2
      // Ease toward the wanted state a little every frame. A still frame jumps straight there.
      const ease = reduced ? 1 : 0.06
      gapNow += (target.current.gap - gapNow) * ease
      refusedNow += (target.current.refused - refusedNow) * ease
      const span = cx * (1 - gapNow)
      const core = CORE.map((c, n) => lerp(c, REFUSED[n], refusedNow))
      const streams = width < 480 ? 16 : 26
      const dots = width < 480 ? 34 : 48
      const time = reduced ? 0.35 : now / 1000
      while (ripples.length && now - ripples[0].start > 1800) ripples.shift()

      for (let side = 0; side < 2; side++) {
        const dir = side === 0 ? 1 : -1
        const edgeX = side === 0 ? -8 : width + 8
        for (let i = 0; i < streams; i++) {
          const u = ((i + 0.5) / streams) * 2 - 1
          const y0 = cy + u * height * 0.62
          // A flat run in from the edge, then a pinch toward the middle.
          const p0 = [edgeX, y0]
          const p1 = [edgeX + dir * span * 0.65, y0]
          const p2 = [edgeX + dir * span * 0.75, cy + u * height * 0.07]
          const p3 = [edgeX + dir * (span + 6), cy + u * 3]
          draw.strokeStyle = 'rgba(59,130,246,0.14)'
          draw.lineWidth = 1
          draw.beginPath()
          draw.moveTo(p0[0], p0[1])
          draw.bezierCurveTo(p1[0], p1[1], p2[0], p2[1], p3[0], p3[1])
          draw.stroke()
          for (let k = 0; k < dots; k++) {
            const t = (k / dots + time * (0.05 + (i % 5) * 0.006)) % 1
            const m = 1 - t
            let x = m * m * m * p0[0] + 3 * m * m * t * p1[0] + 3 * m * t * t * p2[0] + t * t * t * p3[0]
            let y = m * m * m * p0[1] + 3 * m * m * t * p1[1] + 3 * m * t * t * p2[1] + t * t * t * p3[1]
            let glow = 0
            for (const r of ripples) {
              const dx = x - r.x
              const dy = y - r.y
              const dist = Math.hypot(dx, dy) || 1
              const off = Math.abs(dist - ((now - r.start) / 1000) * 360)
              if (off < 40) {
                const strength = (1 - off / 40) * (1 - (now - r.start) / 1800)
                x += (dx / dist) * strength * 10
                y += (dy / dist) * strength * 10
                glow = Math.max(glow, strength)
              }
            }
            const edgeToCore = t * t
            const alpha = Math.min(1, 0.55 + edgeToCore * 0.45 + glow)
            const size = 1.6 + edgeToCore * 1.6 + glow * 1.5
            draw.fillStyle = `rgba(${lerp(EDGE[0], core[0], edgeToCore) | 0},${lerp(EDGE[1], core[1], edgeToCore) | 0},${lerp(EDGE[2], core[2], edgeToCore) | 0},${alpha})`
            draw.fillRect(x - size / 2, y - size / 2, size, size)
          }
        }
      }

      // The meeting point.
      const halo = draw.createRadialGradient(cx, cy, 0, cx, cy, Math.min(width, height) * 0.18)
      halo.addColorStop(0, `rgba(126,214,207,${0.35 * (1 - refusedNow)})`)
      halo.addColorStop(1, 'rgba(126,214,207,0)')
      draw.fillStyle = halo
      draw.fillRect(0, 0, width, height)
    }

    const loop = (now: number) => {
      paint(now)
      frame = requestAnimationFrame(loop)
    }

    resize()
    const observer = new ResizeObserver(() => {
      resize()
      if (reduced) paint(0)
    })
    observer.observe(el)
    if (reduced) {
      paint(0)
      repaint.current = () => paint(0)
    } else frame = requestAnimationFrame(loop)

    const tap = (e: PointerEvent) => {
      if (reduced) return
      const box = el.getBoundingClientRect()
      ripples.push({ x: e.clientX - box.left, y: e.clientY - box.top, start: performance.now() })
    }
    el.addEventListener('pointerdown', tap)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      el.removeEventListener('pointerdown', tap)
    }
  }, [still])

  // The fade keeps the streams from being cut off at the canvas edge.
  return <canvas ref={canvas} aria-hidden="true" className={`block ${className}`} style={{ maskImage: 'radial-gradient(ellipse closest-side at center, #000 70%, transparent)' }} />
}
