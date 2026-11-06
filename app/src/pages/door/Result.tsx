import { useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CheckCircleIcon, WarningCircleIcon } from '@phosphor-icons/react'
import { Avatar, Row, SimTag } from '../../components/Bits'
import { Button } from '../../components/Button'
import { Screen, TopBar } from '../../components/Screen'
import { ago, findPass, ordinal, recordCheckin, useCheckins, wallet } from '../../data/mock'
import type { Outcome } from './Checking'

const cm = { pass: 28, too_far: 212 } as const

const fails: Record<Exclude<Outcome, 'pass'>, { title: string; body: string; retry: boolean; manual: boolean }> = {
  too_far: {
    title: 'Too far away',
    body: 'The holder’s phone measured 212\u00a0cm from yours. Ask them to hold the phones about 30\u00a0cm apart, then try again.',
    retry: true,
    manual: true,
  },
  no_sound: {
    title: 'No sound from the holder’s phone',
    body: 'We did not hear the holder’s phone. Ask them to turn the volume up and unmute, then try again.',
    retry: true,
    manual: true,
  },
  not_claimed: {
    title: 'This ticket is not claimed yet',
    body: 'The holder has not claimed pass {pass} in their wallet. They need to claim it first, then you can check them in.',
    retry: false,
    manual: false,
  },
  already_in: {
    title: 'Already checked in',
    body: 'Pass\u00a0{pass} was used {when}. A ticket can only be checked in once.',
    retry: false,
    manual: false,
  },
}

/** D3. Pass or fail, with the holder's name and what to do next. */
export default function Result() {
  const [q] = useSearchParams()
  const r = (q.get('r') ?? 'pass') as Outcome
  const ticket = findPass(q.get('pass'))
  const done = useRef(false)
  const checkins = useCheckins()

  // Record a passing check in once. A refresh finds the ticket already checked in and does not record again.
  useEffect(() => {
    if (!ticket || r !== 'pass' || done.current || ticket.status === 'checked_in') return
    done.current = true
    recordCheckin(ticket.pass, 'sound', { cm: cm.pass })
  }, [ticket, r])

  if (!ticket) {
    return (
      <Screen>
        <TopBar back="/door" title="Result" />
        <section className="flex flex-1 flex-col justify-center gap-2" role="alert">
          <h1 className="heading-5">No result to show</h1>
          <p className="body-3 text-text-muted">Go back and check in a ticket first.</p>
        </section>
        <Button to="/door">Back to the door</Button>
      </Screen>
    )
  }

  if (r === 'pass') {
    const mine = checkins.find((c) => c.pass === ticket.pass)
    return (
      <Screen>
        <TopBar back="/door" title="Result" />
        <section className="flex flex-1 flex-col justify-center gap-6" role="status">
          <div className="flex items-center gap-3">
            <CheckCircleIcon size={48} className="text-success" aria-hidden="true" />
            <h1 className="heading-3 text-success">Pass</h1>
          </div>
          <div className="flex items-center gap-4">
            <Avatar name={wallet.name} size={64} />
            <div className="min-w-0">
              <p className="heading-5 [overflow-wrap:anywhere]">{wallet.name}</p>
              <p className="body-6 text-text-muted">
                Pass&nbsp;{ticket.pass}, {ticket.tier}
              </p>
            </div>
          </div>
          <div className="rounded-2xl border border-line bg-surface-raised p-2">
            <div className="rounded-lg bg-surface-inset">
              <Row label="Distance">
                <span className="font-mono tabular-nums">{cm.pass}&nbsp;cm</span>
              </Row>
              <Row label="Place through the door">
                <span className="tabular-nums">{ordinal(mine?.ordinal ?? checkins.length)}</span>
              </Row>
              <Row label="Verification">{ticket.level}</Row>
            </div>
          </div>
          <SimTag>Simulated result, not written to Arkiv</SimTag>
        </section>
        <Button to="/door">Next person</Button>
      </Screen>
    )
  }

  const f = fails[r as Exclude<Outcome, 'pass'>] ?? fails.too_far
  const when = ago(checkins.find((c) => c.pass === ticket.pass)?.at ?? Date.now())
  return (
    <Screen>
      <TopBar back="/door" title="Result" />
      <section className="flex flex-1 flex-col justify-center gap-4" role="alert">
        <div className="flex items-center gap-3">
          <WarningCircleIcon size={48} className="text-danger" aria-hidden="true" />
          <h1 className="heading-3 text-danger">Not admitted</h1>
        </div>
        <h2 className="heading-6">{f.title}</h2>
        <p className="body-3 text-text-muted">{f.body.replace('{pass}', String(ticket.pass)).replace('{when}', when.toLowerCase())}</p>
        <SimTag>Simulated result</SimTag>
      </section>
      {f.retry && <Button to={`/door/checking?pass=${ticket.pass}`}>Try again</Button>}
      {f.manual && (
        <Button variant="secondary" size="md" to={`/door/manual?pass=${ticket.pass}`}>
          Admit manually
        </Button>
      )}
      <Button variant={f.retry ? 'secondary' : 'primary'} size={f.retry ? 'md' : 'lg'} to="/door">
        Next person
      </Button>
    </Screen>
  )
}
