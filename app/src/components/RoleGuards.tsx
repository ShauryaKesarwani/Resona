import { Navigate, Outlet, useOutletContext } from 'react-router-dom'
import { useIsOrganizer } from '../services/organizerStatus'
import { Screen, TopBar } from './Screen'
import { DetailSkeleton } from './Skeleton'

/** Finding and buying tickets is for attendees. An organizer is sent to their own home. */
export function AttendeeOnly() {
  const parent = useOutletContext()
  if (useIsOrganizer()) return <Navigate to="/organizer" replace />
  return <Outlet context={parent} />
}

/** Publishing events and issuing tickets is for organizers. Anyone else is sent to their tickets. */
export function OrganizerOnly() {
  const parent = useOutletContext()
  const organizer = useIsOrganizer()
  if (organizer === false) return <Navigate to="/wallet" replace />
  if (organizer === undefined) {
    return (
      <Screen tabs>
        <TopBar />
        <DetailSkeleton label="Checking your account" picture={false} button={false} />
      </Screen>
    )
  }
  return <Outlet context={parent} />
}
