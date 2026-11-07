import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { CheckCircleIcon, WarningCircleIcon } from '../../components/icons'
import { Row } from '../../components/Bits'
import { Button } from '../../components/Button'
import { Screen, TopBar } from '../../components/Screen'
import { refreshTickets, wallet } from '../../data/mock'
import { buy, explorerTx, isUpcoming, PurchaseError, type BuyStep } from '../../services/arkiv'
import { api } from '../../services/api'
import { prettyDate, tokens } from './art'
import { useEvents } from './useEvents'

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

/** Review the event, then pay. The payment is real, on the test network, and each step shows on the button. */
export default function Buy() {
  const { id } = useParams()
  const { events, failed } = useEvents()
  const event = events?.find((e) => e.eventId === id)
  const [step, setStep] = useState<BuyStep>()
  const [error, setError] = useState<{ message: string; txnHash?: string }>()
  const [passId, setPassId] = useState<string>()
  const [ensEventName, setEnsEventName] = useState('')
  const [ensPassName, setEnsPassName] = useState('')
  const busy = step !== undefined

  useEffect(() => {
    api.config().then((config) => setEnsEventName(config.ensEventName ?? '')).catch(() => {})
  }, [])

  async function pay() {
    setError(undefined)
    try {
      const newPass = await buy(event!, setStep)
      await refreshTickets()
      setPassId(newPass)
      const ensPass = await api.ensPass(newPass).catch(() => null)
      if (ensPass?.active && ensPass.linked && ensPass.matchesHolder) setEnsPassName(ensPass.name)
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
        {!events && !failed && <div aria-busy="true" aria-label="Loading event" className="h-40 animate-pulse rounded-2xl border border-line bg-surface-raised" />}
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
        <TopBar back="/events" title="Buy a ticket" />
        <section className="flex flex-1 flex-col justify-center gap-4" role="status">
          <CheckCircleIcon size={48} className="text-success" aria-hidden="true" />
          <h1 className="heading-4">You have a ticket</h1>
          <p className="body-3 max-w-prose text-text-muted">{event.eventName} on {prettyDate(event.eventDate)}. It is in your wallet, ready to check in.</p>
          {ensEventName && <p className="caption-5 font-mono text-text-muted">Configured ENS namespace: {ensEventName}</p>}
          {ensPassName && <p className="caption-5 font-mono text-text-muted">ENS pass: {ensPassName}</p>}
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
      <div className="rounded-2xl border border-line bg-surface-raised p-2">
        <div className="rounded-lg bg-surface-inset">
          <Row label="Event">{event.eventName}</Row>
          <Row label="Date">{prettyDate(event.eventDate)}</Row>
          <Row label="Price">
            <span className="tabular-nums">{tokens(event.priceWei)}</span>
          </Row>
          <Row label="Network">{wallet.network} test network</Row>
        </div>
      </div>
      <p className="body-6 max-w-prose text-text-muted">Free test tokens only. If your wallet is short, Resona adds some first.</p>

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
