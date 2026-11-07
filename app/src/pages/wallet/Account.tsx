import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Avatar, Row } from '../../components/Bits'
import { Button } from '../../components/Button'
import { ArrowRightIcon, ArrowSquareOutIcon, CheckCircleIcon, CopyIcon } from '../../components/icons'
import { rememberRole, ROLES, roleFor, type Role } from '../../components/roles'
import { Screen, TopBar } from '../../components/Screen'
import { SignOutButton } from '../../components/SignOutButton'
import { avatarName, displayName, wallet } from '../../data/mock'
import { explorerAddress } from '../../services/arkiv'

/** The home for everything about you: how you are using the app, your wallet on chain, and moving it to another device. */
export default function Account() {
  const { pathname } = useLocation()
  const current = roleFor(pathname)
  const [copied, setCopied] = useState('')

  async function copy(what: string, value: string) {
    await navigator.clipboard?.writeText(value).catch(() => {})
    setCopied(what)
    setTimeout(() => setCopied(''), 2000)
  }

  return (
    <Screen tabs>
      <TopBar right={null} />
      <header className="flex flex-col items-center gap-2 pt-2 text-center">
        <Avatar name={avatarName()} size={64} />
        <h1 className={`heading-4 ${wallet.ens ? '' : 'font-mono'}`}>{displayName()}</h1>
        <button
          type="button"
          onClick={() => copy('address', wallet.address)}
          className="body-6 inline-flex min-h-12 max-w-full items-center gap-2 rounded-md px-2 text-text-muted transition duration-300 ease-base hover:text-text active:scale-[0.96]"
        >
          {copied === 'address' ? 'Address copied' : 'Copy wallet address'}
          {copied === 'address' ? (
            <CheckCircleIcon size={16} className="animate-pop shrink-0 text-success" aria-hidden="true" />
          ) : (
            <CopyIcon size={16} className="shrink-0" aria-hidden="true" />
          )}
        </button>
      </header>

      <section aria-labelledby="role" className="flex flex-col gap-2">
        <h2 id="role" className="title-4 text-text-muted">
          How you are using Resona
        </h2>
        <ul className="stagger flex flex-col border-y border-line">
          {(Object.keys(ROLES) as Role[]).map((role) => {
            const r = ROLES[role]
            const on = role === current
            return (
              <li key={role} className="not-first:border-t not-first:border-line">
                <Link
                  to={r.home}
                  onClick={() => rememberRole(role)}
                  aria-current={on ? 'true' : undefined}
                  className="group flex min-h-16 items-center gap-3 py-3 transition duration-300 ease-base active:scale-[0.99]"
                >
                  <r.icon size={24} className={`shrink-0 ${on ? 'text-accent' : 'text-text-muted'}`} aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="title-3 block">{r.title}</span>
                    <span className="caption-2 block text-text-muted">{r.caption}</span>
                  </span>
                  {on && <span className="caption-4 text-accent">Now</span>}
                  <ArrowRightIcon size={20} className="shrink-0 text-accent transition-transform duration-300 ease-base group-hover:translate-x-1 group-active:translate-x-1" aria-hidden="true" />
                </Link>
              </li>
            )
          })}
        </ul>
      </section>

      <section aria-labelledby="chain" className="flex flex-col gap-2">
        <h2 id="chain" className="title-4 text-text-muted">
          On chain
        </h2>
        <div className="border-y border-line">
          <Row label="Network">{wallet.network} test network</Row>
          <Row label="This wallet">
            <a href={explorerAddress(wallet.address)} target="_blank" rel="noreferrer" className="inline-flex min-h-12 items-center gap-1 text-accent">
              See on the explorer
              <ArrowSquareOutIcon size={16} aria-hidden="true" />
            </a>
          </Row>
          <Row label="Payments">
            <Link to="/wallet/purchases" state={{ back: '/account' }} className="inline-flex min-h-12 items-center text-accent">
              See purchases
            </Link>
          </Row>
          <Row label="Attendance">
            <Link to={`/u/${wallet.address}`} className="inline-flex min-h-12 items-center text-accent">
              See your trophies
            </Link>
          </Row>
        </div>
      </section>

      <section aria-labelledby="backup" className="flex flex-col gap-3">
        <h2 id="backup" className="title-4 text-text-muted">
          Keep this account safe
        </h2>
        <p className="body-6 text-text-muted">This wallet lives on this phone. Save an encrypted account file now, so you can move it to a new phone or browser later.</p>
        <Button variant="secondary" size="md" to="/account-transfer">
          Save or move this account
        </Button>
      </section>

      <SignOutButton />
    </Screen>
  )
}
