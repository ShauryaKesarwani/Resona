import { NavLink } from 'react-router-dom'
import { CalendarStarIcon, TicketIcon, UserCircleIcon } from './icons'

const tabs = [
  { to: '/events', label: 'Events', icon: CalendarStarIcon },
  { to: '/wallet', label: 'Tickets', icon: TicketIcon },
  { to: '/account', label: 'Account', icon: UserCircleIcon },
]

/** The attendee's three homes. Fixed to the bottom, in the thumb zone. The active tab changes shape as well as colour. */
export function AttendeeTabs() {
  return (
    <nav aria-label="Attendee" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface-raised pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto grid max-w-md grid-cols-3 gap-2 p-2">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end
            className={({ isActive }) =>
              `flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl px-2 transition duration-300 ease-base active:scale-[0.98] ${
                isActive ? 'bg-surface-high text-text' : 'text-text-muted'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <t.icon size={22} aria-hidden="true" />
                <span className={isActive ? 'caption-3' : 'caption-4'}>{t.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
