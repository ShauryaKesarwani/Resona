import { useState, type FormEvent } from 'react'
import { CheckCircleIcon, WarningCircleIcon } from '../../components/icons'
import { StatusPill } from '../../components/Bits'
import { Button } from '../../components/Button'
import { Screen, TopBar } from '../../components/Screen'
import { api, type ServerTicket } from '../../services/api'
import { signedBy } from '../../services/auth'
import { walletAddress } from '../../utils/wallet'

const tiers = [
  { id: 'general', name: 'General admission' },
  { id: 'partner', name: 'Partner discount' },
  { id: 'builder', name: 'Builder' },
]
const tierName = (id: string) => tiers.find((t) => t.id === id)?.name ?? id

const isAddress = (v: string) => /^0x[a-fA-F0-9]{40}$/.test(v)
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`

const MESSAGES: Record<string, string> = {
  invalid_holder: 'That is not a wallet address.',
  arkiv_not_configured: 'The server cannot reach Arkiv. Check its keys, then try again.',
  not_organizer: `This wallet cannot issue tickets. Add ${walletAddress()} to ORGANIZER_WALLETS on the server, then restart it.`,
  bad_signature: 'The server could not confirm this wallet. Check the phone clock, then try again.',
}
const explain = (err: unknown) =>
  MESSAGES[(err as Error).message] ??
  ((err as Error).message.startsWith('request_failed')
    ? 'The server could not do that. Try again in a moment.'
    : 'Could not reach the Resona server. Check that it is running, then try again.')

/** Issue a ticket to a wallet address, and look up what a wallet holds. */
export default function Organizer() {
  const [mode, setMode] = useState<'issue' | 'lookup'>('issue')
  const [holder, setHolder] = useState('')
  const [tier, setTier] = useState(tiers[0].id)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [issued, setIssued] = useState<ServerTicket[]>([])

  const [lookup, setLookup] = useState('')
  const [found, setFound] = useState<ServerTicket[] | null>(null)
  const [lookupError, setLookupError] = useState('')
  const [looking, setLooking] = useState(false)

  async function issue(e: FormEvent) {
    e.preventDefault()
    const address = holder.trim()
    if (!address) return setError('Enter the wallet address to send the ticket to.')
    if (!isAddress(address)) return setError('A wallet address starts with 0x and has 42 characters.')
    setError('')
    setBusy(true)
    try {
      const ticket = await api.issue(address, tier, await signedBy(`issue:${address.toLowerCase()}:${tier}`))
      setIssued((list) => [ticket, ...list])
      setHolder('')
    } catch (err) {
      setError(explain(err))
    } finally {
      setBusy(false)
    }
  }

  async function search(e: FormEvent) {
    e.preventDefault()
    const address = lookup.trim()
    if (!isAddress(address)) return setLookupError('A wallet address starts with 0x and has 42 characters.')
    setLookupError('')
    setLooking(true)
    try {
      setFound(await api.tickets(address))
    } catch (err) {
      setFound(null)
      setLookupError(explain(err))
    } finally {
      setLooking(false)
    }
  }

  return (
    <Screen>
      <TopBar back="/enter" />
      <h1 className="heading-4">Issue tickets</h1>
      <Button to="/organizer/attendees" variant="secondary" size="md">View attendees and check-ins</Button>

      <div role="group" aria-label="What to do" className="grid grid-cols-2 gap-1 rounded-xl border border-line bg-surface-raised p-1">
        {(['issue', 'lookup'] as const).map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={mode === m}
            onClick={() => setMode(m)}
            className={`button-sm min-h-12 rounded-lg transition duration-300 ease-base active:scale-[0.98] ${
              mode === m ? 'bg-surface-high text-text' : 'text-text-muted'
            }`}
          >
            {m === 'issue' ? 'Issue' : 'Look up'}
          </button>
        ))}
      </div>

      {mode === 'issue' && (
        <form onSubmit={issue} noValidate className="flex flex-1 flex-col gap-4">
          <p className="body-3 max-w-prose text-text-muted">Send a ticket to a wallet address. It shows up in that person’s wallet.</p>
          <label className="flex flex-col gap-2">
            <span className="title-4">Wallet address</span>
            <input
              value={holder}
              onChange={(e) => setHolder(e.target.value)}
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="0x…"
              aria-invalid={!!error}
              aria-describedby="issue-error"
              className="min-h-14 rounded-xl border border-line bg-surface-raised px-4 font-mono text-base placeholder:text-text-muted"
            />
          </label>
          <button type="button" onClick={() => setHolder(walletAddress())} className="body-5 min-h-12 self-start rounded-lg px-1 text-accent">
            Use this phone’s wallet
          </button>

          <fieldset className="flex flex-col gap-2">
            <legend className="title-4 mb-2">Ticket tier</legend>
            {tiers.map((t) => (
              <label
                key={t.id}
                className={`body-5 flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-4 transition duration-300 ease-base ${
                  tier === t.id ? 'border-accent bg-surface-raised' : 'border-line text-text-muted'
                }`}
              >
                <input type="radio" name="tier" checked={tier === t.id} onChange={() => setTier(t.id)} className="size-4 accent-[var(--color-accent)]" />
                {t.name}
              </label>
            ))}
          </fieldset>

          <p id="issue-error" role={error ? 'alert' : undefined} className="body-6 text-danger empty:hidden">
            {error}
          </p>
          {issued[0] && (
            <p role="status" className="body-5 flex items-center gap-2 text-success">
              <CheckCircleIcon size={20} aria-hidden="true" />
              {tierName(issued[0].tier)} ticket sent to {short(issued[0].holder)}
            </p>
          )}
          <div className="flex-1" />
          <Button type="submit" busy={busy}>
            {busy ? 'Issuing ticket' : 'Issue ticket'}
          </Button>
        </form>
      )}

      {mode === 'lookup' && (
        <div className="flex flex-1 flex-col gap-4">
          {issued.length > 0 && (
            <section aria-labelledby="issued-title" className="flex flex-col gap-2">
              <h2 id="issued-title" className="heading-6">
                Issued in this session
              </h2>
              <ul className="flex flex-col gap-2">
                {issued.map((t) => (
                  <li key={t.passId} className="flex items-center gap-3 rounded-xl border border-line bg-surface-raised p-3">
                    <div className="min-w-0 flex-1">
                      <p className="title-3">{tierName(t.tier)}</p>
                      <p className="caption-5 font-mono text-text-muted [overflow-wrap:anywhere]">To {short(t.holder)}</p>
                    </div>
                    <StatusPill status={t.status} />
                  </li>
                ))}
              </ul>
            </section>
          )}
          <form onSubmit={search} noValidate className="flex flex-1 flex-col gap-4">
            <label className="flex flex-col gap-2">
              <span className="title-4">Wallet address</span>
              <input
                value={lookup}
                onChange={(e) => setLookup(e.target.value)}
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder="0x…"
                className="min-h-14 rounded-xl border border-line bg-surface-raised px-4 font-mono text-base placeholder:text-text-muted"
              />
            </label>
            <p role={lookupError ? 'alert' : undefined} className="body-6 text-danger empty:hidden">
              {lookupError}
            </p>
            {found && found.length === 0 && (
              <p className="body-6 flex items-center gap-2 text-text-muted">
                <WarningCircleIcon size={20} aria-hidden="true" />
                This wallet holds no tickets.
              </p>
            )}
            {found && found.length > 0 && (
              <ul className="flex flex-col gap-2">
                {found.map((t) => (
                  <li key={t.passId} className="flex items-center justify-between gap-3 rounded-xl border border-line p-3">
                    <span className="title-3">{tierName(t.tier)}</span>
                    <StatusPill status={t.status} />
                  </li>
                ))}
              </ul>
            )}
            <div className="flex-1" />
            <Button type="submit" busy={looking}>
              {looking ? 'Looking up' : 'Look up'}
            </Button>
          </form>
        </div>
      )}
    </Screen>
  )
}
