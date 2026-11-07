import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRightIcon, CheckCircleIcon, WarningCircleIcon } from '../../components/icons'
import { StatusPill } from '../../components/Bits'
import { Button } from '../../components/Button'
import { Collapse } from '../../components/Collapse'
import { Screen, TopBar } from '../../components/Screen'
import { Segmented } from '../../components/Segmented'
import { api, type ServerTicket } from '../../services/api'
import { organizerEvents, type ArkivEvent } from '../../services/arkiv'
import { signedBy } from '../../services/auth'
import { walletAddress } from '../../utils/wallet'
import { DoorCount } from './DoorCount'
import { NewEvent } from './NewEvent'

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
  not_organizer: 'This account is not an organizer yet. Ask an existing admin to add it.',
  organizer_login_required: 'Sign in with World ID using this wallet before opening organizer tools.',
  event_not_owned: 'This event is not assigned to this organizer.',
  event_required: 'Choose an event first.',
  world_account_not_found: 'That wallet has no World-linked Resona account yet. Ask them to sign in first.',
  arkiv_write_failed: 'The organizer could not be saved to Arkiv. Try again in a moment.',
  bad_signature: 'The server could not confirm this wallet. Check the phone clock, then try again.',
  ens_name_not_found: 'That ENS name could not be found.',
  ens_address_not_set: 'That ENS name has no wallet address set.',
  invalid_ens_name: 'Enter a valid ENS name or wallet address.',
  ens_lookup_unavailable: 'ENS lookup is unavailable. Try again in a moment.',
}
const explain = (err: unknown) =>
  MESSAGES[(err as Error).message] ??
  ((err as Error).message.startsWith('request_failed')
    ? 'The server could not do that. Try again in a moment.'
    : 'Could not reach the Resona server. Check that it is running, then try again.')

