import { useEffect, useRef, useState } from 'react'
import { ArrowsLeftRightIcon, CheckCircleIcon, DeviceMobileIcon, FingerprintIcon, ImageIcon, ProhibitIcon, QrCodeIcon, VideoCameraIcon } from '../../components/icons'
import type { Icon } from '../../components/icons'
import { Aside, Section } from './Section'

const entries: { icon: Icon; attempt: string; why: string; admitted?: boolean }[] = [
  { icon: ImageIcon, attempt: 'A screenshot of a ticket', why: 'A picture cannot answer with sound.' },
  { icon: QrCodeIcon, attempt: 'A QR code on a video call', why: 'The code only names the ticket.' },
  { icon: VideoCameraIcon, attempt: 'Sound relayed over Meet', why: 'The delay reads as 34 m.' },
  { icon: FingerprintIcon, attempt: 'A second claim, same person', why: 'World ID allows one per person.' },
  { icon: ArrowsLeftRightIcon, attempt: 'A ticket sold to a stranger', why: 'Only the organizer can move it.' },
  { icon: DeviceMobileIcon, attempt: 'You, at the door', why: 'Measured 28 cm and recorded on Arkiv.', admitted: true },
]

const STEP_MS = 1100
const HOLD_MS = 4000

/** A door log that fills in line by line: every trick is stopped, then the real holder walks in. */
export function DoorLog() {
  const [shown, setShown] = useState(0)
  const [inView, setInView] = useState(false)
  const log = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return setShown(entries.length)
    if (!log.current) return
    const seen = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.3 })
    seen.observe(log.current)
    return () => seen.disconnect()
  }, [])

  useEffect(() => {
    if (!inView) return
    const done = shown >= entries.length
    const timer = setTimeout(() => setShown(done ? 0 : shown + 1), done ? HOLD_MS : shown === 0 ? 400 : STEP_MS)
    return () => clearTimeout(timer)
  }, [inView, shown])

  const stopped = Math.min(shown, entries.length - 1)
  const admitted = shown === entries.length ? 1 : 0

  return (
    <Section id="stops">
      <h2 className="heading-4 lg:heading-3 mx-auto max-w-[680px] text-center">Fakes stop here. You walk in.</h2>
      <Aside className="mt-2 text-center">nice try though</Aside>
      <div ref={log} className="mx-auto mt-12 max-w-2xl overflow-hidden rounded-2xl border border-line lg:mt-16">
        <div className="flex items-center justify-between gap-4 border-b border-line bg-surface-raised px-4 py-3 lg:px-6">
          <p className="caption-1 flex items-center gap-2">
            <span aria-hidden="true" className="size-2 animate-pulse rounded-full bg-accent" />
            Door log, example
          </p>
          <p className="caption-2 tabular-nums text-text-muted">
            <span key={stopped} className="animate-pop inline-block">{stopped}</span> stopped · <span key={`a${admitted}`} className="animate-pop inline-block text-accent">{admitted}</span> admitted
          </p>
        </div>
        <ol>
          {entries.map((e, i) => {
            const on = i < shown
            return (
              <li
                key={e.attempt}
                className={`flex items-center gap-4 px-4 py-4 transition-[opacity,transform] duration-500 ease-base not-first:border-t not-first:border-line lg:px-6 ${
                  on ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
                } ${e.admitted ? 'bg-surface-raised' : ''}`}
              >
                <e.icon size={24} className={`shrink-0 ${e.admitted ? 'text-accent' : 'text-text-muted'}`} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="title-3">{e.attempt}</p>
                  <p className="body-6 text-text-muted">{e.why}</p>
                </div>
                <span className={`caption-1 inline-flex shrink-0 items-center gap-1 ${on ? 'animate-pop' : 'invisible'} ${e.admitted ? 'text-accent' : 'text-text-muted'}`}>
                  {e.admitted ? <CheckCircleIcon size={20} aria-hidden="true" /> : <ProhibitIcon size={20} aria-hidden="true" />}
                  {e.admitted ? 'Admitted' : 'Stopped'}
                </span>
              </li>
            )
          })}
        </ol>
      </div>
    </Section>
  )
}
