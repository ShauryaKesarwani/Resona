import type { ReactNode } from 'react'
import vortex from '../assets/hero-vortex.webp'
import figure from '../assets/figure-mono.webp'

/** The supplied artwork opens into the page; controls and copy stay native and readable. */
export function SceneHeading({ title, art = 'vortex', children }: { title: string; art?: 'vortex' | 'figure'; children?: ReactNode }) {
  return (
    <header className="relative -mx-4 isolate flex min-h-64 flex-col justify-end overflow-hidden px-4 pb-4 pt-24">
      <img
        src={art === 'vortex' ? vortex : figure}
        alt=""
        className="pointer-events-none absolute inset-0 -z-10 size-full object-cover"
        style={{
          objectPosition: art === 'vortex' ? '22% 62%' : '62% 48%',
          filter: art === 'figure' ? 'grayscale(1) brightness(0.55)' : 'brightness(0.9)',
          maskImage: 'linear-gradient(to bottom, transparent, black 12%, black 45%, transparent 94%)',
        }}
      />
      <div aria-hidden="true" className="mb-4 h-1 w-8 bg-accent" />
      <h1 className="heading-2 max-w-[12ch]">{title}</h1>
      {children}
    </header>
  )
}
