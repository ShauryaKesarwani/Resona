import type { ReactNode } from 'react'
import { Reveal } from '../../components/Reveal'

/** Shared page container. Vertical rhythm is 64px on phones and 96px from large screens. */
export function Section({ id, children, className = '' }: { id?: string; children: ReactNode; className?: string }) {
  return (
    <section id={id} className={`scroll-mt-24 px-4 py-16 sm:px-6 lg:px-8 lg:py-24 ${className}`}>
      <Reveal className="mx-auto w-full max-w-5xl">{children}</Reveal>
    </section>
  )
}

/** A tiny faded aside under a heading. Use only where the joke lands on its own. */
export function Aside({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <p className={`caption-5 text-text-muted/50 ${className}`}>{children}</p>
}

/** Card with an inset panel. Outer radius 16 and 8px padding, so the inner radius is 8. */
export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-line bg-surface-raised p-2 ${className}`}>
      <div className="h-full rounded-lg bg-surface-inset p-4">{children}</div>
    </div>
  )
}
