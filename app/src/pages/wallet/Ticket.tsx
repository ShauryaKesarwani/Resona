import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ArrowsLeftRightIcon, InfoIcon } from '../../components/icons'
import { Row, StatusPill, WalletChip } from '../../components/Bits'
import { Button } from '../../components/Button'
import { Figure } from '../../components/Figure'
import { Screen, TopBar } from '../../components/Screen'
import { short, useTickets, wallet } from '../../data/mock'
import { api, type EnsPass } from '../../services/api'

/** W2. One ticket, with the single action that fits its status. */
export default function Ticket() {
  const { id } = useParams()
  const ticket = useTickets().find((t) => t.id === id)
  const [gloss, setGloss] = useState(false)
  const [ens, setEns] = useState<EnsPass | null>(null)
  const [ensError, setEnsError] = useState('')

  useEffect(() => {
    if (!id) return
    let current = true
    api.ensPass(id).then((result) => { if (current) setEns(result) }).catch((error: Error) => {
      if (current && error.message !== 'ens_not_configured') setEnsError('ENS ownership could not be checked.')
    })
    return () => { current = false }
  }, [id])

  if (!ticket) {
    return (
      <Screen>
        <TopBar back="/wallet" title="Ticket" />
        <section className="flex flex-1 flex-col justify-center gap-2" role="alert">
          <h1 className="heading-5">We could not find this ticket</h1>
          <p className="body-3 text-text-muted">It may belong to a different wallet. Go back to your tickets and pick one from the list.</p>
        </section>
        <Button to="/wallet">Go to your tickets</Button>
      </Screen>
    )
  }

  const pending = ticket.transferExpires && ticket.transferExpires > Date.now()

  return (
    <Screen>
      <TopBar back="/wallet" right={<WalletChip />} />
      <Figure ratio="16 / 7" position="50% 45%" />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h1 className="heading-4">Pass&nbsp;{ticket.pass}</h1>
          <p className="body-6 font-mono text-text-muted [overflow-wrap:anywhere]">{ens?.name ?? ticket.ens}</p>
        </div>
        <StatusPill status={ticket.status} past={ticket.past} />
      </div>

      <div className="rounded-2xl border border-line bg-surface-raised p-2">
        <div className="rounded-lg bg-surface-inset">
          <Row label="Event">{ticket.event}</Row>
          <Row label="Tier">{ticket.tier}</Row>
          <Row label="Holder">
            <span className="font-mono">{short(wallet.address)}</span>
          </Row>
          <Row label="Verification">{ticket.level}</Row>
          <Row label="Transfers">
            <button
              type="button"
              onClick={() => setGloss(!gloss)}
              aria-expanded={gloss}
              className="inline-flex min-h-12 items-center gap-1 rounded-lg text-right"
            >
              Organizer approves
              <InfoIcon size={16} className="text-text-muted" aria-hidden="true" />
            </button>
          </Row>
          {ens && <Row label="ENSv2 pass">
            <span className={ens.active && ens.linked && ens.matchesHolder ? 'text-success' : 'text-danger'}>
              {ens.active && ens.linked && ens.matchesHolder ? `Verified on Sepolia · ${short(ens.owner)}` : 'Ownership does not match this ticket'}
            </span>
          </Row>}
          {ensError && <p role="status" className="body-6 border-t border-line px-4 py-3 text-danger">{ensError}</p>}
          {gloss && (
            <p className="body-6 border-t border-line px-4 py-3 text-text-muted">
              You cannot send this ticket straight to someone. You ask the organizer, and they approve or deny. A
              request that nobody answers lapses after 24&nbsp;hours.
            </p>
          )}
        </div>
      </div>

      <div className="flex-1" />

      {ticket.status === 'issued' && !ticket.past && <Button to={`/wallet/claim/${ticket.id}`}>Claim ticket</Button>}
      {(ticket.status === 'claimed' || ticket.status === 'skipped') && !ticket.past && (
        <Button to={`/wallet/checkin/${ticket.id}`}>Check in</Button>
      )}
      {ticket.status === 'skipped' && (
        <Button variant="secondary" size="md" to={`/signin?next=/wallet/ticket/${ticket.id}`}>
          Sign in with World ID
        </Button>
      )}
      {ticket.status === 'claimed' && (
        <Button variant="secondary" size="md" to={`/wallet/transfer/${ticket.id}`}>
          <ArrowsLeftRightIcon size={20} aria-hidden="true" />
          {pending ? 'See transfer request' : 'Send to someone'}
        </Button>
      )}
      {ticket.status === 'checked_in' && <Button to={`/u/${wallet.address}`}>View your trophy</Button>}
    </Screen>
  )
}
