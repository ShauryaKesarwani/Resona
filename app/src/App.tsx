import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { RequireSignIn } from './components/RequireSignIn'
import Enter from './pages/Enter'
import Lab from './pages/Lab'
import Landing from './pages/Landing'
import NotFound from './pages/NotFound'
import SignIn from './pages/SignIn'
import { Stub } from './pages/Stub'
import Door from './pages/door/Door'
import Recent from './pages/door/Recent'
import CheckIn from './pages/wallet/CheckIn'
import Claim from './pages/wallet/Claim'
import Buy from './pages/events/Buy'
import Event from './pages/events/Event'
import Events from './pages/events/Events'
import Canvas from './pages/Canvas'
import Preview from './pages/Preview'
import Profile from './pages/Profile'
import Account from './pages/wallet/Account'
import Receipt from './pages/wallet/Receipt'
import Purchases from './pages/wallet/Purchases'
import Ticket from './pages/wallet/Ticket'
import Tickets from './pages/wallet/Tickets'
import Organizer from './pages/organizer/Organizer'
import Attendees from './pages/organizer/Attendees'
import Transfers from './pages/organizer/Transfers'
import Transfer from './pages/wallet/Transfer'

/** Planned screens: route, title, parent route for the back button, and what the screen will hold. */
const screens: { path: string; title: string; back: string; what: string }[] = [
  { path: '/privacy', title: 'Privacy', back: '/', what: 'The privacy policy is not written yet. Resona is a hackathon demo that runs on a test network.' },
  { path: '/terms', title: 'Terms', back: '/', what: 'The terms are not written yet. Resona is a hackathon demo that runs on a test network.' },
]

/** Anyone can open these without signing in. */
const isPublic = (s: (typeof screens)[number]) => ['/privacy', '/terms'].includes(s.path)

const stub = (s: (typeof screens)[number]) => (
  <Route key={s.path} path={s.path} element={<Stub title={s.title} back={s.back} what={s.what} />} />
)

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
        <Route path="/signin" element={<SignIn />} />
        <Route path="/events" element={<Events />} />
        <Route path="/e/:id" element={<Event />} />
        <Route path="/u/:name" element={<Profile />} />
        {import.meta.env.DEV && <Route path="/canvas" element={<Canvas />} />}
        {import.meta.env.DEV && <Route path="/preview" element={<Preview />} />}
        <Route path="/lab" element={<Lab />} />
        {screens.filter(isPublic).map(stub)}
        <Route element={<RequireSignIn />}>
          <Route path="/enter" element={<Enter />} />
          <Route path="/organizer" element={<Organizer />} />
          <Route path="/organizer/attendees" element={<Attendees />} />
          <Route path="/organizer/transfers" element={<Transfers />} />
          <Route path="/door" element={<Door />} />
          <Route path="/door/recent" element={<Recent />} />
          <Route path="/wallet" element={<Tickets />} />
          <Route path="/wallet/events" element={<Navigate to="/events" replace />} />
          <Route path="/e/:id/buy" element={<Buy />} />
          <Route path="/wallet/purchases" element={<Purchases />} />
          <Route path="/wallet/receipt/:txn" element={<Receipt />} />
          <Route path="/account" element={<Account />} />
          <Route path="/wallet/ticket/:id" element={<Ticket />} />
          <Route path="/wallet/claim/:id" element={<Claim />} />
          <Route path="/wallet/checkin/:id" element={<CheckIn />} />
          <Route path="/wallet/transfer/:id" element={<Transfer />} />
          {screens.filter((s) => !isPublic(s)).map(stub)}
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  )
}
