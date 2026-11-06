import { ArrowDownIcon, ArrowRightIcon } from '../../components/icons'
import { Section } from './Section'

const rows = [
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

/** A before and after table: how each method gets beaten on the left, what Resona does on the right, an arrow between. */
export function Problem() {
  return (
    <Section>
      <h2 className="heading-4 lg:heading-3 mx-auto max-w-[680px] text-center">A QR code can be shared. Sound has to cross the room.</h2>
      <div className="mt-12 lg:mt-16">
        <div className="caption-1 sr-only grid-cols-[1fr_3rem_1fr] gap-x-8 pb-4 text-text-muted lg:not-sr-only lg:grid">
          <span>How it gets beaten today</span>
          <span />
          <span>What Resona does</span>
        </div>
        <ul className="border-b border-line">
          {rows.map((r) => (
            <li key={r.how} className="grid gap-4 border-t border-line py-8 lg:grid-cols-[1fr_3rem_1fr] lg:items-center lg:gap-x-8">
              <div>
                <h3 className="title-1">{r.how}</h3>
                <p className="body-6 mt-2 max-w-prose text-text-muted">{r.beaten}</p>
              </div>
              <span aria-hidden="true" className="grid size-12 place-items-center rounded-full border border-line text-accent lg:mx-auto">
                <ArrowDownIcon size={20} className="lg:hidden" />
                <ArrowRightIcon size={20} className="hidden lg:block" />
              </span>
              <p className="body-3 max-w-prose">{r.answer}</p>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  )
}
