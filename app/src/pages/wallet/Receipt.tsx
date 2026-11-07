import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { formatEther } from 'viem'
import { Row } from '../../components/Bits'
import { Button } from '../../components/Button'
import { Screen, TopBar } from '../../components/Screen'
import { DetailSkeleton } from '../../components/Skeleton'
import { short, useTickets } from '../../data/mock'
import { allEvents, explorerTx, myPurchases, type ArkivEvent, type ArkivPayment } from '../../services/arkiv'
import { prettyDate } from '../events/art'

/** One payment, drawn as a receipt: what was bought, how much, when, and the proof on the explorer. */
export default function Receipt() {
  const { txn = '' } = useParams()
  const back = (useLocation().state as { back?: string } | null)?.back ?? '/wallet/purchases'
  const tickets = useTickets()
  const [payment, setPayment] = useState<ArkivPayment | null>()
  const [events, setEvents] = useState<ArkivEvent[]>([])
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    Promise.all([myPurchases(), allEvents()])
      .then(([p, e]) => {
        setPayment(p.find((x) => x.txnHash === txn) ?? null)
        setEvents(e)
      })
      .catch(() => setFailed(true))
  }, [txn])

  const ticket = tickets.find((t) => t.id === payment?.passId)
  const event = events.find((e) => e.eventId === payment?.eventId)

  if (payment === null || failed) {
    return (
      <Screen>
        <TopBar back={back} title="Receipt" />
        <section className="flex flex-1 flex-col justify-center gap-2" role="alert">
          <h1 className="heading-5">{failed ? 'We could not read this receipt' : 'We could not find this receipt'}</h1>
          <p className="body-3 text-text-muted">{failed ? 'Check your connection, then open this page again.' : 'It may belong to a different wallet.'}</p>
        </section>
        <Button to="/wallet/purchases">Back to purchases</Button>
      </Screen>
    )
  }

  return (
    <Screen>
      <TopBar back={back} title="Receipt" />
      {!payment ? (
        <DetailSkeleton label="Loading receipt" picture={false} />
      ) : (
        <div className="animate-rise overflow-hidden border border-line">
          <div className="flex flex-col items-center gap-1 px-4 py-8 text-center">
            <p className="caption-4 text-text-muted">Paid</p>
            <h1 className="heading-2 tabular-nums">{formatEther(BigInt(payment.amountWei))}&nbsp;tGLM</h1>
            <p className="body-5 text-text-muted">{event?.eventName ?? 'Event'}</p>
          </div>
          <div aria-hidden="true" className="relative border-t border-dashed border-line">
            <span className="absolute -top-3 -left-3 size-6 rounded-full border border-line bg-surface" />
            <span className="absolute -top-3 -right-3 size-6 rounded-full border border-line bg-surface" />
          </div>
          <div className="rounded-md">
            <Row label="Date">{prettyDate(payment.createdAt.slice(0, 10))}</Row>
            <Row label="Event date">{event ? prettyDate(event.eventDate) : 'Not published'}</Row>
            <Row label="Payment">
              <span className="font-mono">{short(payment.txnHash)}</span>
            </Row>
            <Row label="Ticket">
              {ticket ? (
                <Link to={`/wallet/ticket/${ticket.id}`} className="inline-flex min-h-12 items-center text-accent">
                  Pass&nbsp;{ticket.pass}
                </Link>
              ) : (
                'Not loaded'
              )}
            </Row>
          </div>
        </div>
      )}
      <div className="flex-1" />
      {payment && (
        <a href={explorerTx(payment.txnHash)} target="_blank" rel="noreferrer" className="inline-flex min-h-16 w-full items-center justify-center rounded-md border border-line button-lg transition duration-300 ease-base hover:border-accent active:scale-[0.98]">
          See it on the explorer
        </a>
      )}
    </Screen>
  )
}
