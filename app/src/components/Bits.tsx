import type { ReactNode } from 'react'
import { CheckCircleIcon, CircleDashedIcon, FlaskIcon, SealCheckIcon, WarningCircleIcon } from './icons'
import { Link, useLocation } from 'react-router-dom'
import { avatarName, displayName, type Status } from '../data/mock'
import { useSignedIn } from '../services/auth'

const look: Record<Status, { label: string; icon: typeof CheckCircleIcon; cls: string }> = {
  issued: { label: 'Ready to claim', icon: CircleDashedIcon, cls: 'text-text' },
  claimed: { label: 'Claimed', icon: SealCheckIcon, cls: 'text-accent' },
  skipped: { label: 'Not verified', icon: WarningCircleIcon, cls: 'text-text-muted' },
  checked_in: { label: 'Checked in', icon: CheckCircleIcon, cls: 'text-success' },
  revoked: { label: 'Revoked', icon: WarningCircleIcon, cls: 'text-danger' },
}

/** Status is always icon plus words, never colour alone. */
export function StatusPill({ status, past }: { status: Status; past?: boolean }) {
  const l = past && status === 'issued' ? { ...look.issued, label: 'Not claimed', cls: 'text-text-muted' } : look[status]
  return (
    <span className={`caption-4 inline-flex shrink-0 items-center gap-1 rounded-full bg-line px-2 py-1 whitespace-nowrap ${l.cls}`}>
      <l.icon size={14} aria-hidden="true" />
      {l.label}
    </span>
  )
}

/** Marks anything that is not real data or a real action. */
export function SimTag({ children = 'Simulated' }: { children?: ReactNode }) {
  return (
    <span className="caption-4 inline-flex w-fit items-center gap-1 rounded-full border border-line px-2 py-0.5 whitespace-nowrap text-text-muted">
      <FlaskIcon size={12} aria-hidden="true" />
      {children}
    </span>
  )
}

/**
 * Top right of every screen: who this wallet is. Shows the short wallet address.
 * It opens Account, where the role switch and the on chain details are.
 */
export function WalletChip() {
  const signedIn = useSignedIn()
  const { pathname } = useLocation()
  const look = 'flex min-h-12 min-w-0 items-center gap-2 rounded-md border border-line px-2 transition duration-300 ease-base hover:border-accent active:scale-[0.96]'
  if (!signedIn) {
    return (
      <Link to={`/signin?next=${encodeURIComponent(pathname)}`} className={`${look} body-5 px-4`}>
        Sign in
      </Link>
    )
  }
  return (
    <Link to="/account" aria-label={`Account, ${displayName()}`} className={look}>
      <Avatar name={avatarName()} size={28} />
      <span className="body-5 max-w-36 truncate pr-1 font-mono">{displayName()}</span>
    </Link>
  )
}

/** One label and value line inside a panel. */
export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-4 px-4 py-3 not-first:border-t not-first:border-line">
      <span className="body-6 text-text-muted">{label}</span>
      <span className="body-5 text-right">{children}</span>
    </div>
  )
}

/** Initial in a circle. Stands in for a picture. */
export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="title-3 grid shrink-0 place-items-center rounded-full bg-surface-high"
      style={{ width: size, height: size }}
    >
      {name[0].toUpperCase()}
    </span>
  )
}
