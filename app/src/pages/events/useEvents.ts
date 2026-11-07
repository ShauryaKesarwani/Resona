import { useEffect, useState } from 'react'
import { allEvents, type ArkivEvent } from '../../services/arkiv'

// Arkiv reads take seconds, so the last result shows at once while a fresh one loads.
let cached: ArkivEvent[] | undefined

/** Every event the organizer published, read from Arkiv. `failed` means the read did not work, `events` is undefined while loading. */
export function useEvents() {
  const [events, setEvents] = useState(cached)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let current = true
    allEvents()
      .then((all) => {
        cached = all
        if (current) setEvents(all)
      })
      .catch(() => current && !cached && setFailed(true))
    return () => {
      current = false
    }
  }, [])
  return { events, failed }
}
