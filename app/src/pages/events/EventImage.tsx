import vortex from '../../assets/hero-vortex.webp'
import { eventArt } from './art'

/** The brand image, framed differently for every event. */
export function EventImage({ eventId, ratio, className = '' }: { eventId: string; ratio: string; className?: string }) {
  const { zoom, origin } = eventArt(eventId)
  return (
    <div className={`overflow-hidden bg-surface ${className}`} style={{ aspectRatio: ratio }}>
      <img
        src={vortex}
        alt=""
        decoding="async"
        className="size-full object-cover brightness-[0.85]"
        style={{ transform: `scale(${zoom})`, transformOrigin: origin }}
      />
    </div>
  )
}
