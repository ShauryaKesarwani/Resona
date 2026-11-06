import { BrowserRouter, Route, Routes } from 'react-router-dom'
import Enter from './pages/Enter'
import Landing from './pages/Landing'
import NotFound from './pages/NotFound'
import { Stub } from './pages/Stub'
import Claim from './pages/wallet/Claim'
import Ticket from './pages/wallet/Ticket'
import Tickets from './pages/wallet/Tickets'
import Transfer from './pages/wallet/Transfer'

/** Planned screens: route, title, parent route for the back button, and what the screen will hold. */
const screens: { path: string; title: string; back: string; what: string }[] = [
  { path: '/wallet/checkin/:id', title: 'Check in', back: '/wallet', what: 'Your ticket code, then the sound exchange with the door phone and the result.' },
  { path: '/door', title: 'Door', back: '/enter', what: 'Scan a ticket code, or type the pass number.' },
  { path: '/door/checking', title: 'Checking', back: '/door', what: 'Live progress while the phones exchange sound.' },
  { path: '/door/result', title: 'Result', back: '/door', what: 'Pass or fail with the holder name, avatar and distance.' },
  { path: '/door/manual', title: 'Admit manually', back: '/door', what: 'ID checked entry, logged against the staff member.' },
  { path: '/door/recent', title: 'Recent check ins', back: '/door', what: 'The latest check ins, read from Arkiv.' },
  { path: '/organizer', title: 'Event', back: '/enter', what: 'Event details and counts of issued, claimed and checked in passes.' },
  { path: '/organizer/issue', title: 'Issue passes', back: '/organizer', what: 'Enter ENS names, pick a tier and see the result for each name.' },
  { path: '/organizer/passes', title: 'Passes', back: '/organizer', what: 'Every pass, with a revoke action.' },
  { path: '/organizer/transfers', title: 'Transfer requests', back: '/organizer', what: 'Approve or deny, with the 24 hour countdown.' },
  { path: '/organizer/overrides', title: 'Manual entries', back: '/organizer', what: 'Who admitted whom without a sound check.' },
  { path: '/privacy', title: 'Privacy', back: '/', what: 'The privacy policy is not written yet. Resona is a hackathon demo that runs on a test network.' },
  { path: '/terms', title: 'Terms', back: '/', what: 'The terms are not written yet. Resona is a hackathon demo that runs on a test network.' },
  { path: '/u/:name', title: 'Profile', back: '/', what: 'Public trophy page: avatar, hash, ordinal and events attended.' },
]

export default function App() {
  return (
    <BrowserRouter>
      <a
        href="#main"
        className="sr-only rounded-lg bg-accent px-3 py-2 button-sm text-on-accent focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50"
      >
        Skip to content
      </a>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/enter" element={<Enter />} />
        <Route path="/wallet" element={<Tickets />} />
        <Route path="/wallet/ticket/:id" element={<Ticket />} />
        <Route path="/wallet/claim/:id" element={<Claim />} />
        <Route path="/wallet/transfer/:id" element={<Transfer />} />
        {screens.map((s) => (
          <Route key={s.path} path={s.path} element={<Stub title={s.title} back={s.back} what={s.what} />} />
        ))}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  )
}
