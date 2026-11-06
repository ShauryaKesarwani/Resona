import { useEffect, useRef, useState } from 'react'

const text = 'Be close enough to hear it, and the door opens. Anywhere else, it stays shut.'

/** Large type that lights up one word at a time as each crosses a line 55% down the screen. */
export function Tagline() {
  const words = text.split(' ')
  const refs = useRef<(HTMLSpanElement | null)[]>([])
  const [lit, setLit] = useState<Set<number>>(new Set())
  const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  useEffect(() => {
    if (reduce) return
    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries.filter((e) => e.isIntersecting).map((e) => Number((e.target as HTMLElement).dataset.i))
        if (!hit.length) return
        setLit((prev) => new Set([...prev, ...hit]))
        hit.forEach((i) => io.unobserve(refs.current[i]!))
      },
      { rootMargin: '0px 0px -45% 0px' },
    )
    refs.current.forEach((el) => el && io.observe(el))
    return () => io.disconnect()
  }, [reduce])

  return (
    <section aria-label="Tagline" className="px-4 py-24 sm:px-6 lg:px-8 lg:py-32">
      <p className="heading-3 sm:heading-2 lg:heading-1 mx-auto w-full max-w-[680px] lg:max-w-5xl">
        {words.map((w, i) => {
          const on = reduce || lit.has(i)
          return (
            <span
              key={i}
              ref={(el) => {
                refs.current[i] = el
              }}
              data-i={i}
              className={`inline-block transition duration-500 ease-base ${on ? 'opacity-100' : 'opacity-30'}`}
              style={{ transitionDelay: on ? `${(i % 6) * 60}ms` : '0ms', marginRight: '0.25em' }}
            >
              {w}
            </span>
          )
        })}
      </p>
    </section>
  )
}
