import { Nav } from './landing/Nav'
import { Benefits, BuiltOn, Hero, How, Problem } from './landing/Sections'
import { Faq, FinalCta, Footer, Limits } from './landing/Closing'
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
