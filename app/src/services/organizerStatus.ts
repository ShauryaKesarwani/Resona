import { useEffect, useSyncExternalStore } from 'react'
import { roleFor, type Role } from '../components/roles'
import { walletAddress } from '../utils/wallet'
import { api } from './api'

const key = () => `resona.isOrganizer.${walletAddress()}`
const saved = localStorage.getItem(key())

// The last answer shows at once, and every screen change asks the server again, so a promotion lands quickly.
let known: boolean | undefined = saved === null ? undefined : saved === 'true'
let asking: Promise<void> | undefined
const subs = new Set<() => void>()
const subscribe = (f: () => void) => {
  subs.add(f)
  return () => subs.delete(f)
}

function ask() {
  asking ??= api.organizerStatus(walletAddress())
    .then(({ organizer }) => {
      known = organizer
      localStorage.setItem(key(), String(organizer))
    })
    // With no answer and nothing saved, treat this wallet as an attendee, like nearly everyone.
    .catch(() => void (known ??= false))
    .finally(() => {
      asking = undefined
      subs.forEach((f) => f())
    })
}

/** Whether this wallet organizes events. Undefined until the first answer on this device. */
export function useIsOrganizer() {
  useEffect(ask, [])
  return useSyncExternalStore(subscribe, () => known)
}

/** The role for this route. Organizers and attendees are separate, so neither ever gets the other's tabs. */
export function useRole(pathname: string): Role {
  const organizer = useIsOrganizer()
  const role = roleFor(pathname)
  if (role === 'attendee' && organizer) return 'organizer'
  if (role === 'organizer' && organizer === false) return 'attendee'
  return role
}
