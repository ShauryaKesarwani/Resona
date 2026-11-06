import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeftIcon } from './icons'

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

/** Back button on the left, optional title, optional right slot. `back` is the parent route, so deep links still work. */
export function TopBar({ back, title, right, heading = false }: { back?: string; title?: string; right?: ReactNode; heading?: boolean }) {
  const Title = heading ? 'h1' : 'p'
  return (
    <header className="flex min-h-12 items-center gap-2">
      {back && (
        <Link
          to={back}
          aria-label="Back"
          className="-ml-1 grid size-12 shrink-0 place-items-center rounded-xl border border-line bg-surface-raised transition duration-300 ease-base hover:bg-surface-inset active:scale-[0.98]"
        >
          <ArrowLeftIcon size={20} aria-hidden="true" />
        </Link>
      )}
      {title && <Title className="title-2 min-w-0 flex-1 truncate">{title}</Title>}
      {!title && <div className="flex-1" />}
      {right}
    </header>
  )
}
