import type { ReactNode } from 'react'

/** Opens and closes smoothly to its content's height. Closed content can't be focused. */
export function Collapse({ open, id, children }: { open: boolean; id?: string; children: ReactNode }) {
  return (
    <div
      id={id}
      inert={!open}
      className={`grid transition-[grid-template-rows,opacity] duration-300 ease-base ${open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
    >
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  )
}
