import { Button } from '../components/Button'
import { Screen } from '../components/Screen'

export default function NotFound() {
  return (
    <Screen>
      <div className="flex-1" />
      <h1 className="heading-4">This page does not exist</h1>
      <p className="body-3 text-text-muted">The link may be old or mistyped. Go back to the start and pick a role.</p>
      <div className="flex-1" />
      <Button to="/enter">Go to start</Button>
    </Screen>
  )
}
