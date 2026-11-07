import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../../components/Button'
import { Screen, TopBar } from '../../components/Screen'
import { organizerEvents, organizerAttendees, type ArkivEvent, type AttendeeTicket } from '../../services/arkiv'

type Attendees = { tickets: AttendeeTicket[]; checkins: { passId: string; holder: string }[] }

/** Current organizer-issued tickets and check-ins, read from Arkiv. */
export default function Attendees() {
  const [events, setEvents] = useState<ArkivEvent[]>()
  const [eventId, setEventId] = useState('')
  const [data, setData] = useState<Attendees>()
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let active = true
    organizerEvents().then((rows) => {
      if (!active) return
      setEvents(rows)
      setEventId((current) => current || rows[0]?.eventId || '')
    }).catch(() => active && setError('Could not load events from Arkiv. Try again.'))
    return () => { active = false }
  }, [reload])

  useEffect(() => {
    if (!eventId) return
    let active = true
    setData(undefined)
    setError('')
    organizerAttendees(eventId).then((rows) => { if (active) setData(rows) })
      .catch(() => { if (active) setError('Could not load the full list from Arkiv. Try again.') })
    return () => { active = false }
  }, [eventId, reload])

  const checked = useMemo(() => new Set(data?.checkins.map((c) => `${c.passId}:${c.holder.toLowerCase()}`) ?? []), [data])
  const isChecked = (t: AttendeeTicket) => checked.has(`${t.passId}:${t.holder.toLowerCase()}`)
  const rows = data?.tickets.filter((t) => `${t.holder} ${t.passId} ${t.tier}`.toLowerCase().includes(search.trim().toLowerCase()))
  const count = data?.tickets.filter(isChecked).length ?? 0

  return (
    <Screen>
      <TopBar back="/organizer" title="Attendees" />
      <h1 className="heading-4">Tickets and check-ins</h1>
      <p className="body-6 text-text-muted">Read from Arkiv. This list only includes tickets issued by the organizer; purchased tickets are not included.</p>
      {events && events.length > 0 && (
        <label className="flex flex-col gap-2">
          <span className="title-4">Event</span>
          <select value={eventId} onChange={(e) => setEventId(e.target.value)} className="min-h-14 rounded-xl border border-line bg-surface-raised px-4 text-base">
            {events.map((event) => <option key={event.eventId} value={event.eventId}>{event.eventName}</option>)}
          </select>
        </label>
      )}
      {events?.length === 0 && <p className="body-6 text-text-muted">No organizer events found on Arkiv.</p>}
      {data && <p className="title-3" role="status">{data.tickets.length} issued · {count} checked in</p>}
      {data && (
        <label className="flex flex-col gap-2">
          <span className="title-4">Search wallet, ticket or tier</span>
          <input value={search} onChange={(e) => setSearch(e.target.value)} autoComplete="off" placeholder="Wallet address or ticket ID" className="min-h-14 rounded-xl border border-line bg-surface-raised px-4 text-base" />
        </label>
      )}
      {error && <p role="alert" className="body-6 text-danger">{error}</p>}
      {!data && !error && (!events || eventId) && <p role="status" className="body-6 text-text-muted">Loading from Arkiv…</p>}
      {rows?.length === 0 && <p className="body-6 text-text-muted">No tickets found.</p>}
      {rows && <ul className="flex flex-col gap-2">
        {rows.map((t) => (
          <li key={t.passId} className="rounded-xl border border-line bg-surface-raised p-4">
            <p className="title-3">{isChecked(t) ? 'Checked in' : t.status.replaceAll('_', ' ')}</p>
            <p className="body-6 font-mono text-text-muted [overflow-wrap:anywhere]">{t.holder}</p>
            <p className="caption-5 font-mono text-text-muted [overflow-wrap:anywhere]">Ticket {t.passId} · {t.tier}</p>
            {!isChecked(t) && <Link to={`/door?passId=${encodeURIComponent(t.passId)}`} className="body-5 mt-2 inline-flex min-h-12 items-center text-accent">Select for check-in</Link>}
          </li>
        ))}
      </ul>}
      <div className="flex-1" />
      <Button variant="secondary" size="md" onClick={() => { setError(''); setReload((n) => n + 1) }}>Refresh from Arkiv</Button>
    </Screen>
  )
}
