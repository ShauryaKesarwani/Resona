import { Link } from 'react-router-dom'
import { ArrowUpRightIcon, CalendarStarIcon, CaretRightIcon, PlusIcon } from '../../components/icons'
import { AttendeeTabs } from '../../components/AttendeeTabs'
import { WalletChip } from '../../components/Bits'
import { Screen, TopBar } from '../../components/Screen'
import { wallet } from '../../data/mock'
import { isUpcoming, type ArkivEvent } from '../../services/arkiv'
import { prettyDate, tokens } from './art'
import { EventImage } from './EventImage'
import { useEvents } from './useEvents'

const chip = 'caption-4 absolute top-3 flex items-center gap-1 rounded-full border border-line bg-surface px-2 py-1 whitespace-nowrap'

/** An event drawn as a ticket: picture on top, a perforation with notches, and the price on the stub. */
function EventCard({ event, featured }: { event: ArkivEvent; featured: boolean }) {
  return (
    <Link
      to={`/e/${event.eventId}`}
      aria-label={`${event.eventName}, ${prettyDate(event.eventDate)}, ${tokens(event.priceWei)}`}
      className="block overflow-hidden rounded-2xl border border-line bg-surface-raised transition duration-300 ease-base active:scale-[0.99]"
    >
      <div className="relative">
        <EventImage eventId={event.eventId} ratio={featured ? '4 / 3' : '16 / 9'} />
        <span className={`${chip} left-3`}>
          <CalendarStarIcon size={14} aria-hidden="true" />
          {prettyDate(event.eventDate)}
        </span>
        <span className={`${chip} right-3`}>
          <span className="size-2 rounded-full bg-accent" aria-hidden="true" />
          {wallet.network}
        </span>
      </div>
      <h2 className="heading-5 p-4">{event.eventName}</h2>
      <div aria-hidden="true" className="relative border-t border-dashed border-line">
        <span className="absolute -top-3 -left-3 size-6 rounded-full border border-line bg-surface" />
        <span className="absolute -top-3 -right-3 size-6 rounded-full border border-line bg-surface" />
      </div>
      <div className="flex items-center justify-between gap-3 p-4">
        <div>
          <p className="caption-4 text-text-muted">Price</p>
          <p className="title-2 tabular-nums">{tokens(event.priceWei)}</p>
        </div>
        <span aria-hidden="true" className="grid size-12 place-items-center rounded-full bg-accent text-on-accent">
          <ArrowUpRightIcon size={20} />
        </span>
      </div>
    </Link>
  )
}

/** The attendee's way in: events still on sale, each drawn as a ticket, then a ghost ticket for hosting your own. */
export default function Events() {
  const { events, failed } = useEvents()
  const open = events?.filter(isUpcoming).sort((a, b) => a.eventDate.localeCompare(b.eventDate))

  return (
    <Screen tabs>
      <TopBar back="/" right={<WalletChip />} />
      <header className="flex flex-col gap-2">
        <h1 className="heading-3">Events</h1>
        <p className="body-3 max-w-prose text-text-muted">Pick an event and buy a ticket with free test tokens. No real money moves.</p>
      </header>

      {failed && (
        <p role="alert" className="body-6 text-danger">
          Could not read events from Arkiv. Check your connection, then open this page again.
        </p>
      )}
      {!events && !failed && (
        <div aria-busy="true" aria-label="Loading events" className="h-80 animate-pulse rounded-2xl border border-line bg-surface-raised" />
      )}
      {open?.length === 0 && <p className="body-6 text-text-muted">No events are on sale right now.</p>}

      <ul className="flex flex-col gap-4">
        {open?.map((e, i) => (
          <li key={e.eventId}>
            <EventCard event={e} featured={i === 0} />
          </li>
        ))}
        <li>
          <Link
            to="/organizer"
            className="flex min-h-24 items-center gap-4 rounded-2xl border border-dashed border-line p-4 transition duration-300 ease-base hover:bg-surface-raised active:scale-[0.99]"
          >
            <span aria-hidden="true" className="grid size-12 shrink-0 place-items-center rounded-full border border-line text-accent">
              <PlusIcon size={20} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="title-2 block">Host your own event</span>
              <span className="body-6 block text-text-muted">Issue tickets to wallets from the organizer page.</span>
            </span>
            <CaretRightIcon size={20} className="shrink-0 text-text-muted" aria-hidden="true" />
          </Link>
        </li>
      </ul>
      <AttendeeTabs />
    </Screen>
  )
}
