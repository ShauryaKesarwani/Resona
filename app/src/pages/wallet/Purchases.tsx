import { useEffect, useState } from 'react'
import { formatEther } from 'viem'
import { Screen, TopBar } from '../../components/Screen'
import { allEvents, explorerTx, myPurchases, type ArkivEvent, type ArkivPayment } from '../../services/arkiv'

/** W7. Everything this wallet has bought, each linked to its payment on the explorer. */
export default function Purchases() {
  const [payments, setPayments] = useState<ArkivPayment[]>()
  const [events, setEvents] = useState<ArkivEvent[]>([])
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    Promise.all([myPurchases(), allEvents()])
      .then(([p, e]) => {
        setPayments(p)
        setEvents(e)
      })
      .catch(() => setFailed(true))
  }, [])

  return (
    <Screen>
      <TopBar back="/wallet" title="Purchases" />
      <h1 className="heading-4">{payments ? `${payments.length} ${payments.length === 1 ? 'purchase' : 'purchases'}` : 'Purchases'}</h1>

      {failed && (
        <p role="alert" className="body-6 text-danger">
          Could not read your purchases from Arkiv. Check your connection, then open this page again.
        </p>
      )}
      {!payments && !failed && <div aria-busy="true" aria-label="Loading purchases" className="h-24 animate-pulse rounded-2xl border border-line bg-surface-raised" />}
      {payments?.length === 0 && <p className="body-6 text-text-muted">You have not bought any tickets yet.</p>}

      {payments && payments.length > 0 && (
        <ul className="flex flex-col">
          {payments.map((p) => (
            <li key={p.txnHash} className="flex items-center justify-between gap-4 py-3 not-first:border-t not-first:border-line">
              <div className="min-w-0">
                <p className="title-3">{events.find((e) => e.eventId === p.eventId)?.eventName ?? 'Event'}</p>
                <p className="body-6 text-text-muted">{p.createdAt.slice(0, 10)}</p>
              </div>
              <div className="text-right">
                <p className="body-5 font-mono tabular-nums">{formatEther(BigInt(p.amountWei))}&nbsp;tGLM</p>
                <a href={explorerTx(p.txnHash)} target="_blank" rel="noreferrer" className="body-6 inline-flex min-h-12 items-center text-accent">
                  See payment
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Screen>
  )
}
