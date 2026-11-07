import { Nav } from './landing/Nav'
import { Benefits } from './landing/Benefits'
import { BuiltOn, Hero } from './landing/Sections'
import { Problem } from './landing/Problem'
import { Faq, FinalCta, Footer } from './landing/Closing'
import { How } from './landing/How'
import { DoorLog } from './landing/DoorLog'
import { SoundBand } from './landing/SoundBand'

/** Landing page, in the approved section order. */
export default function Landing() {
  return (
    <>
      <Nav />
      <main id="main">
        <Hero />
        <BuiltOn />
        <Problem />
        <SoundBand />
        <Benefits />
        <How />
        <DoorLog />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </>
  )
}
