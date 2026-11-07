import { useEffect, useState } from 'react'
import { allEvents, recentCheckins } from '../services/arkiv'

type Frame = { title: string; path: string }
type Group = { name: string; frames: Frame[] }

/** Dev only. Every screen in a phone frame on one page, for looking at the whole app at once. */
export default function Canvas() {
  const [scale, setScale] = useState(0.9)
  const [width, setWidth] = useState(390)
  const [eventId, setEventId] = useState('missing')
  const [holder, setHolder] = useState('0x0000000000000000000000000000000000000001')

  useEffect(() => {
    localStorage.setItem('resona.guest', 'true') // so guarded screens open inside the frames
    allEvents().then((e) => e[0] && setEventId(e[0].eventId)).catch(() => {})
    recentCheckins().then((c) => c[0] && setHolder(c[0].holder)).catch(() => {})
  }, [])

  const groups: Group[] = [
    { name: 'Start', frames: [
      { title: 'Landing', path: '/' }, { title: 'Sign in', path: '/signin' }, 
    ] },
    { name: 'Events and buying', frames: [
      { title: 'Events', path: '/events' }, { title: 'Event', path: `/e/${eventId}` }, { title: 'Buy', path: `/e/${eventId}/buy` },
    ] },
    { name: 'Wallet', frames: [
      { title: 'Tickets', path: '/wallet' }, { title: 'Account', path: '/account' }, { title: 'Receipt, not found', path: '/wallet/receipt/none' }, { title: 'Purchases', path: '/wallet/purchases' }, { title: 'Ticket, not found', path: '/wallet/ticket/none' },
      { title: 'Claim, not found', path: '/wallet/claim/none' }, { title: 'Check in, not found', path: '/wallet/checkin/none' }, { title: 'Send, not found', path: '/wallet/transfer/none' },
    ] },
    { name: 'Door and organizer', frames: [
      { title: 'Door', path: '/door' }, { title: 'Recent check ins', path: '/door/recent' }, { title: 'Organizer', path: '/organizer' }, { title: 'Attendees', path: '/organizer/attendees' }, { title: 'Check in visuals', path: '/preview' },
    ] },
    { name: 'Public and other', frames: [
      { title: 'Profile', path: `/u/${holder}` }, { title: 'Profile, bad link', path: '/u/nobody' }, { title: 'Privacy', path: '/privacy' },
      { title: 'Terms', path: '/terms' }, { title: 'Page not found', path: '/nope' }, { title: 'Sonar lab', path: '/lab' },
    ] },
  ]

  const height = Math.round(width * (844 / 390))
  return (
    <div className="min-h-dvh bg-surface px-6 py-6">
      <header className="sticky top-0 z-10 -mx-6 mb-8 flex flex-wrap items-center gap-6 border-b border-line bg-surface px-6 pb-4">
        <h1 className="title-2">All screens</h1>
        <label className="body-5 flex items-center gap-3">
          Zoom {Math.round(scale * 100)}%
          <input type="range" min="0.3" max="1" step="0.05" value={scale} onChange={(e) => setScale(+e.target.value)} />
        </label>
        <label className="body-5 flex items-center gap-3">
          Width
          {[360, 390, 430].map((w) => (
            <button key={w} onClick={() => setWidth(w)} className={`min-h-12 rounded-lg px-3 ${width === w ? 'bg-surface-high' : 'text-text-muted'}`}>
              {w}
            </button>
          ))}
        </label>
        <p className="body-6 text-text-muted">Not found frames need a real ticket id, so open a real ticket from Tickets to see the full screen.</p>
      </header>

      {groups.map((g) => (
        <section key={g.name} className="mb-12">
          <h2 className="title-1 mb-4">{g.name}</h2>
          <div className="flex flex-wrap gap-8 overflow-x-auto">
            {g.frames.map((f) => (
              <figure key={f.title} className="flex shrink-0 flex-col gap-2" style={{ width: width * scale }}>
                <figcaption className="flex items-center justify-between gap-2">
                  <span className="body-5">{f.title}</span>
                  <a href={f.path} target="_blank" rel="noreferrer" className="body-6 text-accent">Open</a>
                </figcaption>
                <div className="overflow-hidden rounded-2xl border border-line bg-black" style={{ width: width * scale, height: height * scale }}>
                  <iframe
                    title={f.title}
                    src={f.path}
                    loading="lazy"
                    style={{ width, height, transform: `scale(${scale})`, transformOrigin: '0 0', border: 0 }}
                  />
                </div>
              </figure>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
