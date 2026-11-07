import { useState, type MouseEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/Button'
import { HeroBackdrop } from '../../components/Figure'
import { Section } from './Section'

export function Hero() {
  const navigate = useNavigate()
  const [leaving, setLeaving] = useState(false)
  const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  /** The image pushes in toward the figure and the screen goes black, then the wallet opens. */
  function openWallet(e: MouseEvent<HTMLAnchorElement>) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
    e.preventDefault()
    if (leaving) return
    setLeaving(true)
    setTimeout(() => navigate('/wallet'), reduce ? 350 : 1100)
  }

  return (
    <header className="relative flex min-h-dvh flex-col justify-end overflow-hidden px-4 pt-[calc(max(8px,env(safe-area-inset-top))+80px)] pb-8 sm:px-6 lg:px-8">
      <HeroBackdrop closing={leaving} instant={reduce} />
      <div className="relative z-10 mx-auto flex w-full max-w-[680px] flex-col items-center gap-4 text-center lg:grid lg:max-w-5xl lg:grid-cols-[1.25fr_1fr] lg:items-end lg:gap-12 lg:text-left">
        <h1 className="heading-3 sm:heading-2 text-hero">Your ticket works at the&nbsp;door. <span className="block">Nowhere else.</span></h1>
        <div className="flex w-full flex-col items-center gap-4 lg:items-stretch">
          <p className="body-3 max-w-prose text-text-muted">
            Resona checks your phone against the door phone using sound. A screenshot or a streamed QR code will not get anyone in, and
            organizers decide who can hold each ticket.
          </p>
          <div className="mt-2 flex w-full max-w-sm flex-col gap-2 lg:max-w-none">
            <Button to="/wallet" onLinkClick={openWallet} aria-disabled={leaving}>
              Open your wallet
            </Button>
            <p className="caption-2 text-text-muted">Built on Arkiv and World ID</p>
          </div>
        </div>
      </div>
      <div
        aria-hidden="true"
        className={`pointer-events-none fixed inset-0 z-50 bg-surface ease-base ${
          leaving ? 'opacity-100 duration-[700ms]' : 'opacity-0 duration-300'
        } transition-opacity`}
        style={{ transitionDelay: leaving && !reduce ? '100ms' : '0ms' }}
      />
    </header>
  )
}

const stack = [
  { name: 'Arkiv', job: 'Tickets and check ins live where anyone can verify them, not only on our server.' },
  { name: 'World ID', job: 'One person gets one claim per event, and we never collect who they are.' },
]

export function BuiltOn() {
  return (
    <Section className="py-8! lg:py-12!">
      <h2 className="heading-5 mb-6">Two layers. One job each.</h2>
      <dl className="grid gap-6 sm:grid-cols-2">
        {stack.map((s) => (
          <div key={s.name} className="flex flex-col gap-1">
            <dt className="title-1">{s.name}</dt>
            <dd className="body-6 text-text-muted">{s.job}</dd>
          </div>
        ))}
      </dl>
    </Section>
  )
}
