import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CaretRightIcon } from '../../components/icons'
import { StatusPill, WalletChip } from '../../components/Bits'
import { GatewayFlow } from '../../components/GatewayFlow'
import { AttendeeTabs } from '../../components/AttendeeTabs'
import { Button } from '../../components/Button'
import { Figure } from '../../components/Figure'
import { Screen, TopBar } from '../../components/Screen'
import { refreshTickets, useTickets, useTicketsState, type Ticket } from '../../data/mock'
import { myPurchases } from '../../services/arkiv'

function TicketRow({ t }: { t: Ticket }) {
  return (
    <li>
      <Link
        to={`/wallet/ticket/${t.id}`}
        className="block rounded-2xl border border-line bg-surface-raised p-2 transition duration-300 ease-base hover:bg-surface-inset active:scale-[0.98]"
      >
        <div className="rounded-lg bg-surface-inset">
          <div className="flex items-start justify-between gap-2 p-4">
            <div className="min-w-0">
              <p className="title-2">Pass&nbsp;{t.pass}</p>
              <p className="body-6 text-text-muted">
                {t.event}, {t.tier}
              </p>
            </div>
            <StatusPill status={t.status} past={t.past} />
          </div>
          <div className="flex items-center justify-between border-t border-line px-4 py-3">
            <span className="caption-5 truncate font-mono text-text-muted">{t.ens}</span>
            <CaretRightIcon size={16} className="shrink-0 text-text-muted" aria-hidden="true" />
          </div>
        </div>
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
      <TopBar back="/" right={<WalletChip />} />
      <Figure ratio="16 / 7" position="50% 45%" />
      <div className="flex items-center justify-between gap-2">
        <h1 className="heading-5">Your tickets</h1>
        <Link to="/wallet/purchases" className="body-5 flex min-h-12 items-center rounded-lg px-1 text-accent">
          {purchases === undefined ? 'Purchases' : `Purchases (${purchases})`}
        </Link>
      </div>

      {state === 'loading' && (
        <ul className="flex flex-col gap-2" aria-busy="true" aria-label="Loading tickets">
          {[0, 1].map((i) => (
            <li key={i} className="h-24 animate-pulse rounded-2xl border border-line bg-surface-raised" />
          ))}
        </ul>
      )}

      {state === 'failed' && (
        <p role="alert" className="body-6 text-danger">
          Could not read your tickets from Arkiv. Check your connection, then open this page again.
        </p>
      )}

      {state === 'ready' && tickets.length === 0 && (
        <section className="flex flex-col items-center gap-2 rounded-2xl border border-line bg-surface-raised p-6 text-center">
          <GatewayFlow still className="h-28 w-full" />
          <h2 className="title-2">No tickets yet</h2>
          <p className="body-6 text-text-muted">Buy a ticket, or ask the organizer to issue one to this wallet.</p>
        </section>
      )}

      {upcoming.length > 0 && (
        <ul className="flex flex-col gap-2" aria-label="Upcoming tickets">
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
          <ul className="flex flex-col gap-2">
            {past.map((t) => (
              <TicketRow key={t.id} t={t} />
            ))}
          </ul>
        </section>
      )}

      <div className="flex-1" />
      <Button to="/events">Buy tickets</Button>
      <AttendeeTabs />
    </Screen>
  )
}
