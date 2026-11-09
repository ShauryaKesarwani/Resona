import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { CheckCircleIcon, WarningCircleIcon } from '../../components/icons'
import { Row } from '../../components/Bits'
import { Button } from '../../components/Button'
import { Screen, TopBar } from '../../components/Screen'
import { DetailSkeleton } from '../../components/Skeleton'
import { refreshTickets, wallet } from '../../data/mock'
import { buy, explorerTx, isUpcoming, PurchaseError, type BuyStep } from '../../services/arkiv'
import { prettyDate, tokens } from './art'
import { useEvents } from './useEvents'

const steps: Record<BuyStep, string> = {
  funding: 'Adding test tokens',
  paying: 'Sending payment',
  recording: 'Saving your ticket',
}

const MESSAGES: Record<string, string> = {
  human_already_claimed: 'You already have a ticket for this event.',
  event_ended: 'This event has ended.',
  payment_not_confirmed: 'Your payment is not confirmed yet. Buy again to pick it up, and you will not pay twice.',
  payment_failed: 'The payment failed, so no ticket was made. Try again.',
  purchase_needs_review: 'Your payment went through, but we could not confirm your ticket. Show this payment to the organizer.',
}
const explain = (err: unknown) => MESSAGES[(err as Error).message] ?? 'Could not finish the purchase. Check your connection, then try again.'

/** Review the event, then pay. The payment is real, on the test network, and each step shows on the button. */
export default function Buy() {
  const { id } = useParams()
  const { events, failed } = useEvents()
  const event = events?.find((e) => e.eventId === id)
  const [step, setStep] = useState<BuyStep>()
  const [error, setError] = useState<{ message: string; txnHash?: string }>()
  const [passId, setPassId] = useState<string>()
  const busy = step !== undefined

  async function pay() {
    setError(undefined)
    try {
      const newPass = await buy(event!, setStep)
      await refreshTickets()
      setPassId(newPass)
    } catch (err) {
      setError({ message: explain(err), txnHash: err instanceof PurchaseError ? err.txnHash : undefined })
    } finally {
      setStep(undefined)
    }
  }

  if (!event) {
    return (
      <Screen>
        <TopBar back="/events" title="Buy a ticket" />
        {failed && (
          <p role="alert" className="body-6 text-danger">
            Could not read this event from Arkiv. Check your connection, then open this page again.
          </p>
        )}
        {!events && !failed && <DetailSkeleton label="Loading event" picture={false} />}
        {events && (
          <section className="flex flex-1 flex-col justify-center gap-2" role="alert">
            <h1 className="heading-5">We could not find this event</h1>
            <p className="body-3 text-text-muted">Go back to the events and pick one.</p>
          </section>
        )}
        <div className="flex-1" />
        {events && <Button to="/events">See all events</Button>}
      </Screen>
    )
  }

  if (passId) {
    return (
      <Screen>
        <TopBar back="/events" title="Buy a ticket" right={null} />
        <section className="stagger flex flex-1 flex-col justify-center gap-4" role="status">
          <CheckCircleIcon size={48} className="text-success" aria-hidden="true" />
          <h1 className="heading-4">You have a ticket</h1>
          <p className="body-3 max-w-prose text-text-muted">{event.eventName} on {prettyDate(event.eventDate)}. It is in your wallet. The door currently requires World ID verification to check in.</p>
        </section>
        <Button to={`/wallet/ticket/${passId}`}>Open your ticket</Button>
        <Button variant="secondary" size="md" to="/events">
          Back to events
        </Button>
      </Screen>
    )
  }

  const ended = !isUpcoming(event)
  return (
    <Screen>
      <TopBar back={`/e/${event.eventId}`} title="Buy a ticket" />
      <h1 className="heading-4">Review and pay</h1>
      <div className="border-y border-line">
        <div>
          <Row label="Event">{event.eventName}</Row>
          <Row label="Date">{prettyDate(event.eventDate)}</Row>
          <Row label="Price">
            <span className="tabular-nums">{tokens(event.priceWei)}</span>
          </Row>
          <Row label="Network">{wallet.network} test network</Row>
        </div>
      </div>
      <p className="body-6 max-w-prose text-text-muted">Free test tokens only. If your wallet is short, Resona adds some first.</p>
      <p className="body-6 max-w-prose text-text-muted">You can buy without World ID for the demo, but the door currently requires World ID verification to use a purchased ticket. Unverified purchases do not provide one-ticket-per-person protection.</p>

      {error && (
        <div role="alert" className="body-6 flex items-start gap-2 text-danger">
          <WarningCircleIcon size={20} className="mt-0.5 shrink-0" aria-hidden="true" />
          <div>
            <p>{error.message}</p>
            {error.txnHash && (
              <a href={explorerTx(error.txnHash)} target="_blank" rel="noreferrer" className="inline-flex min-h-12 items-center text-accent">
                See the payment
              </a>
            )}
          </div>
        </div>
      )}
      {ended && <p className="body-5 text-text-muted">This event has ended.</p>}
      <div className="flex-1" />
      <Button busy={busy} disabled={ended} onClick={pay}>
        {step ? steps[step] : 'Pay and get your ticket'}
      </Button>
    </Screen>
  )
}
