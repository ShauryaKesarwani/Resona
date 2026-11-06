import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CheckCircleIcon } from '../../components/icons'
import { SimTag } from '../../components/Bits'
import { Button } from '../../components/Button'
import { Screen, TopBar } from '../../components/Screen'
import { doorStaff, findPass, recordCheckin } from '../../data/mock'

const reasons = ['Speaker not working', 'Room too loud', 'Phone battery dead']

/** D4. Let someone in without the sound check, after checking photo ID. Logged against the staff member. */
export default function Manual() {
  const [q] = useSearchParams()
  const [pass, setPass] = useState(q.get('pass') ?? '')
  const [reason, setReason] = useState(reasons[0])
  const [idOk, setIdOk] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<number | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const t = findPass(pass)
    if (!pass.trim()) return setError('Enter the pass number.')
    if (!t) return setError(`There is no pass\u00a0${pass.trim()} for this event.`)
    if (t.status === 'checked_in') return setError(`Pass\u00a0${t.pass} is already checked in.`)
    if (t.status === 'issued') return setError(`Pass\u00a0${t.pass} is not claimed yet. The holder needs to claim it first.`)
    if (!idOk) return setError('Confirm you checked photo ID before admitting.')
    setError('')
    setBusy(true)
    await new Promise((r) => setTimeout(r, 700))
    recordCheckin(t.pass, 'manual', { reason })
    setBusy(false)
    setDone(t.pass)
  }

  if (done !== null) {
    return (
      <Screen>
        <TopBar back="/door" title="Admit manually" />
        <section className="flex flex-1 flex-col justify-center gap-4" role="status">
          <CheckCircleIcon size={48} className="text-success" aria-hidden="true" />
          <h1 className="heading-4">Pass&nbsp;{done} admitted</h1>
          <p className="body-3 text-text-muted">
            Logged as a manual entry by {doorStaff}, with the reason &ldquo;{reason}&rdquo;. Organizers can review it.
          </p>
          <SimTag>Simulated entry, not written to Arkiv</SimTag>
        </section>
        <Button to="/door">Next person</Button>
      </Screen>
    )
  }

  return (
    <Screen>
      <TopBar back="/door" title="Admit manually" heading />
      <form onSubmit={submit} noValidate className="flex flex-1 flex-col gap-4">
        <p className="body-3 text-text-muted">
          Use this when the sound check cannot work. Check photo ID first. Every manual entry is logged against {doorStaff}.
        </p>

        <label className="flex flex-col gap-2">
          <span className="title-4">Pass number</span>
          <input
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            placeholder="7"
            className="min-h-14 rounded-xl border border-line bg-surface-raised px-4 font-mono text-base placeholder:text-text-muted"
          />
        </label>

        <fieldset className="flex flex-col gap-2">
          <legend className="title-4 mb-2">Why the sound check is not used</legend>
          {reasons.map((r) => (
            <label
              key={r}
              className={`body-5 flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-4 transition duration-300 ease-base ${
                reason === r ? 'border-accent bg-surface-raised' : 'border-line text-text-muted'
              }`}
            >
              <input type="radio" name="reason" checked={reason === r} onChange={() => setReason(r)} className="size-4 accent-[var(--color-accent)]" />
              {r}
            </label>
          ))}
        </fieldset>

        <label className="body-5 flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-line px-4">
          <input type="checkbox" checked={idOk} onChange={(e) => setIdOk(e.target.checked)} className="size-4 accent-[var(--color-accent)]" />
          I checked photo ID
        </label>

        {error && (
          <p role="alert" className="body-6 text-danger">
            {error}
          </p>
        )}
        <div className="flex-1" />
        <Button type="submit" busy={busy}>
          {busy ? 'Admitting' : 'Admit this person'}
        </Button>
      </form>
    </Screen>
  )
}
