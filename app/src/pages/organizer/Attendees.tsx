import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { isAddress } from 'viem'
import { Button } from '../../components/Button'
import { Screen, TopBar } from '../../components/Screen'
import { api } from '../../services/api'
import { organizerEvents, organizerAttendees, type ArkivEvent, type AttendeeTicket } from '../../services/arkiv'

type Attendees = { tickets: AttendeeTicket[]; checkins: { passId: string; holder: string }[] }

/** Current organizer-issued tickets and check-ins, read from Arkiv. */
export default function Attendees() {
  const [events, setEvents] = useState<ArkivEvent[]>()
  const [eventId, setEventId] = useState('')
  const [data, setData] = useState<Attendees>()
  const [search, setSearch] = useState('')
  const [resolvedSearch, setResolvedSearch] = useState<{ query: string; name: string; address: string } | null>(null)
  const [searchError, setSearchError] = useState('')
  const [searching, setSearching] = useState(false)
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
  const searchKey = search.trim().toLowerCase()
  const rows = data?.tickets.filter((t) => `${t.holder} ${t.passId} ${t.tier}`.toLowerCase().includes(searchKey)
    || (resolvedSearch?.query.toLowerCase() === searchKey && t.holder.toLowerCase() === resolvedSearch.address.toLowerCase()))
  const count = data?.tickets.filter(isChecked).length ?? 0

  async function resolveSearch(e: FormEvent) {
    e.preventDefault()
    const query = search.trim()
    setSearchError('')
    setResolvedSearch(null)
    if (!query || isAddress(query)) return
    setSearching(true)
    try {
      const resolved = await api.ensResolve(query)
      setResolvedSearch({ query, ...resolved })
    } catch (error) {
      const code = (error as Error).message
      setSearchError(code === 'ens_name_not_found' ? 'That ENS name could not be found.'
        : code === 'ens_address_not_set' ? 'That ENS name has no wallet address set.'
          : code === 'invalid_ens_name' ? 'Enter a valid ENS name.'
            : 'ENS lookup is unavailable. Try again in a moment.')
    } finally {
      setSearching(false)
    }
  }

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
        <form onSubmit={resolveSearch} className="flex flex-col gap-2">
          <label className="flex flex-col gap-2">
            <span className="title-4">Search wallet, ticket, tier or ENS name</span>
            <input value={search} onChange={(e) => { setSearch(e.target.value); setSearchError('') }} autoComplete="off" placeholder="Wallet, ticket ID or name.eth" className="min-h-14 rounded-xl border border-line bg-surface-raised px-4 text-base" />
          </label>
          {search.includes('.') && !isAddress(search.trim()) && <Button type="submit" variant="secondary" size="sm" busy={searching}>{searching ? 'Resolving name' : 'Resolve ENS name'}</Button>}
          {resolvedSearch?.query.toLowerCase() === searchKey && <p role="status" className="caption-5 text-text-muted">{resolvedSearch.name} resolves to {resolvedSearch.address}</p>}
          {searchError && <p role="alert" className="body-6 text-danger">{searchError}</p>}
        </form>
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
