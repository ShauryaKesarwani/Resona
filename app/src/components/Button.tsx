import type { ButtonHTMLAttributes, MouseEvent, ReactNode } from 'react'
import { Link } from 'react-router-dom'

type Props = {
  variant?: 'primary' | 'secondary'
  size?: 'lg' | 'md'
  to?: string
  /** Click handler for the link form, for transitions that run before navigating. */
  onLinkClick?: (e: MouseEvent<HTMLAnchorElement>) => void
  /** Disables the button while an action runs, so a double tap can't submit twice. */
  busy?: boolean
  children: ReactNode
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>

export function Button({ variant = 'primary', size = 'lg', to, onLinkClick, busy, children, className = '', ...rest }: Props) {
  const base =
    'inline-flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 transition duration-300 ease-base ' +
    'active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none ' +
    (size === 'lg' ? 'min-h-16 button-lg ' : 'min-h-12 button-md ')
  const look =
    variant === 'primary'
      ? 'bg-accent text-on-accent hover:bg-accent-hover'
      : 'bg-surface-raised text-text border border-line hover:bg-surface-inset'
  const cls = `${base}${look} ${className}`

  if (to) {
    return (
      <Link to={to} onClick={onLinkClick} className={cls}>
        {children}
      </Link>
    )
  }
  return (
    <button className={cls} disabled={busy || rest.disabled} aria-busy={busy || undefined} {...rest}>
      {children}
    </button>
  )
}
