import { useEffect, useState } from 'react'
import { Button } from '../../components/Button'
import { Screen, TopBar } from '../../components/Screen'
import { api, type TransferRequest } from '../../services/api'
import { organizerEvents, type ArkivEvent } from '../../services/arkiv'
import { signedBy } from '../../services/auth'

export default function Transfers() {
  const [events, setEvents] = useState<ArkivEvent[]>([])
  const [eventId, setEventId] = useState('')
  const [requests, setRequests] = useState<TransferRequest[]>([])
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    organizerEvents().then((rows) => {
      setEvents(rows)
      setEventId(rows[0]?.eventId ?? '')
    }).catch(() => setError('Could not load your events.'))
  }, [])

  async function refresh(id = eventId) {
    if (!id) return
    setLoading(true)
    setError('')
    try {
      setRequests(await api.organizerTransfers(id, await signedBy(`organizer:transfers:${id}`)))
    } catch (cause) {
      setError((cause as Error).message === 'event_not_owned' ? 'You cannot manage this event.' : 'Could not load transfer requests.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (eventId) void refresh(eventId) }, [eventId])

  async function decide(request: TransferRequest, decision: 'approve' | 'decline') {
    setBusyId(request.requestId)
    setError('')
    try {
      await api.decideTransfer(request.passId, request.requestId, decision,
        await signedBy(`organizer:transfer:${request.requestId}:${decision}`))
      await refresh()
    } catch (cause) {
      const code = (cause as Error).message
      setError(code === 'transfer_needs_review'
        ? 'The request needs manual review. Check the Arkiv ticket before taking another action.'
        : code === 'transfer_recipient_not_registered'
          ? 'The recipient must sign in with World ID before this ticket can be transferred.'
          : code === 'transfer_recipient_already_claimed'
            ? 'The recipient already has a claimed ticket for this event.'
        : 'Could not update this request. Refresh the list before retrying.')
      await refresh()
    } finally {
      setBusyId('')
    }
  }

  return <Screen tabs>
    <TopBar back="/organizer" title="Ticket transfers" />
    <h1 className="heading-4">Transfer requests</h1>
    <p className="body-6 text-text-muted">Approve or decline requests to move an issued ticket.</p>
    <label className="flex flex-col gap-2">
      <span className="title-4">Event</span>
      <select value={eventId} onChange={(event) => setEventId(event.target.value)} className="field">
        {events.map((event) => <option key={event.eventId} value={event.eventId}>{event.eventName}</option>)}
      </select>
    </label>
    <Button variant="secondary" size="md" onClick={() => refresh()} busy={loading}>Refresh requests</Button>
    {error && <p role="alert" className="body-6 text-danger">{error}</p>}
    {!loading && requests.length === 0 && <p className="body-6 text-text-muted">There are no open transfer requests for this event.</p>}
    <ul className="stagger flex flex-col">
      {requests.map((request) => <li key={request.requestId} className="flex flex-col gap-3 border-b border-line py-4">
        <div>
          <p className="title-3">Pass {request.passId.slice(0, 8)}</p>
          <p className="caption-5 mt-1 break-all text-text-muted">From {request.fromHolder}</p>
          <p className="caption-5 break-all text-text-muted">To {request.toHolder}</p>
          <p className="caption-5 mt-1 text-text-muted">{request.status.replace('_', ' ')}</p>
        </div>
        {request.status === 'pending' && <div className="grid grid-cols-2 gap-2">
          <Button size="md" busy={busyId === request.requestId} onClick={() => decide(request, 'approve')}>Approve</Button>
          <Button size="md" variant="secondary" disabled={!!busyId} onClick={() => decide(request, 'decline')}>Decline</Button>
        </div>}
      </li>)}
    </ul>
  </Screen>
}
