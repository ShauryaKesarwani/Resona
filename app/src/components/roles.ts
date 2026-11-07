import { CalendarBlankIcon, ClockCounterClockwiseIcon, DoorOpenIcon, SlidersHorizontalIcon, TicketIcon, UserIcon, UsersIcon, type Icon } from './icons'

export type Role = 'attendee' | 'door' | 'organizer'
type Tab = { to: string; label: string; icon: Icon }

const account: Tab = { to: '/account', label: 'Account', icon: UserIcon }

/** Each way of using the app has its own home and its own three tabs. Account is always the third. */
export const ROLES: Record<Role, { title: string; caption: string; home: string; icon: Icon; tabs: Tab[] }> = {
  attendee: {
    title: 'Attendee',
    caption: 'Find events, hold tickets and check in',
    home: '/wallet',
    icon: TicketIcon,
    tabs: [{ to: '/events', label: 'Events', icon: CalendarBlankIcon }, { to: '/wallet', label: 'Tickets', icon: TicketIcon }, account],
  },
  door: {
    title: 'Door staff',
    caption: 'Scan tickets and admit people',
    home: '/door',
    icon: DoorOpenIcon,
    tabs: [{ to: '/door', label: 'Door', icon: DoorOpenIcon }, { to: '/door/recent', label: 'Check ins', icon: ClockCounterClockwiseIcon }, account],
  },
  organizer: {
    title: 'Organizer',
    caption: 'Publish events and issue tickets',
    home: '/organizer',
    icon: SlidersHorizontalIcon,
    tabs: [{ to: '/organizer', label: 'Manage', icon: SlidersHorizontalIcon }, { to: '/organizer/attendees', label: 'Attendees', icon: UsersIcon }, account],
  },
}

const ROLE_KEY = 'resona.role'

/** The route says which role you are in. Account belongs to all three, so it uses the last one. */
export function roleFor(pathname: string): Role {
  if (pathname.startsWith('/door')) return 'door'
  if (pathname.startsWith('/organizer')) return 'organizer'
  if (pathname === '/account') return (localStorage.getItem(ROLE_KEY) as Role | null) ?? 'attendee'
  return 'attendee'
}

export const rememberRole = (role: Role) => localStorage.setItem(ROLE_KEY, role)
