import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useSignedIn } from '../services/auth'

/** Sends anyone without an account to sign in, then back to where they were going. */
export function RequireSignIn() {
  const signedIn = useSignedIn()
  const { pathname } = useLocation()

  if (signedIn === undefined) return null
  if (!signedIn) return <Navigate to={`/signin?next=${encodeURIComponent(pathname)}`} replace />
  return <Outlet />
}
