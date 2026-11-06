import { CaretDownIcon } from '../../components/icons'
import { Link } from 'react-router-dom'
import { Button } from '../../components/Button'
import { Figure } from '../../components/Figure'
import { Panel, Section } from './Section'

const faqs = [
  { q: 'How does the sound check work?', a: 'Your phone and the door phone each play a short sound and record both. Each phone measures the gap between the two sounds, and the server turns that into a distance. Sound travels about 343\u00a0metres a second, so any delay on the line shows up as extra distance.' },
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
              <p className="body-6 max-w-prose px-4 pb-4 text-text-muted">{f.a}</p>
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
            <p className="body-3 max-w-prose text-text-muted">Free to try on the Sepolia test network. No payment and no real money.</p>
            <Button to="/wallet">Open your wallet</Button>
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
        <nav aria-label="Footer" className="flex flex-wrap gap-2">
          <Link to="/events" className="body-5 rounded-lg px-3 py-3 text-text-muted hover:text-text">
            Events
          </Link>
          <Link to="/enter" className="body-5 rounded-lg px-3 py-3 text-text-muted hover:text-text">
            Door staff and organizers
          </Link>
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
