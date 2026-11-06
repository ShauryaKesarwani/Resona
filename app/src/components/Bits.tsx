import type { ReactNode } from 'react'
import { CheckCircleIcon, CircleDashedIcon, FlaskIcon, SealCheckIcon } from '@phosphor-icons/react'
import { short, wallet, type Status } from '../data/mock'

const look: Record<Status, { label: string; icon: typeof CheckCircleIcon; cls: string }> = {
  issued: { label: 'Ready to claim', icon: CircleDashedIcon, cls: 'text-text' },
  claimed: { label: 'Claimed', icon: SealCheckIcon, cls: 'text-accent' },
  checked_in: { label: 'Checked in', icon: CheckCircleIcon, cls: 'text-success' },
}

/** Status is always icon plus words, never colour alone. */
export function StatusPill({ status }: { status: Status }) {
  const l = look[status]
  return (
    <span className={`caption-4 inline-flex shrink-0 items-center gap-1 rounded-full bg-line px-2 py-1 ${l.cls}`}>
      <l.icon size={14} aria-hidden="true" />
      {l.label}
    </span>
  )
}

/** Marks anything that is not real data or a real action. */
export function SimTag({ children = 'Simulated' }: { children?: ReactNode }) {
  return (
    <span className="caption-4 inline-flex items-center gap-1 rounded-full border border-line px-2 py-0.5 text-text-muted">
      <FlaskIcon size={12} aria-hidden="true" />
      {children}
    </span>
  )
}

/** Wallet chip: name, short address, network. Sits top right of wallet screens. */
export function WalletChip() {
  return (
    <div className="flex min-h-12 items-center gap-2 rounded-xl border border-line bg-surface-raised px-3">
      <span className="caption-3 grid size-6 place-items-center rounded-full bg-surface-high" aria-hidden="true">
        {wallet.name[0].toUpperCase()}
      </span>
      <span className="min-w-0 leading-none">
        <span className="body-5 block truncate">{wallet.name}</span>
        <span className="caption-5 block font-mono text-text-muted">{short(wallet.address)}</span>
      </span>
      <span className="caption-5 flex items-center gap-1 text-text-muted">
        <span className="size-2 rounded-full bg-accent" aria-hidden="true" />
        {wallet.network}
      </span>
    </div>
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
