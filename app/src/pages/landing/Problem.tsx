import { useEffect, useRef, useState } from 'react'
import { CheckIcon, XIcon } from '../../components/icons'
import { Section } from './Section'
import { BotArt, QrArt, RelayArt, type Phase } from './ProblemArt'

const rows = [
  {
    how: 'A QR code at the door',
    beaten: 'The holder streams the code over a video call and someone else scans in.',
    answer: 'The code only names the ticket. Your phone still has to answer with sound.',
    Art: QrArt,
    captions: { attack: 'Code copied over a call', answer: 'No sound comes back' },
  },
  {
    how: 'Bluetooth proximity',
    beaten: 'A relay forwards the radio signal, so a far phone looks near.',
    answer: 'We skip radio. Sound is far slower, so any relay delay shows up as distance.',
    Art: RelayArt,
    captions: { attack: 'A relay fakes near', answer: 'Delay reads as distance' },
  },
  {
    how: 'Cheap or allocated tickets',
    beaten: 'Bots collect them and resell at a markup.',
    answer: 'World ID limits claims to one per person, and the organizer approves every transfer.',
    Art: BotArt,
    captions: { attack: 'One bot, every ticket', answer: 'One person, one ticket' },
  },
]

const ATTACK_MS = 2400
const ANSWER_MS = 3000

/**
 * Each way of cheating plays out as a small animation on the center line: first it works, then Resona stops it.
 * One row plays at a time while the section is on screen, and tapping a row jumps to it. With reduced motion every row rests on its answer.
 */
export function Problem() {
  const [row, setRow] = useState(0)
  const [phase, setPhase] = useState<Phase>('attack')
  const [inView, setInView] = useState(false)
  const list = useRef<HTMLUListElement>(null)
  const still = useRef(window.matchMedia('(prefers-reduced-motion: reduce)').matches)

  useEffect(() => {
    if (still.current || !list.current) return
    const seen = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.2 })
    seen.observe(list.current)
    return () => seen.disconnect()
  }, [])

  useEffect(() => {
    if (!inView) return
    const timer = setTimeout(() => {
      if (phase === 'attack') return setPhase('answer')
      setRow((r) => (r + 1) % rows.length)
      setPhase('attack')
    }, phase === 'attack' ? ATTACK_MS : ANSWER_MS)
    return () => clearTimeout(timer)
  }, [inView, row, phase])

  return (
    <Section>
      <h2 className="heading-4 lg:heading-3 mx-auto max-w-[680px] text-center">A QR code can be shared. Sound has to cross the room.</h2>
      <ul ref={list} className="mt-12 border-b border-line lg:mt-16">
        {rows.map((r, i) => {
          const active = inView && i === row
          const shown: Phase = active ? phase : 'answer'
          return (
            <li
              key={r.how}
              onClick={() => {
                if (still.current) return
                setRow(i)
                setPhase('attack')
              }}
              className="relative flex cursor-pointer flex-col gap-6 border-t border-line py-8 lg:py-12"
            >
              {active && (
                <span
                  key={`${row}`}
                  aria-hidden="true"
                  className="absolute inset-x-0 -top-px h-px origin-left bg-accent"
                  style={{ animation: `grow ${ATTACK_MS + ANSWER_MS}ms linear forwards` }}
                />
              )}
              <h3 className="title-1 text-center">{r.how}</h3>
              <div className="grid items-center gap-6 lg:grid-cols-[1fr_16rem_1fr] lg:gap-12">
                <figure className="mx-auto flex w-full max-w-64 flex-col items-center gap-3 lg:order-2">
                  <r.Art phase={shown} playing={active} />
                  <figcaption key={shown} className={`caption-4 animate-rise ${shown === 'attack' ? 'text-danger' : 'text-accent'}`}>
                    {r.captions[shown]}
                  </figcaption>
                </figure>
                <div className="text-center lg:order-1 lg:text-right">
                  <p className={`caption-4 inline-flex items-center gap-1 transition-colors duration-500 ${active && phase === 'attack' ? 'text-danger' : 'text-text-muted'}`}>
                    <XIcon size={14} aria-hidden="true" />
                    How it gets beaten
                  </p>
                  <p className="body-3 mt-2 text-text-muted [text-wrap:balance]">{r.beaten}</p>
                </div>
                <div className="text-center lg:order-3 lg:text-left">
                  <p className={`caption-4 inline-flex items-center gap-1 transition-colors duration-500 ${active && phase === 'attack' ? 'text-text-muted' : 'text-accent'}`}>
                    <CheckIcon size={14} aria-hidden="true" />
                    What Resona does
                  </p>
                  <p className="body-3 mt-2 [text-wrap:balance]">{r.answer}</p>
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </Section>
  )
}
