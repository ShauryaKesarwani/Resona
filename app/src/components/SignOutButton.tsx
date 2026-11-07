import { useNavigate } from 'react-router-dom'
import { signOut } from '../services/auth'

/** Sign out keeps the wallet on this device, so the person can always sign back in. */
export function SignOutButton() {
  const navigate = useNavigate()
  return (
    <button
      type="button"
      onClick={() => {
        signOut()
        navigate('/signin', { replace: true })
      }}
      className="body-5 min-h-12 self-center rounded-md px-4 text-text-muted"
    >
      Sign out
    </button>
  )
}
