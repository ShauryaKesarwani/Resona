import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useOutletContext } from 'react-router-dom'
import { rememberRole, ROLES, roleFor } from './roles'

/** Stays mounted across tab screens, so the marker slides between tabs and the bar never flickers. */
export function TabLayout() {
  const { pathname } = useLocation()
  const [hidden, setHidden] = useState(false)
  const role = roleFor(pathname)
  const tabs = ROLES[role].tabs
  const active = tabs.findIndex((t) => t.to === pathname)

  useEffect(() => rememberRole(role), [role])

  return (
    <>
      <Outlet context={setHidden} />
      {!hidden && (
        <nav aria-label={ROLES[role].title} className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]">
          <div className="relative mx-auto grid max-w-md grid-cols-3">
            <span
              aria-hidden="true"
              className="absolute -top-px left-0 h-px w-1/3 bg-accent transition-transform duration-500 ease-base"
              style={{ transform: `translateX(${Math.max(active, 0) * 100}%)`, opacity: active < 0 ? 0 : 1 }}
            />
            {tabs.map((t) => (
              <NavLink
                key={t.to}
                to={t.to}
                end
                className={({ isActive }) =>
                  `flex min-h-16 flex-col items-center justify-center gap-1 px-2 transition duration-300 ease-base active:scale-[0.96] ${isActive ? 'text-accent' : 'text-text-muted'}`
                }
              >
                {({ isActive }) => (
                  <>
                    <t.icon size={24} aria-hidden="true" className={`transition-transform duration-300 ease-base ${isActive ? '-translate-y-0.5' : ''}`} />
                    <span className="caption-4">{t.label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </nav>
      )}
    </>
  )
}

/** A screen in the middle of a task, such as a running check in, hides the tab bar. */
export function useHideTabs(hide: boolean) {
  const setHidden = useOutletContext<(hide: boolean) => void>()
  useEffect(() => {
    setHidden(hide)
    return () => setHidden(false)
  }, [hide, setHidden])
}
