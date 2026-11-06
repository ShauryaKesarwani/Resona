import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { BuildingsIcon, CaretRightIcon, DoorOpenIcon, WalletIcon } from '../components/icons'
import { Figure } from '../components/Figure'
import { Screen, TopBar } from '../components/Screen'

function Role({ to, icon, title, caption }: { to: string; icon: ReactNode; title: string; caption: string }) {
  return (
    <Link
      to={to}
      className="flex min-h-16 items-center gap-3 rounded-xl border border-line bg-surface-raised p-3 transition duration-300 ease-base hover:bg-surface-inset active:scale-[0.98]"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-surface-high text-accent">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="title-3 block">{title}</span>
        <span className="body-6 block text-text-muted">{caption}</span>
      </span>
      <CaretRightIcon size={20} className="text-text-muted" aria-hidden="true" />
    </Link>
  )
}

/** Role picker. One URL for judges, so each phone chooses what it is. */
export default function Enter() {
  return (
    <Screen>
      <TopBar back="/" />
      <Figure ratio="16 / 10" />
      <h1 className="heading-4 mt-2">Choose how you are using Resona</h1>
      <p className="body-3 text-text-muted">Each phone in the demo picks a role. You can come back and switch.</p>
      <div className="flex-1" />
      <nav aria-label="Roles" className="flex flex-col gap-2">
        <Role to="/wallet" icon={<WalletIcon size={20} />} title="Attendee" caption="Hold tickets, claim and check in" />
        <Role to="/door" icon={<DoorOpenIcon size={20} />} title="Door staff" caption="Scan tickets and admit people" />
        <Role to="/organizer" icon={<BuildingsIcon size={20} />} title="Organizer" caption="Issue passes and approve transfers" />
      </nav>
    </Screen>
  )
}
