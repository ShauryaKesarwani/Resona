import { useState, type MouseEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowsLeftRightIcon,
  FingerprintIcon,
  TrophyIcon,
  WaveformIcon,
} from '../../components/icons'
import { Button } from '../../components/Button'
import { HeroBackdrop } from '../../components/Figure'
import { Panel, Section } from './Section'

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
        <h1 className="heading-3 sm:heading-2 text-hero">Tickets that only work when you are at the door</h1>
        <div className="flex w-full flex-col items-center gap-4 lg:items-stretch">
          <p className="body-3 max-w-prose text-text-muted">
            Resona checks your phone against the door phone using sound. A screenshot or a stream arrives too late, and
            organizers decide who can hold each ticket.
          </p>
          <div className="mt-2 flex w-full max-w-sm flex-col gap-2 lg:max-w-none">
            <Button to="/wallet" onLinkClick={openWallet} aria-disabled={leaving}>
              Open your wallet
            </Button>
            <p className="caption-2 text-text-muted">Built on ENS, Arkiv and World ID</p>
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
  { name: 'ENS', job: 'Each pass is a name the holder owns. The contract blocks transfers on locked tiers.' },
  { name: 'Arkiv', job: 'Tickets and check ins live where anyone can verify them, not only on our server.' },
  { name: 'World ID', job: 'One person gets one claim per event, and we never collect who they are.' },
]

export function BuiltOn() {
  return (
    <Section className="py-8! lg:py-12!">
      <h2 className="heading-5 mb-6">What each layer does</h2>
      <dl className="grid gap-6 sm:grid-cols-3">
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

const today = [
  {
    how: 'A QR code at the door',
    beaten: 'The holder streams the code over a video call and someone else scans in.',
    answer: 'The code only names the ticket. Your phone still has to answer with sound.',
  },
  {
    how: 'Bluetooth proximity',
    beaten: 'A relay forwards the radio signal, so a far phone looks near.',
    answer: 'We skip radio. Sound is far slower, so any relay delay shows up as distance.',
  },
  {
    how: 'Cheap or allocated tickets',
    beaten: 'Bots collect them and resell at a markup.',
    answer: 'World ID limits claims to one per person, and the organizer approves every transfer.',
  },
]

export function Problem() {
  return (
    <Section>
      <div className="grid gap-8 lg:grid-cols-[1fr_1.4fr] lg:gap-12">
        <h2 className="heading-4 lg:heading-3 max-w-[680px]">A QR code can be shared. Sound has to cross the room.</h2>
        <ul className="flex flex-col gap-2">
          {today.map((t) => (
            <li key={t.how}>
              <Panel>
                <h3 className="title-3">{t.how}</h3>
                <p className="body-6 mt-1 text-text-muted">{t.beaten}</p>
                <p className="body-5 mt-3 text-accent">{t.answer}</p>
              </Panel>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  )
}

const benefits = [
  {
    icon: WaveformIcon,
    title: 'A stream or screenshot fails',
    body: 'The door measures how far your phone is by sound. A ticket shown over a video call cannot make that sound arrive in time.',
  },
  {
    icon: ArrowsLeftRightIcon,
    title: 'Organizers approve every transfer',
    body: 'Each pass is an ENS name owned by the holder. On locked tiers the contract rejects any transfer the organizer has not approved.',
  },
  {
    icon: FingerprintIcon,
    title: 'One ticket per person',
    body: 'World ID proves you are a unique human once per event, without collecting your identity.',
  },
  {
    icon: TrophyIcon,
    title: 'Proof you were there',
    body: 'Check ins are written to Arkiv. Your profile lists each event and your place through the door, such as 11th.',
  },
]

export function Benefits() {
  return (
    <Section>
      <h2 className="heading-4 lg:heading-3 mb-8 max-w-[680px]">What changes for the door and for the crowd</h2>
      <div className="grid gap-2 md:grid-cols-3">
        {benefits.map((b, i) => (
          <Panel key={b.title} className={i === 0 || i === 3 ? 'md:col-span-2' : ''}>
            <b.icon size={24} className="text-accent" aria-hidden="true" />
            <h3 className="title-2 mt-3">{b.title}</h3>
            <p className="body-6 mt-1 max-w-prose text-text-muted">{b.body}</p>
          </Panel>
        ))}
      </div>
    </Section>
  )
}

const steps = [
  { title: 'Issue', body: 'The organizer enters ENS names and picks a tier. Each person gets a pass in their wallet.' },
  { title: 'Claim', body: 'Open the wallet and prove you are human with World ID. A second claim by the same person is rejected.' },
  { title: 'Check in', body: 'Hold your phone close to the door phone. The distance is measured and a pass is recorded.' },
]

export function How() {
  return (
    <Section id="how">
      <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:gap-12">
        <ol className="order-2 flex flex-col gap-2 lg:order-1">
          {steps.map((s, i) => (
            <li key={s.title}>
              <Panel>
                <div className="flex gap-4">
                  <span
                    aria-hidden="true"
                    className="title-2 grid size-10 shrink-0 place-items-center rounded-full border border-line bg-surface-high font-mono"
                  >
                    {i + 1}
                  </span>
                  <div>
                    <h3 className="title-2">{s.title}</h3>
                    <p className="body-6 mt-1 text-text-muted">{s.body}</p>
                  </div>
                </div>
              </Panel>
            </li>
          ))}
        </ol>
        <h2 className="heading-4 lg:heading-3 order-1 max-w-[680px] lg:order-2">Three steps from invite to the door</h2>
      </div>
    </Section>
  )
}
