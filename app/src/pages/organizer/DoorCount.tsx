import { useEffect, useState } from 'react'
import { ordinal, short } from '../../data/mock'
import { organizerEvents, recentCheckins, type ArkivCheckin, type ArkivEvent } from '../../services/arkiv'

/** How many people have come through the door, read from Arkiv every few seconds. */
export function DoorCount() {
  const [rows, setRows] = useState<ArkivCheckin[]>()
  const [events, setEvents] = useState<ArkivEvent[]>([])
  const [eventId, setEventId] = useState('')
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    organizerEvents().then((list) => {
      setEvents(list)
      setEventId((current) => list.some((event) => event.eventId === current) ? current : list[0]?.eventId ?? '')
    }).catch(() => setFailed(true))
  }, [])

  useEffect(() => {
    let current = true
    const load = () =>
      recentCheckins()
        .then((r) => current && (setRows(r), setFailed(false)))
        .catch(() => current && setFailed(true))
    load()
    const timer = setInterval(load, 5000)
    return () => {
      current = false
      clearInterval(timer)
    }
  }, [])

  const selectedRows = rows?.filter((row) => row.eventId === eventId) ?? []

  return (
    <section className="flex flex-1 flex-col gap-4" aria-live="polite">
      {events.length > 0 && (
        <label className="flex flex-col gap-2">
          <span className="title-4">Event</span>
          <select value={eventId} onChange={(e) => setEventId(e.target.value)} className="min-h-14 rounded-xl border border-line bg-surface-raised px-4 text-base">
            {events.map((event) => <option key={event.eventId} value={event.eventId}>{event.eventName}</option>)}
          </select>
        </label>
      )}
      {events.length === 0 && !failed && <p className="body-6 text-text-muted">Publish an event before viewing door activity.</p>}
      <div className="flex flex-col items-center gap-1 rounded-2xl border border-line bg-surface-raised py-8 text-center">
        <p className="heading-1 tabular-nums">{rows ? selectedRows.length : '…'}</p>
        <p className="body-3 text-text-muted">through the door</p>
      </div>
      {failed && (
        <p role="alert" className="body-6 text-danger">
          Could not read check ins from Arkiv. This page keeps trying.
        </p>
      )}
      {rows && selectedRows.length > 0 && (
        <ul className="flex flex-col">
          {selectedRows.slice(0, 8).map((c) => (
            <li key={c.passId} className="flex items-center justify-between gap-4 py-3 not-first:border-t not-first:border-line">
              <div className="min-w-0">
                <p className="title-3 tabular-nums">{ordinal(c.ordinal)}</p>
                <p className="caption-5 font-mono text-text-muted">{short(c.holder)}</p>
              </div>
              <p className="body-5 font-mono tabular-nums">{c.distanceCm}&nbsp;cm</p>
            </li>
          ))}
        </ul>
      )}
      {rows && eventId && selectedRows.length === 0 && <p className="body-6 text-text-muted">Nobody has checked in to this event yet.</p>}
    </section>
  )
}
