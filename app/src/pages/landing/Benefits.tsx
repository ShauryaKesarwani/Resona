import { ArrowsLeftRightIcon, FingerprintIcon, TrophyIcon, WaveformIcon } from '../../components/icons'
import { Section } from './Section'

const lead = {
  icon: WaveformIcon,
  title: 'Your phone has to be at the door',
  body: 'A screenshot or a streamed QR code will not get anyone in.',
}

const rest = [
  {
    icon: ArrowsLeftRightIcon,
    title: 'Organizers approve every transfer',
    body: 'A ticket only changes hands if the organizer says yes.',
  },
  {
    icon: FingerprintIcon,
    title: 'One ticket per person',
    body: 'World ID stops anyone claiming twice, and Resona stores no personal details.',
  },
  {
    icon: TrophyIcon,
    title: 'Proof you were there',
    body: 'Every check in is recorded, so you can show you attended.',
  },
]

/** The core claim gets the one large block. The three supporting benefits sit beside it as a plain list of equal height. */
export function Benefits() {
  return (
    <Section>
      <h2 className="heading-4 lg:heading-3 mx-auto max-w-[680px] text-center">What changes for the door and for the crowd</h2>
      <div className="mt-12 grid gap-8 lg:mt-16 lg:grid-cols-[1.1fr_1fr] lg:gap-12">
        <div className="flex flex-col justify-center gap-6 rounded-2xl border border-line bg-surface-raised p-8 lg:p-10">
          <span className="grid size-16 place-items-center rounded-full bg-surface-inset text-accent">
            <lead.icon size={32} aria-hidden="true" />
          </span>
          <h3 className="heading-4">{lead.title}</h3>
          <p className="body-3 max-w-prose text-text-muted">{lead.body}</p>
        </div>
        <ul className="flex flex-col justify-between">
          {rest.map((b) => (
            <li key={b.title} className="flex gap-4 py-6 first:pt-0 last:pb-0 not-first:border-t not-first:border-line">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-raised text-accent">
                <b.icon size={20} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h3 className="title-1">{b.title}</h3>
                <p className="body-6 mt-1 max-w-prose text-text-muted">{b.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  )
}
