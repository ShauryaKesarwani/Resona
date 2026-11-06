import {
  CaretDownIcon,
  CheckCircleIcon,
  CopyIcon,
  DeviceMobileIcon,
  MinusCircleIcon,
  QrCodeIcon,
  RobotIcon,
  VideoCameraIcon,
  WarningCircleIcon,
} from '@phosphor-icons/react'
import type { Icon } from '@phosphor-icons/react'
import { Link } from 'react-router-dom'
import { Button } from '../../components/Button'
import { Figure } from '../../components/Figure'
import { Panel, Section } from './Section'

type Status = 'stopped' | 'planned' | 'open'
const statusLook: Record<Status, { label: string; icon: Icon; cls: string }> = {
  stopped: { label: 'Stopped in the demo', icon: CheckCircleIcon, cls: 'text-success' },
  planned: { label: 'Planned', icon: WarningCircleIcon, cls: 'text-accent' },
  open: { label: 'Not stopped', icon: MinusCircleIcon, cls: 'text-danger' },
}

const attacks: { icon: Icon; title: string; body: string; status: Status }[] = [
  { icon: QrCodeIcon, title: 'A QR code streamed over a video call', body: 'The code only names the ticket. The sound check still needs your phone at the door.', status: 'stopped' },
  { icon: VideoCameraIcon, title: 'Sound relayed over Meet or Discord', body: 'The delay shows up as distance, so a relay looks metres away and fails.', status: 'stopped' },
  { icon: CopyIcon, title: 'A forwarded ticket or copied wallet', body: 'The ticket will be locked to the key of the phone that claimed it.', status: 'planned' },
  { icon: RobotIcon, title: 'A modified app that fakes the timing', body: 'Needs the native app with hardware keys and attestation, which comes after the demo.', status: 'planned' },
  { icon: DeviceMobileIcon, title: 'Lending your unlocked phone', body: 'Resona proves the holder’s phone is at the door, not who carries it. The avatar on the staff screen helps.', status: 'open' },
]

export function Limits() {
  return (
    <Section id="limits">
      <h2 className="heading-4 lg:heading-3 max-w-[680px]">What the demo stops, and what it does not</h2>
      <p className="body-3 mt-2 max-w-[680px] text-text-muted">
        Distances and thresholds are design targets until we test on real phones.
      </p>
      <ul className="mt-8 grid gap-2 md:grid-cols-2">
        {attacks.map((a) => {
          const s = statusLook[a.status]
          return (
            <li key={a.title}>
              <Panel>
                <div className="flex items-start gap-3">
                  <a.icon size={24} className="mt-0.5 shrink-0 text-text-muted" aria-hidden="true" />
                  <div>
                    <h3 className="title-3">{a.title}</h3>
                    <p className="body-6 mt-1 text-text-muted">{a.body}</p>
                    <p className={`caption-1 mt-3 flex items-center gap-1 ${s.cls}`}>
                      <s.icon size={16} aria-hidden="true" />
                      {s.label}
                    </p>
                  </div>
                </div>
              </Panel>
            </li>
          )
        })}
      </ul>
    </Section>
  )
}

const faqs = [
  { q: 'How does the sound check work?', a: 'Your phone and the door phone each play a short sound and record both. Each phone measures the gap between the two sounds, and the server turns that into a distance. Sound travels about 343 metres a second, so any delay on the line shows up as extra distance.' },
  { q: 'What if the room is loud or my speaker is broken?', a: 'Staff can admit you by hand after checking your ID. Every manual entry is logged against the staff member, so organizers can audit it.' },
  { q: 'Do I need crypto or a wallet app?', a: 'No. Resona creates a wallet in your browser the first time you open it. This demo runs on the Sepolia test network, so no real money is involved.' },
  { q: 'Does it work on iPhone?', a: 'The demo is built for Chrome on Android. iPhone support needs a native app, which comes after the hackathon.' },
  { q: 'Can I lend my ticket to a friend?', a: 'Moving a ticket to someone else needs the organizer’s approval, and the contract rejects any other transfer. You could still hand your unlocked phone to someone at the door, because Resona proves the phone is there and not who carries it.' },
  { q: 'Can I resell my ticket?', a: 'Only if the organizer allows it for your ticket tier, and only through an approved transfer.' },
  { q: 'What is public?', a: 'ENS names and Arkiv records are public, so a pass shows its holder’s wallet and the event it belongs to. Your email, audio recordings and World ID proof stay off the public record.' },
  { q: 'What if I lose my phone?', a: 'The organizer can move your ticket to your new phone. You prove you are the same person with World ID on the new phone, and the old phone’s key stops working.' },
]

export function Faq() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  }
  return (
    <Section id="faq">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <div className="grid gap-8 lg:grid-cols-[1fr_1.6fr] lg:gap-12">
        <h2 className="heading-4 lg:heading-3 max-w-[680px]">Questions people ask first</h2>
        <div className="flex flex-col gap-2">
          {faqs.map((f) => (
            <details key={f.q} className="group rounded-2xl border border-line bg-surface-raised">
              <summary className="title-3 flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 rounded-2xl px-4 py-3 [&::-webkit-details-marker]:hidden">
                {f.q}
                <CaretDownIcon
                  size={20}
                  aria-hidden="true"
                  className="shrink-0 text-text-muted transition duration-300 ease-base group-open:rotate-180"
                />
              </summary>
              <p className="body-6 px-4 pb-4 text-text-muted">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </Section>
  )
}

export function FinalCta() {
  return (
    <Section>
      <Panel>
        <div className="grid items-center gap-6 lg:grid-cols-2 lg:gap-12">
          <Figure ratio="16 / 9" variant="mono" position="50% 45%" className="rounded-lg!" />
          <div className="flex flex-col gap-4 p-2">
            <h2 className="heading-4 lg:heading-3">Walk in with your phone</h2>
            <p className="body-3 text-text-muted">Free to try on the Sepolia test network. No payment and no real money.</p>
            <Button to="/enter">Open your wallet</Button>
          </div>
        </div>
      </Panel>
    </Section>
  )
}

export function Footer() {
  return (
    <footer className="px-4 pt-8 pb-[max(32px,env(safe-area-inset-bottom))] sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 border-t border-line pt-8 sm:flex-row sm:items-center sm:justify-between">
        <p className="caption-2 text-text-muted">Resona is a hackathon demo built for ETHGlobal Mumbai.</p>
        <nav aria-label="Legal" className="flex gap-2">
          <Link to="/privacy" className="body-5 rounded-lg px-3 py-3 text-text-muted hover:text-text">
            Privacy
          </Link>
          <Link to="/terms" className="body-5 rounded-lg px-3 py-3 text-text-muted hover:text-text">
            Terms
          </Link>
        </nav>
      </div>
    </footer>
  )
}
