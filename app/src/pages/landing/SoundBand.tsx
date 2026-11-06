import { GatewayFlow } from '../../components/GatewayFlow'
import { Section } from './Section'

/** A full width band of converging streams between the problem and the benefits: two phones meeting is the whole check. Tap it for a ripple. */
export function SoundBand() {
  return (
    <Section>
      <GatewayFlow className="-mx-4 h-72 w-[calc(100%+2rem)] lg:mx-0 lg:h-96 lg:w-full" />
      <p className="heading-5 lg:heading-4 mx-auto mt-6 max-w-[20ch] text-center [text-wrap:balance]">Two phones, one sound between them. That is the whole check.</p>
    </Section>
  )
}
