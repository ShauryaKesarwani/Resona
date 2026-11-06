import { ArrowRightIcon, CheckIcon, XIcon } from '../../components/icons'
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
        <div className="caption-1 hidden grid-cols-[1fr_3rem_1fr] gap-x-8 pb-4 text-text-muted lg:grid">
          <span>How it gets beaten today</span>
          <span />
          <span>What Resona does</span>
        </div>
        <ul className="border-b border-line lg:hidden">
          {rows.map((r) => (
            <li key={r.how} className="border-t border-line py-8">
              <h3 className="title-1">{r.how}</h3>
              <div className="relative mt-6 flex flex-col gap-6 ">
                <div className="relative flex gap-4">
                  <span aria-hidden="true" className="z-10 grid size-6 shrink-0 place-items-center rounded-full border border-line bg-surface text-text-muted">
                    <XIcon size={12} />
                  </span>
                  <div>
                    <p className="caption-4 text-text-muted">How it gets beaten</p>
                    <p className="body-6 mt-1 text-text-muted">{r.beaten}</p>
                  </div>
                </div>
                <div className="relative flex gap-4 before:absolute before:-top-6 before:left-3 before:h-6 before:w-px before:bg-line">
                  <span aria-hidden="true" className="z-10 grid size-6 shrink-0 place-items-center rounded-full bg-accent text-on-accent">
                    <CheckIcon size={14} />
                  </span>
                  <div>
                    <p className="caption-4 text-accent">What Resona does</p>
                    <p className="body-3 mt-1">{r.answer}</p>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
        <ul className="hidden border-b border-line lg:block">
          {rows.map((r) => (
            <li key={r.how} className="grid grid-cols-[1fr_3rem_1fr] items-center gap-x-8 border-t border-line py-8">
              <div>
                <h3 className="title-1">{r.how}</h3>
                <p className="body-6 mt-2 max-w-prose text-text-muted">{r.beaten}</p>
              </div>
              <span aria-hidden="true" className="mx-auto grid size-12 place-items-center rounded-full border border-line text-accent">
                <ArrowRightIcon size={20} />
              </span>
              <p className="body-3 max-w-prose">{r.answer}</p>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  )
}
