import { useEffect, useState, type FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { ClockIcon, ProhibitIcon } from '@phosphor-icons/react'
import { SimTag } from '../../components/Bits'
import { Button } from '../../components/Button'
import { Screen, TopBar } from '../../components/Screen'
import { transferWindowMs, updateTicket, useTickets } from '../../data/mock'

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

function left(ms: number) {
  const m = Math.max(0, Math.floor(ms / 60000))
  return `${Math.floor(m / 60)}h\u00a0${m % 60}m`
}

/** W5. Send a ticket. A direct transfer is blocked by the contract, so the path is a request to the organizer. */
export default function Transfer() {
  const { id } = useParams()
  const ticket = useTickets().find((t) => t.id === id)
  const [to, setTo] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const [now, setNow] = useState(Date.now())
  const back = `/wallet/ticket/${id}`

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(t)
  }, [])

  if (!ticket || ticket.status !== 'claimed') {
    return (
      <Screen>
        <TopBar back={back} title="Send ticket" />
        <section className="flex flex-1 flex-col justify-center gap-2">
          <h1 className="heading-5">This ticket cannot be sent right now</h1>
          <p className="body-3 text-text-muted">Only a claimed ticket that has not been used can be sent.</p>
        </section>
        <Button to={back}>Back to ticket</Button>
      </Screen>
    )
  }

  const pending = ticket.transferExpires !== undefined && ticket.transferExpires > now

  function validate() {
    const v = to.trim().toLowerCase()
    if (!v) return 'Enter the ENS name of the person you are sending to.'
    if (!/^[a-z0-9]+(\.[a-z0-9]+)*\.eth$/.test(v)) return 'That is not an ENS name. It should end in .eth, for example sam.eth.'
    return ''
  }

  async function request(e: FormEvent) {
    e.preventDefault()
    const msg = validate()
    setError(msg)
    if (msg) return
    setBusy(true)
    await wait(800)
    updateTicket(ticket!.id, { transferExpires: Date.now() + transferWindowMs })
    setBusy(false)
    setBlocked(false)
  }

  async function direct() {
    const msg = validate()
    setError(msg)
    if (msg) return
    setBusy(true)
    await wait(900)
    setBusy(false)
    setBlocked(true)
  }

  if (pending) {
    return (
      <Screen>
        <TopBar back={back} title="Send ticket" />
        <section className="flex flex-1 flex-col justify-center gap-4" role="status">
          <ClockIcon size={48} className="text-accent" aria-hidden="true" />
          <h1 className="heading-4">Waiting for the organizer</h1>
          <p className="body-3 text-text-muted">
            Your request to send Pass&nbsp;{ticket.pass} is with the organizer. It lapses in{' '}
            <span className="font-mono tabular-nums text-text">{left(ticket.transferExpires! - now)}</span> if nobody answers. You
            still hold the ticket until it is approved.
          </p>
          <SimTag>Simulated request</SimTag>
        </section>
        <Button variant="secondary" onClick={() => updateTicket(ticket.id, { transferExpires: undefined })}>
          Cancel request
        </Button>
        <Button to={back}>Back to ticket</Button>
      </Screen>
    )
  }

  return (
    <Screen>
      <TopBar back={back} title="Send ticket" />
      <form onSubmit={request} noValidate className="flex flex-1 flex-col gap-4">
        <h1 className="heading-4">Send Pass&nbsp;{ticket.pass} to someone</h1>
        <p className="body-3 text-text-muted">
          Only the organizer can move a ticket. Tell us who should get it, and the organizer approves or denies.
        </p>

        <label className="flex flex-col gap-2">
          <span className="title-4">Their ENS name</span>
          <input
            value={to}
            onChange={(e) => setTo(e.target.value)}
            inputMode="email"
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="sam.eth"
            aria-invalid={!!error}
            aria-describedby={error ? 'to-error' : undefined}
            className="min-h-14 rounded-xl border border-line bg-surface-raised px-4 text-base placeholder:text-text-muted"
          />
          {error && (
            <span id="to-error" role="alert" className="body-6 text-danger">
              {error}
            </span>
          )}
        </label>

        {blocked && (
          <div role="alert" className="flex gap-3 rounded-2xl border border-line bg-surface-raised p-4">
            <ProhibitIcon size={24} className="mt-0.5 shrink-0 text-danger" aria-hidden="true" />
            <div>
              <p className="title-3">The contract rejected the transfer</p>
              <p className="body-6 mt-1 text-text-muted">
                This ticket was issued without the transfer role, so only the organizer can move it. Ask the organizer
                instead.
              </p>
              <p className="caption-5 mt-2 font-mono text-text-muted">Reverted transaction 0x9c1e…42ab</p>
              <div className="mt-2">
                <SimTag>Simulated revert</SimTag>
              </div>
            </div>
          </div>
        )}

        <div className="flex-1" />
        <Button type="submit" busy={busy}>
          {busy ? 'Sending request' : 'Ask the organizer to approve'}
        </Button>
        <Button type="button" variant="secondary" size="md" disabled={busy} onClick={direct}>
          Demo control: try a direct transfer
        </Button>
      </form>
    </Screen>
  )
}
