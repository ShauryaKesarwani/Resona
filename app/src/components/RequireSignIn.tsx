import { Navigate, Outlet, useLocation, useOutletContext } from 'react-router-dom'
import { useSignedIn } from '../services/auth'

/** Sends anyone without an account to sign in, then back to where they were going. */
export function RequireSignIn() {
  const signedIn = useSignedIn()
  const { pathname, search } = useLocation()
  const parent = useOutletContext() // passes the tab layout's context through to the screen

  if (!signedIn) return <Navigate to={`/signin?next=${encodeURIComponent(pathname + search)}`} replace />
  return <Outlet context={parent} />
}
