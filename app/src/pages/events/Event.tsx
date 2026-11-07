import { useParams } from 'react-router-dom'
import { Row } from '../../components/Bits'
import { Button } from '../../components/Button'
import { Screen, TopBar } from '../../components/Screen'
import { DetailSkeleton } from '../../components/Skeleton'
import { wallet } from '../../data/mock'
import { isUpcoming } from '../../services/arkiv'
import { useIsOrganizer } from '../../services/organizerStatus'
import { prettyDate, tokens } from './art'
import { EventImage } from './EventImage'
import { useEvents } from './useEvents'

/** One event: its picture, the facts, and a single button to buy. */
export default function Event() {
  const { id } = useParams()
  const { events, failed } = useEvents()
  const organizer = useIsOrganizer()
  const event = events?.find((e) => e.eventId === id)

  if (!event) {
    return (
      <Screen>
        <TopBar back="/events" />
        {failed && (
          <p role="alert" className="body-6 text-danger">
            Could not read this event from Arkiv. Check your connection, then open this page again.
          </p>
        )}
        {!events && !failed && <DetailSkeleton label="Loading event" />}
        {events && (
          <section className="flex flex-1 flex-col justify-center gap-2" role="alert">
            <h1 className="heading-5">We could not find this event</h1>
            <p className="body-3 text-text-muted">The link may be old. Go back to the events and pick one.</p>
          </section>
        )}
        <div className="flex-1" />
        {events && <Button to="/events">See all events</Button>}
      </Screen>
    )
  }

  const open = isUpcoming(event)
  return (
    <Screen>
      <TopBar back={organizer ? '/organizer' : '/events'} />
      <EventImage eventId={event.eventId} ratio="4 / 3" />
      <h1 className="heading-3">{event.eventName}</h1>
      <div className="border-y border-line">
        <div>
          <Row label="Date">{prettyDate(event.eventDate)}</Row>
          <Row label="Ticket price">
            <span className="tabular-nums">{tokens(event.priceWei)}</span>
          </Row>
          <Row label="Network">{wallet.network} test network</Row>
        </div>
      </div>
      {!organizer && <p className="body-6 max-w-prose text-text-muted">You pay with free test tokens. If your wallet is short, Resona adds some first. No real money moves.</p>}
      <div className="flex-1" />
      {!open ? (
        <p className="body-5 text-center text-text-muted">This event has ended.</p>
      ) : organizer ? (
        <Button to="/organizer">Manage your events</Button>
      ) : (
        <Button to={`/e/${event.eventId}/buy`}>Buy a ticket</Button>
      )}
    </Screen>
  )
}
