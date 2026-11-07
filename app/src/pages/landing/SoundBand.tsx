import { useEffect, useState } from 'react'
import { GatewayFlow } from '../../components/GatewayFlow'
import { Segmented } from '../../components/Segmented'
import { Aside, Section } from './Section'

type Place = 'door' | 'room' | 'call'

const places: Record<Place, { label: string; gap: number; reading: string; verdict: string; why: string; admitted: boolean }> = {
  door: { label: 'At the door', gap: 0, reading: '28 cm', verdict: 'Admitted', why: 'Each phone hears the other almost at once.', admitted: true },
  room: { label: 'Across the room', gap: 0.42, reading: '6 m', verdict: 'Not admitted', why: 'Sound takes time to cross a room. That time is the distance.', admitted: false },
  call: { label: 'On a video call', gap: 0.75, reading: '34 m', verdict: 'Not admitted', why: 'A call adds delay to the sound, and delay reads as distance.', admitted: false },
}
const order: Place[] = ['door', 'room', 'call']

/** The check, shown instead of described: pick where the phone is, and the streams and the reading follow. */
export function SoundBand() {
  const [place, setPlace] = useState<Place>('door')
  const [touched, setTouched] = useState(false)
  const p = places[place]

  // It plays through the three places by itself until someone picks one.
  useEffect(() => {
    if (touched || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const timer = setInterval(() => setPlace((now) => order[(order.indexOf(now) + 1) % order.length]), 3500)
    return () => clearInterval(timer)
  }, [touched])

  return (
    <Section>
      <h2 className="heading-4 lg:heading-3 mx-auto max-w-[680px] text-center">Distance decides who gets in.</h2>
      <Aside className="mt-2 text-center">physics does not take bribes</Aside>
      <GatewayFlow gap={p.gap} refused={!p.admitted} className="-mx-4 mt-6 h-56 w-[calc(100%+2rem)] lg:mx-0 lg:h-80 lg:w-full" />
      <div className="mx-auto flex max-w-md flex-col gap-6">
        <Segmented
          label="Where the phone is"
          cols={3}
          value={place}
          onChange={(id) => {
            setTouched(true)
            setPlace(id)
          }}
          options={order.map((id) => ({ id, label: places[id].label }))}
        />
        <div key={place} aria-live="polite" className="animate-rise flex flex-col items-center gap-1 text-center">
          <p className={`heading-3 font-mono tabular-nums ${p.admitted ? 'text-accent' : 'text-danger'}`}>{p.reading}</p>
          <p className="title-1">{p.verdict}</p>
          <p className="body-3 mt-1 text-text-muted">{p.why}</p>
        </div>
        <p className="caption-2 text-center text-text-muted">Example readings. The door admits under 60&nbsp;cm.</p>
      </div>
    </Section>
  )
}