/** Issue a ticket to a wallet address, and look up what a wallet holds. */
export default function Organizer() {
  const [adding, setAdding] = useState(false)
  const [mode, setMode] = useState<'issue' | 'lookup' | 'event' | 'door'>('issue')
  const [holder, setHolder] = useState('')
  const [tier, setTier] = useState(tiers[0].id)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [issued, setIssued] = useState<ServerTicket[]>([])
  const [issuedName, setIssuedName] = useState('')
  const [events, setEvents] = useState<ArkivEvent[]>([])
  const [eventId, setEventId] = useState('')
  const [eventsError, setEventsError] = useState('')
  const [newOrganizer, setNewOrganizer] = useState('')
  const [promoteError, setPromoteError] = useState('')
  const [promoting, setPromoting] = useState(false)
  const [promoted, setPromoted] = useState('')

  useEffect(() => {
    organizerEvents().then((rows) => {
      setEvents(rows)
      setEventId((current) => rows.some((row) => row.eventId === current) ? current : rows[0]?.eventId ?? '')
    }).catch(() => setEventsError('Could not load events from Arkiv. Try again.'))
  }, [])

  const [lookup, setLookup] = useState('')
  const [found, setFound] = useState<ServerTicket[] | null>(null)
  const [lookupResolved, setLookupResolved] = useState<{ name: string; address: string } | null>(null)
  const [lookupError, setLookupError] = useState('')
  const [looking, setLooking] = useState(false)

  async function issue(e: FormEvent) {
    e.preventDefault()
    const target = holder.trim()
    if (!target) return setError('Enter the wallet address or ENS name to send the ticket to.')
    if (!eventId) return setError('Create or choose an event before issuing tickets.')
    setError('')
    setIssuedName('')
    setBusy(true)
    try {
      const resolved = isAddress(target) ? undefined : await api.ensResolve(target)
      const address = resolved?.address ?? target
      const ticket = await api.issue(address, tier, eventId, await signedBy(`issue:${eventId}:${address.toLowerCase()}:${tier}`))
      setIssued((list) => [ticket, ...list])
      setIssuedName(resolved?.name ?? '')
      setHolder('')
    } catch (err) {
      setError(explain(err))
    } finally {
      setBusy(false)
    }
  }

  async function search(e: FormEvent) {
    e.preventDefault()
    const query = lookup.trim()
    if (!query) return setLookupError('Enter a wallet address or ENS name.')
    setLookupError('')
    setLookupResolved(null)
    setLooking(true)
    try {
      const resolution = isAddress(query) ? undefined : await api.ensResolve(query)
      const address = resolution?.address ?? query
      if (resolution) setLookupResolved(resolution)
      setFound(await api.tickets(address))
    } catch (err) {
      setFound(null)
      setLookupError(explain(err))
    } finally {
      setLooking(false)
    }
  }

  async function promote(e: FormEvent) {
    e.preventDefault()
    const address = newOrganizer.trim()
    if (!isAddress(address)) return setPromoteError('Enter a wallet address that already has a World-linked Resona account.')
    setPromoteError('')
    setPromoted('')
    setPromoting(true)
    try {
      await api.promoteOrganizer(address, await signedBy(`organizer:promote:${address.toLowerCase()}`))
      setPromoted(address)
      setNewOrganizer('')
    } catch (err) {
      setPromoteError(explain(err))
    } finally {
      setPromoting(false)
    }
  }

  return (
    <Screen tabs>
      <TopBar />
      <div className="flex items-center justify-between gap-4">
        <h1 className="heading-3">Organizer</h1>
        <button type="button" aria-expanded={adding} onClick={() => setAdding(!adding)} className="body-5 min-h-12 rounded-md px-1 text-accent">
          {adding ? 'Cancel' : 'Add an organizer'}
        </button>
      </div>

      <Collapse open={adding}>
        <form onSubmit={promote} noValidate className="flex flex-col gap-3 border-y border-line py-4">
          <p className="body-6 text-text-muted">Promote someone who already signed in with World ID. They can then manage their own events.</p>
          <label className="flex flex-col gap-2">
            <span className="title-4">Their wallet address</span>
            <input value={newOrganizer} onChange={(e) => setNewOrganizer(e.target.value)} autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder="0x…" className="field font-mono" />
          </label>
          {promoteError && <p role="alert" className="body-6 text-danger">{promoteError}</p>}
          {promoted && <p role="status" className="body-6 text-success">Organizer access granted to {short(promoted)}.</p>}
          <Button type="submit" size="md" busy={promoting}>{promoting ? 'Adding organizer' : 'Add organizer'}</Button>
        </form>
      </Collapse>

      <Segmented
        label="What to do"
        cols={2}
        value={mode}
        onChange={setMode}
        options={[{ id: 'issue', label: 'Issue' }, { id: 'lookup', label: 'Look up' }, { id: 'event', label: 'New event' }, { id: 'door', label: 'Live door' }]}
      />

      <Link to="/organizer/transfers" className="group flex min-h-12 items-center justify-between gap-4 border-y border-line transition duration-300 ease-base active:scale-[0.99]">
        <span className="title-3">Review ticket transfers</span>
        <ArrowRightIcon size={20} className="shrink-0 text-accent transition-transform duration-300 ease-base group-hover:translate-x-1 group-active:translate-x-1" aria-hidden="true" />
      </Link>

      {mode === 'event' && <NewEvent />}
      {mode === 'door' && <DoorCount />}

      {mode === 'issue' && (
        <form onSubmit={issue} noValidate className="flex flex-1 flex-col gap-4">
          <p className="body-3 max-w-prose text-text-muted">Send a ticket to a wallet address or ENS name. ENS names resolve to the Rabdi wallet address record.</p>
          <label className="flex flex-col gap-2">
            <span className="title-4">Event</span>
            <select value={eventId} onChange={(e) => setEventId(e.target.value)} disabled={events.length === 0} className="field">
              {events.length === 0 && <option value="">No events available</option>}
              {events.map((event) => <option key={event.eventId} value={event.eventId}>{event.eventName}</option>)}
            </select>
            {eventsError && <span role="alert" className="body-6 text-danger">{eventsError}</span>}
            {events.length === 0 && !eventsError && <span className="body-6 text-text-muted">Publish an event before issuing tickets.</span>}
          </label>
          <label className="flex flex-col gap-2">
            <span className="title-4">Wallet address or ENS name</span>
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
              className="field font-mono placeholder:text-text-muted"
            />
            <span className="caption-5 text-text-muted">An ENS name is looked up through its Rabdi wallet address record.</span>
          </label>
          <button type="button" onClick={() => setHolder(walletAddress())} className="body-5 min-h-12 self-start rounded-md px-1 text-accent">
            Use this phone’s wallet
          </button>

          <fieldset className="flex flex-col gap-2">
            <legend className="title-4 mb-2">Ticket tier</legend>
            {tiers.map((t) => (
              <label
                key={t.id}
                className={`body-5 flex min-h-12 cursor-pointer items-center gap-3 rounded-md border px-4 transition duration-300 ease-base ${
                  tier === t.id ? 'border-accent' : 'border-line text-text-muted'
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
              {tierName(issued[0].tier)} ticket sent to {issuedName || short(issued[0].holder)}
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
                  <li key={t.passId} className="flex items-center gap-3 border-b border-line py-3">
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
              <span className="title-4">Wallet address or ENS name</span>
              <input
                value={lookup}
                onChange={(e) => setLookup(e.target.value)}
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder="0x… or sam.resona-id.eth"
                className="field font-mono placeholder:text-text-muted"
              />
            </label>
            {lookupResolved && <p role="status" className="caption-5 text-text-muted">{lookupResolved.name} resolves to {lookupResolved.address}</p>}
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
                  <li key={t.passId} className="flex items-center justify-between gap-3 border-b border-line py-3">
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
