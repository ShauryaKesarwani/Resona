import { useEffect, useState } from 'react'
import { allEvents, type ArkivEvent } from '../../services/arkiv'

/** Every event the organizer published, read from Arkiv. `failed` means the read did not work, `events` is undefined while loading. */
export function useEvents() {
  const [events, setEvents] = useState<ArkivEvent[]>()
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let current = true
    allEvents()
      .then((all) => current && setEvents(all))
      .catch(() => current && setFailed(true))
    return () => {
      current = false
    }
  }, [])
  return { events, failed }
}
