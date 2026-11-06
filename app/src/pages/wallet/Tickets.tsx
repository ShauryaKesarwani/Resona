import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CaretRightIcon, TicketIcon } from '../../components/icons'
import { SimTag, StatusPill, WalletChip } from '../../components/Bits'
import { Figure } from '../../components/Figure'
import { Screen, TopBar } from '../../components/Screen'
import { useTickets } from '../../data/mock'

let loadedOnce = false

/** W1. Your ticket list. Shows a skeleton shaped like the list on first load. */
export default function Tickets() {
  const tickets = useTickets()
  const [ready, setReady] = useState(loadedOnce)

  useEffect(() => {
    if (loadedOnce) return
    const t = setTimeout(() => {
      loadedOnce = true
      setReady(true)
    }, 500)
    return () => clearTimeout(t)
  }, [])

  return (
    <Screen>
      <TopBar back="/enter" right={<WalletChip />} />
      <Figure ratio="16 / 7" position="50% 45%" />
      <div className="flex items-center justify-between gap-2">
        <h1 className="heading-5">Your tickets</h1>
        <SimTag />
      </div>

      {!ready && (
        <ul className="flex flex-col gap-2" aria-busy="true" aria-label="Loading tickets">
          {[0, 1, 2].map((i) => (
            <li key={i} className="h-24 animate-pulse rounded-2xl border border-line bg-surface-raised" />
          ))}
        </ul>
      )}

      {ready && tickets.length === 0 && (
        <section className="flex flex-col items-center gap-2 rounded-2xl border border-line bg-surface-raised p-6 text-center">
          <TicketIcon size={32} className="text-accent" aria-hidden="true" />
          <h2 className="title-2">No tickets yet</h2>
          <p className="body-6 text-text-muted">
            Ask the organizer to issue a pass to {`skes.eth`}. It will appear here as soon as they do.
          </p>
        </section>
      )}

      {ready && tickets.length > 0 && (
        <ul className="flex flex-col gap-2">
          {tickets.map((t) => (
            <li key={t.id}>
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
                    <StatusPill status={t.status} />
                  </div>
                  <div className="flex items-center justify-between border-t border-line px-4 py-3">
                    <span className="caption-5 truncate font-mono text-text-muted">{t.ens}</span>
                    <CaretRightIcon size={16} className="shrink-0 text-text-muted" aria-hidden="true" />
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Screen>
  )
}
