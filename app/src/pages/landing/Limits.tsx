import { CheckCircleIcon, QrCodeIcon, VideoCameraIcon } from '../../components/icons'
import type { Icon } from '../../components/icons'
import { Section } from './Section'

type Item = { icon: Icon; title: string; body: string }

const stopped: Item[] = [
  { icon: QrCodeIcon, title: 'A QR code streamed over a video call', body: 'The code only names the ticket. The sound check still needs your phone at the door.' },
  { icon: VideoCameraIcon, title: 'Sound relayed over Meet or Discord', body: 'The delay shows up as distance, so a relay looks metres away and fails.' },
]

function List({ items }: { items: Item[] }) {
  return (
    <ul className="mt-6 flex flex-col">
      {items.map((it) => (
        <li key={it.title} className="flex gap-4 py-5 first:pt-0 not-first:border-t not-first:border-line">
          <it.icon size={24} className="mt-0.5 shrink-0 text-text-muted" aria-hidden="true" />
          <div className="min-w-0">
            <h4 className="title-3">{it.title}</h4>
            <p className="body-6 mt-1 max-w-prose text-text-muted">{it.body}</p>
          </div>
        </li>
      ))}
    </ul>
  )
}

export function Limits() {
  return (
    <Section id="limits">
      <h2 className="heading-4 lg:heading-3 mx-auto max-w-[680px] text-center">What the demo stops</h2>
      <p className="body-3 mx-auto mt-3 max-w-prose text-center text-text-muted">
        Distances and thresholds are design targets until we test on real phones.
      </p>
      <div className="mx-auto mt-12 max-w-[680px] overflow-hidden rounded-2xl border border-line lg:mt-16">
        <div className="flex flex-col bg-surface p-6 lg:p-10">
          <h3 className="heading-6 flex items-center gap-2 text-success">
            <CheckCircleIcon size={24} aria-hidden="true" />
            Stopped in the demo
          </h3>
          <List items={stopped} />
          <p className="body-6 mt-auto max-w-prose pt-8 text-text-muted">
            Both rest on one fact: sound takes time to cross a room, and a relay only adds more.
          </p>
        </div>
      </div>
    </Section>
  )
}
