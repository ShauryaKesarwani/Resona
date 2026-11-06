import { Pulse } from '../../components/Pulse'
import { Section } from './Section'

/** A full width band of the waveform between the problem and the benefits: the moment the page turns from why to how. */
export function SoundBand() {
  return (
    <Section>
      <div className="relative -mx-4 grid h-56 overflow-hidden [mask-image:linear-gradient(transparent,#000_25%,#000_75%,transparent)] lg:mx-0 lg:h-72">
        <Pulse className="absolute top-1/2 left-1/2 size-[130%] max-w-none -translate-x-1/2 -translate-y-1/2 scale-x-[1.8] object-cover lg:scale-x-[1.3]" />
        </div>
      <p className="heading-5 lg:heading-4 mx-auto mt-6 max-w-[20ch] text-center [text-wrap:balance]">A few seconds of sound. That is the whole check.</p>
    </Section>
  )
}
