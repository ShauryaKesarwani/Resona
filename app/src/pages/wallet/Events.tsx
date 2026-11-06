import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatEther } from 'viem'
import { Row } from '../../components/Bits'
import { Button } from '../../components/Button'
import { Screen, TopBar } from '../../components/Screen'
import { refreshTickets } from '../../data/mock'
import { allEvents, buy, explorerTx, isUpcoming, PurchaseError, type ArkivEvent, type BuyStep } from '../../services/arkiv'

const steps: Record<BuyStep, string> = {
  funding: 'Adding test tokens',
  paying: 'Sending payment',
  recording: 'Saving your ticket',
}

const MESSAGES: Record<string, string> = {
  no_account: 'Only World ID accounts can buy. Sign in with World ID, then try again.',
  human_already_claimed: 'You already have a ticket for this event.',
  event_ended: 'This event has ended.',
  payment_not_confirmed: 'Your payment is not confirmed yet. Buy again to pick it up, and you will not pay twice.',
  payment_failed: 'The payment failed, so no ticket was made. Try again.',
  purchase_needs_review: 'Your payment went through, but we could not confirm your ticket. Show this payment to the organizer.',
}
const explain = (err: unknown) => MESSAGES[(err as Error).message] ?? 'Could not finish the purchase. Check your connection, then try again.'

/** W6. Events still open, each with a real testnet purchase. */
export default function Events() {
  const navigate = useNavigate()
  const [events, setEvents] = useState<ArkivEvent[]>()
  const [loadFailed, setLoadFailed] = useState(false)
  const [buying, setBuying] = useState<string>()
  const [step, setStep] = useState<BuyStep>()
  const [failure, setFailure] = useState<{ eventId: string; message: string; txnHash?: string }>()

  useEffect(() => {
    allEvents()
      .then((all) => setEvents(all.filter(isUpcoming).sort((a, b) => a.eventDate.localeCompare(b.eventDate))))
      .catch(() => setLoadFailed(true))
  }, [])

  async function purchase(event: ArkivEvent) {
    setBuying(event.eventId)
    setFailure(undefined)
    try {
      await buy(event, setStep)
      await refreshTickets()
      navigate('/wallet')
    } catch (err) {
      setFailure({ eventId: event.eventId, message: explain(err), txnHash: err instanceof PurchaseError ? err.txnHash : undefined })
    } finally {
      setBuying(undefined)
      setStep(undefined)
    }
  }

  return (
    <Screen>
      <TopBar back="/wallet" title="Buy tickets" />
      <h1 className="heading-4">Upcoming events</h1>
      <p className="body-3 max-w-prose text-text-muted">You pay with free test tokens on the Rabdi test network. No real money moves.</p>

      {loadFailed && (
        <p role="alert" className="body-6 text-danger">
          Could not read events from Arkiv. Check your connection, then open this page again.
        </p>
      )}
      {!events && !loadFailed && <div aria-busy="true" aria-label="Loading events" className="h-40 animate-pulse rounded-2xl border border-line bg-surface-raised" />}
      {events?.length === 0 && <p className="body-6 text-text-muted">No events are on sale right now.</p>}

      {events?.map((event) => (
        <section key={event.eventId} aria-label={event.eventName} className="flex flex-col gap-3 rounded-2xl border border-line bg-surface-raised p-2">
          <div className="rounded-lg bg-surface-inset">
            <p className="title-2 px-4 pt-4 pb-3">{event.eventName}</p>
            <Row label="Date">{event.eventDate}</Row>
            <Row label="Price">
              <span className="font-mono tabular-nums">{formatEther(BigInt(event.priceWei))}&nbsp;tGLM</span>
            </Row>
          </div>
          {failure?.eventId === event.eventId && (
            <div role="alert" className="body-6 px-2 text-danger">
              <p>{failure.message}</p>
              {failure.txnHash && (
                <a href={explorerTx(failure.txnHash)} target="_blank" rel="noreferrer" className="inline-flex min-h-12 items-center text-accent">
                  See the payment
                </a>
              )}
            </div>
          )}
          <Button size="md" busy={buying === event.eventId} disabled={!!buying} onClick={() => purchase(event)}>
            {buying === event.eventId && step ? steps[step] : 'Buy ticket'}
          </Button>
        </section>
      ))}
    </Screen>
  )
}
