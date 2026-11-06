import { useState, type FormEvent } from 'react'
import { AttendeeTabs } from '../../components/AttendeeTabs'
import { Avatar, Row } from '../../components/Bits'
import { Button } from '../../components/Button'
import { CheckCircleIcon, CopyIcon, KeyIcon } from '../../components/icons'
import { Screen, TopBar } from '../../components/Screen'
import { SignOutButton } from '../../components/SignOutButton'
import { short, wallet } from '../../data/mock'
import { walletAccount } from '../../utils/wallet'

const WALLET_KEY = 'resona.walletKey'

/** Your wallet is a key on this phone. This screen shows the address and lets you save or restore that key. */
export default function Account() {
  const [shown, setShown] = useState(false)
  const [copied, setCopied] = useState('')
  const [restoring, setRestoring] = useState(false)
  const [entered, setEntered] = useState('')
  const [error, setError] = useState('')

  const key = () => {
    walletAccount() // makes the key if this phone has none yet
    return localStorage.getItem(WALLET_KEY)!
  }
  async function copy(what: string, value: string) {
    await navigator.clipboard?.writeText(value).catch(() => {})
    setCopied(what)
    setTimeout(() => setCopied(''), 2000)
  }

  function restore(e: FormEvent) {
    e.preventDefault()
    const value = entered.trim()
    if (!/^0x[a-fA-F0-9]{64}$/.test(value)) return setError('A recovery key starts with 0x and has 66 characters.')
    localStorage.setItem(WALLET_KEY, value)
    window.location.assign('/wallet')
  }

  return (
    <Screen tabs>
      <TopBar back="/" />
      <header className="flex flex-col items-center gap-2 pt-2 text-center">
        <Avatar name={wallet.name} size={64} />
        <h1 className="heading-4">{wallet.name}</h1>
        <button
          type="button"
          onClick={() => copy('address', wallet.address)}
          className="body-6 inline-flex min-h-12 max-w-full items-center gap-2 rounded-lg px-2 font-mono text-text-muted [overflow-wrap:anywhere]"
        >
          {short(wallet.address)}
          {copied === 'address' ? <CheckCircleIcon size={16} className="shrink-0 text-success" aria-label="Copied" /> : <CopyIcon size={16} className="shrink-0" aria-hidden="true" />}
        </button>
      </header>

      <div className="rounded-2xl border border-line bg-surface-raised p-2">
        <div className="rounded-lg bg-surface-inset">
          <Row label="Network">{wallet.network}</Row>
          <Row label="Public profile">
            <a href={`/u/${wallet.address}`} className="inline-flex min-h-12 items-center text-accent">
              Open
            </a>
          </Row>
        </div>
      </div>

      <section aria-labelledby="backup" className="flex flex-col gap-3">
        <h2 id="backup" className="heading-6 flex items-center gap-2">
          <KeyIcon size={20} className="text-accent" aria-hidden="true" />
          Recovery key
        </h2>
        <p className="body-6 text-text-muted">
          This wallet lives on this phone. If you clear the browser or change phones, your tickets stay on Arkiv but you lose the wallet that holds them. Save the key somewhere private. This is a test network key.
        </p>
        {shown && (
          <>
            <p className="rounded-xl border border-line bg-surface-raised p-4 font-mono text-sm [overflow-wrap:anywhere]">{key()}</p>
            <Button variant="secondary" size="md" onClick={() => copy('key', key())}>
              {copied === 'key' ? 'Key copied' : 'Copy key'}
            </Button>
          </>
        )}
        <Button variant="secondary" size="md" onClick={() => setShown(!shown)} aria-expanded={shown}>
          {shown ? 'Hide recovery key' : 'Show recovery key'}
        </Button>
      </section>

      <section aria-labelledby="restore" className="flex flex-col gap-3">
        <h2 id="restore" className="heading-6">
          Restore a wallet
        </h2>
        {!restoring ? (
          <Button variant="secondary" size="md" onClick={() => setRestoring(true)}>
            Restore from a key
          </Button>
        ) : (
          <form onSubmit={restore} noValidate className="flex flex-col gap-3">
            <p className="body-6 text-text-muted">This replaces the wallet on this phone. Save the current key first if you still need it.</p>
            <input
              value={entered}
              onChange={(e) => setEntered(e.target.value)}
              aria-label="Recovery key"
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="0x…"
              className="min-h-14 rounded-xl border border-line bg-surface-raised px-4 font-mono text-base placeholder:text-text-muted"
            />
            <p role={error ? 'alert' : undefined} className="body-6 text-danger empty:hidden">
              {error}
            </p>
            <Button type="submit" size="md">
              Replace this wallet
            </Button>
          </form>
        )}
      </section>

      <div className="flex-1" />
      <SignOutButton />
      <AttendeeTabs />
    </Screen>
  )
}
