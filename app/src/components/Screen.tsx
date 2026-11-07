import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { WalletChip } from './Bits'
import { ArrowLeftIcon, WaveformIcon } from './icons'

/** One phone screen: safe areas respected, 16px side padding, content column capped on wide screens. */
export function Screen({ children, tabs = false }: { children: ReactNode; tabs?: boolean }) {
  return (
    <main
      id="main"
      className={`animate-screen-in mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 px-4 pt-[max(8px,env(safe-area-inset-top))] ${
        tabs ? 'pb-[calc(96px+env(safe-area-inset-bottom))]' : 'pb-[max(16px,env(safe-area-inset-bottom))]'
      }`}
    >
      {children}
    </main>
  )
}

/** The wordmark from the chosen direction. Screens with no parent, such as the tabs, show it instead of Back. */
function Brand() {
  return (
    <Link to="/" className="flex min-h-12 items-center gap-2 rounded-md">
      <WaveformIcon size={24} className="text-accent" aria-hidden="true" />
      <span className="title-2">Resona</span>
    </Link>
  )
}

/**
 * Back or the wordmark on the left, optional title, the wallet chip on the right.
 * `back` is the parent route, so deep links still work. Pass `right={null}` for no chip, during a task or before sign in.
 */
export function TopBar({ back, title, right = <WalletChip />, heading = false }: { back?: string; title?: string; right?: ReactNode; heading?: boolean }) {
  const Title = heading ? 'h1' : 'p'
  return (
    <header className="flex min-h-12 items-center gap-2">
      {back ? (
        <Link
          to={back}
          aria-label="Back"
          className="group -ml-1 grid size-12 shrink-0 place-items-center rounded-md border border-line bg-surface transition duration-300 ease-base hover:border-accent active:scale-[0.96]"
        >
          <ArrowLeftIcon size={20} aria-hidden="true" className="transition-transform duration-300 ease-base group-hover:-translate-x-0.5 group-active:-translate-x-0.5" />
        </Link>
      ) : (
        !title && <Brand />
      )}
      {title ? <Title className="title-2 min-w-0 flex-1 truncate">{title}</Title> : <div className="flex-1" />}
      {right}
    </header>
  )
}
