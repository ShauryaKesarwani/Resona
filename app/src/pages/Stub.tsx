import { Button } from '../components/Button'
import { Screen, TopBar } from '../components/Screen'

/** Placeholder for a screen that is planned but not built yet. Says so plainly. */
export function Stub({ title, back, what }: { title: string; back: string; what: string }) {
  return (
    <Screen>
      <TopBar back={back} title={title} heading right={null} />
      <section className="flex flex-1 flex-col justify-center gap-2">
        <h2 className="heading-5">Not built yet</h2>
        <p className="body-3 text-text-muted">{what}</p>
      </section>
      <Button variant="secondary" to={back}>
        Go back
      </Button>
    </Screen>
  )
}
