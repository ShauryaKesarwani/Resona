import { useEffect, useState, type FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { ClockIcon } from '../../components/icons'
import { Button } from '../../components/Button'
import { Screen, TopBar } from '../../components/Screen'
import { refreshTickets, useTickets } from '../../data/mock'
import { api, type TransferRequest } from '../../services/api'
import { signedBy } from '../../services/auth'

const explain: Record<string, string> = {
  ens_name_not_found: 'That ENS name could not be found.',
  ens_address_not_set: 'That ENS name has no Rabdi wallet address set.',
  ens_lookup_unavailable: 'ENS lookup is unavailable. Try again shortly.',
  ens_pass_not_verified: 'The ENS pass does not currently match this ticket.',
  ens_write_not_configured: 'The organizer has not enabled ENS transfers yet.',
  transfer_needs_review: 'The transfer needs organizer review. Contact the event organizer before trying again.',
  transfer_already_pending: 'This ticket already has an open transfer request.',
  ticket_not_transferable: 'Only a claimed, unused ticket can be sent.',
  ticket_already_used: 'A ticket that has checked in cannot be sent.',
}

function remaining(expiresAt: string, now: number) {
  const ms = Math.max(0, Date.parse(expiresAt) - now)
  const hours = Math.floor(ms / 3_600_000)
  const minutes = Math.floor((ms % 3_600_000) / 60_000)
  return `${hours}h ${minutes}m`
}

export default function Transfer() {
  const { id } = useParams()
  const ticket = useTickets().find((item) => item.id === id)
  const [to, setTo] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [request, setRequest] = useState<TransferRequest | null>(null)
  const [now, setNow] = useState(Date.now())
  const back = `/wallet/ticket/${id}`

  async function refresh() {
    if (!id) return
    const result = await api.transferStatus(id, await signedBy(`transfer-status:${id}`))
    setRequest(result)
    if (result?.status === 'approved') await refreshTickets()
  }

  useEffect(() => {
    let current = true
    if (id) api.transferStatus(id, signedBy(`transfer-status:${id}`)).then(async (result) => {
      if (current) {
        setRequest(result)
        if (result?.status === 'approved') await refreshTickets()
      }
    })
      .catch(() => { if (current) setError('Could not load the transfer request.') })
    return () => { current = false }
  }, [id])

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(timer)
  }, [])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!id) return
    setBusy(true)
    setError('')
    try {
      const resolved = await api.ensResolve(to.trim())
      const created = await api.requestTransfer(id, resolved.address, await signedBy(`transfer:${id}:${resolved.address.toLowerCase()}`))
      setRequest(created)
      setTo('')
    } catch (cause) {
      const code = (cause as Error).message
      setError(explain[code] ?? 'Could not submit the transfer request. Try again shortly.')
    } finally {
      setBusy(false)
    }
  }

  async function cancel() {
    if (!id) return
    setBusy(true)
    setError('')
    try {
      await api.cancelTransfer(id, await signedBy(`transfer-cancel:${id}`))
      await refresh()
    } catch {
      setError('Could not cancel this request. Refresh the page to check its status.')
    } finally {
      setBusy(false)
    }
  }

  if (!ticket || ticket.status !== 'claimed') {
    return <Screen><TopBar back={back} title="Send ticket" /><section className="flex flex-1 flex-col justify-center gap-2">
      <h1 className="heading-5">This ticket cannot be sent right now</h1>
      <p className="body-3 text-text-muted">Only a claimed ticket that has not been used can be sent.</p>
    </section><Button to={back}>Back to ticket</Button></Screen>
  }

  const active = request && ['pending', 'processing', 'needs_review'].includes(request.status)
  const terminalMessage: Record<string, string> = {
    approved: 'The organizer approved this request. The new holder can claim the ticket after the update appears in Arkiv.',
    declined: 'The organizer declined this request. You still hold the ticket.',
    cancelled: 'You cancelled this request. You still hold the ticket.',
    expired: 'This request expired. You still hold the ticket.',
    expired: 'This request expired. You still hold the ticket.',
    needs_review: 'The ENS and ticket records may need to be reconciled. Contact the organizer before taking another action.',
  }

  return <Screen>
    <TopBar back={back} title="Send ticket" />
    {active ? <section className="flex flex-1 flex-col justify-center gap-4" role="status">
      <ClockIcon size={48} className="text-accent" aria-hidden="true" />
      <h1 className="heading-4">{request.status === 'pending' ? 'Waiting for the organizer' : 'Transfer is being handled'}</h1>
      <p className="body-3 text-text-muted">
        {request.status === 'pending' ? <>Your request is with the organizer. It expires in <span className="font-mono tabular-nums text-text">{remaining(request.expiresAt, now)}</span>. You still hold the ticket until approval.</> : terminalMessage[request.status]}
      </p>
      <p className="caption-5 font-mono text-text-muted">Recipient: {request.toHolder}</p>
      <Button variant="secondary" size="md" onClick={refresh} disabled={busy}>Refresh status</Button>
    </section> : <form onSubmit={submit} noValidate className="flex flex-1 flex-col gap-4">
      <h1 className="heading-4">Send Pass&nbsp;{ticket.pass} to someone</h1>
      <p className="body-3 text-text-muted">The organizer reviews the request. If approved, the ENS pass and ticket move to the wallet mapped from this ENS name.</p>
      <label className="flex flex-col gap-2">
        <span className="title-4">Recipient ENS name</span>
        <input value={to} onChange={(event) => setTo(event.target.value)} autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false}
          placeholder="sam.eth" aria-invalid={!!error} className="min-h-14 rounded-xl border border-line bg-surface-raised px-4 text-base placeholder:text-text-muted" />
      </label>
      {error && <p role="alert" className="body-6 text-danger">{error}</p>}
      {request && terminalMessage[request.status] && <p role="status" className="body-6 text-text-muted">{terminalMessage[request.status]}</p>}
      <div className="flex-1" />
      <Button type="submit" busy={busy}>{busy ? 'Sending request' : 'Ask the organizer to approve'}</Button>
    </form>}
    {active && request.status === 'pending' && <Button variant="secondary" onClick={cancel} busy={busy}>Cancel request</Button>}
    {error && active && <p role="alert" className="body-6 text-danger">{error}</p>}
    <Button to={back} variant="secondary">Back to ticket</Button>
  </Screen>
}
