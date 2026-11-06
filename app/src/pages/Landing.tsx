import { Nav } from './landing/Nav'
import { Benefits } from './landing/Benefits'
import { BuiltOn, Hero } from './landing/Sections'
import { Problem } from './landing/Problem'
import { Faq, FinalCta, Footer } from './landing/Closing'
import { How } from './landing/How'
import { Limits } from './landing/Limits'
import { SoundBand } from './landing/SoundBand'
import { Tagline } from './landing/Tagline'

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
        <Tagline />
        <How />
        <Limits />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </>
  )
}
