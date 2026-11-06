import { useState, type FormEvent } from 'react'
import { CheckCircleIcon } from '../../components/icons'
import { Button } from '../../components/Button'
import { api } from '../../services/api'

const MESSAGES: Record<string, string> = {
  invalid_event_name: 'Give the event a name of 3 to 60 characters.',
  invalid_event_date: 'Pick today or a later date.',
  invalid_price: 'The price is a number from 0 to 100 test tokens.',
  arkiv_not_configured: 'The server cannot reach Arkiv. Check its keys, then try again.',
}

const input = 'min-h-14 rounded-xl border border-line bg-surface-raised px-4 text-base placeholder:text-text-muted'

/** Publishes an event on Arkiv. It shows on the events list once Arkiv has indexed it. */
export function NewEvent() {
  const [name, setName] = useState('')
  const [date, setDate] = useState('')
  const [price, setPrice] = useState('0.001')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [published, setPublished] = useState<{ eventId: string; name: string }>()

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return setError('Give the event a name.')
    if (!date) return setError('Pick the event date.')
    setError('')
    setBusy(true)
    try {
      const { eventId } = await api.createEvent(name.trim(), date, price.trim() || '0')
      setPublished({ eventId, name: name.trim() })
      setName('')
    } catch (err) {
      const code = (err as Error).message
      setError(MESSAGES[code] ?? 'Could not publish the event. Try again in a moment.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-1 flex-col gap-4">
      <p className="body-3 max-w-prose text-text-muted">Publish an event. People can then find it under Events and buy a ticket with test tokens.</p>
      <label className="flex flex-col gap-2">
        <span className="title-4">Event name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoComplete="off" className={input} />
      </label>
      <label className="flex flex-col gap-2">
        <span className="title-4">Date</span>
        <input value={date} onChange={(e) => setDate(e.target.value)} type="date" className={`${input} tabular-nums`} />
      </label>
      <label className="flex flex-col gap-2">
        <span className="title-4">Ticket price in test tokens</span>
        <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" autoComplete="off" className={`${input} font-mono tabular-nums`} />
      </label>
      <p role={error ? 'alert' : undefined} className="body-6 text-danger empty:hidden">
        {error}
      </p>
      {published && (
        <p role="status" className="body-5 flex items-center gap-2 text-success">
          <CheckCircleIcon size={20} aria-hidden="true" />
          {published.name} is published. It can take a minute to show up.
        </p>
      )}
      <div className="flex-1" />
      <Button type="submit" busy={busy}>
        {busy ? 'Publishing event' : 'Publish event'}
      </Button>
    </form>
  )
}
