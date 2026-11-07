import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRightIcon } from '../../components/icons'
import { StatusPill } from '../../components/Bits'
import { RowsSkeleton } from '../../components/Skeleton'
import { Button } from '../../components/Button'
import { SceneHeading } from '../../components/SceneHeading'
import { Screen, TopBar } from '../../components/Screen'
import { refreshTickets, useTickets, useTicketsState, type Ticket } from '../../data/mock'
import { myPurchases } from '../../services/arkiv'

function TicketRow({ t }: { t: Ticket }) {
  return (
    <li>
      <Link
        to={`/wallet/ticket/${t.id}`}
        className="group flex items-center gap-4 border-b border-line py-4 transition duration-300 ease-base active:scale-[0.99]"
      >
        <div className="min-w-0 flex-1">
          <p className="title-1">{t.event}</p>
          <p className="body-6 mt-1 text-text-muted">{t.tier} · Pass&nbsp;{t.pass}</p>
          <div className="mt-2">
            <StatusPill status={t.status} past={t.past} />
          </div>
        </div>
        <ArrowRightIcon size={24} className="shrink-0 text-accent transition-transform duration-300 ease-base group-hover:translate-x-1 group-active:translate-x-1" aria-hidden="true" />
      </Link>
    </li>
  )
}

/** W1. Your tickets from Arkiv: what is coming up, then what has passed. */
export default function Tickets() {
  const tickets = useTickets()
  const state = useTicketsState()
  const [purchases, setPurchases] = useState<number>()

  useEffect(() => {
    refreshTickets()
    myPurchases().then((p) => setPurchases(p.length)).catch(() => {})
  }, [])

  const upcoming = tickets.filter((t) => !t.past)
  const past = tickets.filter((t) => t.past)

  return (
    <Screen tabs>
      <TopBar />
      <SceneHeading title="Your tickets" />
      <div className="flex justify-end">
        <Link to="/wallet/purchases" className="body-5 flex min-h-12 items-center rounded-md px-1 text-accent">
          {purchases === undefined ? 'Purchases' : `Purchases (${purchases})`}
        </Link>
      </div>

      {state === 'loading' && <RowsSkeleton label="Loading tickets" rows={2} />}

      {state === 'failed' && (
        <p role="alert" className="body-6 text-danger">
          Could not read your tickets from Arkiv. Check your connection, then open this page again.
        </p>
      )}

      {state === 'ready' && tickets.length === 0 && (
        <section className="flex flex-col items-center gap-2 border-y border-line py-8 text-center">
          <h2 className="title-2">No tickets yet</h2>
          <p className="body-6 text-text-muted">Buy a ticket, or ask the organizer to issue one to this wallet.</p>
          <Button to="/events" size="md" className="mt-4">Buy tickets</Button>
        </section>
      )}

      {upcoming.length > 0 && (
        <ul className="stagger flex flex-col" aria-label="Upcoming tickets">
          {upcoming.map((t) => (
            <TicketRow key={t.id} t={t} />
          ))}
        </ul>
      )}

      {past.length > 0 && (
        <section aria-labelledby="past-title" className="flex flex-col gap-2">
          <h2 id="past-title" className="heading-6">
            Past tickets
          </h2>
          <ul className="stagger flex flex-col">
            {past.map((t) => (
              <TicketRow key={t.id} t={t} />
            ))}
          </ul>
        </section>
      )}

    </Screen>
  )
}
