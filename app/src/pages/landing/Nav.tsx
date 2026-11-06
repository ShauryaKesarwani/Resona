import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

const links = [
  { href: '#how', label: 'How it works' },
  { href: '#limits', label: 'What it stops' },
  { href: '#faq', label: 'Questions' },
]

/** Floating bar. Mobile opens a full height panel whose links arrive 60ms apart. */
export function Nav() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    document.documentElement.style.overflow = open ? 'hidden' : ''
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.documentElement.style.overflow = ''
    }
  }, [open])

  return (
    <>
      <div className="fixed inset-x-0 top-[max(8px,env(safe-area-inset-top))] z-40 flex justify-center px-4">
        <nav
          aria-label="Main"
          className="flex w-full items-center justify-between gap-6 rounded-2xl border border-line bg-surface-raised/70 p-2 pl-4 backdrop-blur-md sm:w-auto"
        >
          <Link to="/" className="title-2 rounded-lg">
            Resona
          </Link>
          <ul className="hidden items-center gap-1 sm:flex">
            {links.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  className="body-5 block rounded-lg px-3 py-2 text-text-muted transition duration-300 ease-base hover:bg-surface-inset hover:text-text"
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
          <button
            type="button"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            aria-controls="menu"
            onClick={() => setOpen(!open)}
            className="relative grid size-12 place-items-center rounded-xl transition duration-300 ease-base hover:bg-surface-inset active:scale-[0.98] sm:hidden"
          >
            <span
              className={`absolute h-0.5 w-5 rounded-full bg-text transition duration-500 ease-base ${open ? 'rotate-45' : '-translate-y-1.5'}`}
            />
            <span
              className={`absolute h-0.5 w-5 rounded-full bg-text transition duration-500 ease-base ${open ? '-rotate-45' : 'translate-y-1.5'}`}
            />
          </button>
        </nav>
      </div>

      <div
        id="menu"
        inert={!open}
        className={`fixed inset-0 z-30 flex flex-col justify-center bg-surface/90 px-4 backdrop-blur-xl transition duration-500 ease-base sm:hidden ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
        <ul className="flex flex-col gap-2">
          {links.map((l, i) => (
            <li
              key={l.href}
              className={`transition duration-500 ease-base ${open ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'}`}
              style={{ transitionDelay: open ? `${i * 60}ms` : '0ms' }}
            >
              <a
                href={l.href}
                onClick={() => setOpen(false)}
                className="heading-4 block rounded-xl px-3 py-3 transition duration-300 ease-base hover:bg-surface-inset"
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </>
  )
}
