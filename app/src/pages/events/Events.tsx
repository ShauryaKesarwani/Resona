import { Link } from 'react-router-dom'
import { ArrowRightIcon } from '../../components/icons'
import { EventCardsSkeleton } from '../../components/Skeleton'
import { Screen, TopBar } from '../../components/Screen'
import { SceneHeading } from '../../components/SceneHeading'
import { isUpcoming, type ArkivEvent } from '../../services/arkiv'
import { prettyDate, tokens } from './art'
import { EventImage } from './EventImage'
import { useEvents } from './useEvents'

/** One event: its picture, then date, name and price, with an arrow to open it. */
function EventCard({ event, featured }: { event: ArkivEvent; featured: boolean }) {
  return (
    <Link
      to={`/e/${event.eventId}`}
      aria-label={`${event.eventName}, ${prettyDate(event.eventDate)}, ${tokens(event.priceWei)}`}
      className="group block border-b border-line pb-4 transition duration-300 ease-base active:scale-[0.99]"
    >
      <div className="relative">
        <EventImage eventId={event.eventId} ratio={featured ? '4 / 3' : '16 / 9'} />
      </div>
      <div className="flex items-end justify-between gap-3 pt-4">
        <div>
          <p className="caption-4 mb-2 text-accent">{prettyDate(event.eventDate)}</p>
          <h2 className="heading-4">{event.eventName}</h2>
          <p className="body-5 mt-2 tabular-nums text-text-muted">{tokens(event.priceWei)}</p>
        </div>
        <ArrowRightIcon size={24} aria-hidden="true" className="mb-1 shrink-0 text-accent transition-transform duration-300 ease-base group-hover:translate-x-1 group-active:translate-x-1" />
      </div>
    </Link>
  )
}

/** The attendee's way in: events still on sale. */
export default function Events() {
  const { events, failed } = useEvents()
  const open = events?.filter(isUpcoming).sort((a, b) => a.eventDate.localeCompare(b.eventDate))

  return (
    <Screen tabs>
      <TopBar />
      <SceneHeading title="Events" art="figure" />
      <p className="body-3 max-w-prose text-text-muted">Pick an event and buy a ticket with free test tokens. No real money moves.</p>

      {failed && (
        <p role="alert" className="body-6 text-danger">
          Could not read events from Arkiv. Check your connection, then open this page again.
        </p>
      )}
      {!events && !failed && (
        <EventCardsSkeleton />
      )}
      {open?.length === 0 && <p className="body-6 text-text-muted">No events are on sale right now.</p>}

      <ul className="stagger flex flex-col gap-8">
        {open?.map((e, i) => (
          <li key={e.eventId}>
            <EventCard event={e} featured={i === 0} />
          </li>
        ))}
      </ul>
    </Screen>
  )
}
