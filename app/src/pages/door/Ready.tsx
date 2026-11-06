import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClockCounterClockwiseIcon, HandPalmIcon } from '@phosphor-icons/react'
import { Avatar, SimTag } from '../../components/Bits'
import { Button } from '../../components/Button'
import { Figure } from '../../components/Figure'
import { Screen, TopBar } from '../../components/Screen'
import { doorStaff, findPass, useCheckins } from '../../data/mock'
import { Link } from 'react-router-dom'

/** D1. Door is ready. Type the pass number printed on the holder's ticket. */
export default function Ready() {
  const navigate = useNavigate()
  const count = useCheckins().length
  const [pass, setPass] = useState('')
  const [error, setError] = useState('')

  function submit(e: FormEvent) {
    e.preventDefault()
    const v = pass.trim()
    if (!v) return setError('Enter the pass number from the holder’s ticket.')
    if (!/^\d+$/.test(v)) return setError('A pass number is digits only, for example 7.')
    if (!findPass(v)) return setError(`There is no pass\u00a0${v} for this event. Check the number and try again.`)
    navigate(`/door/checking?pass=${v}`)
  }

  return (
    <Screen>
      <TopBar
        back="/enter"
        right={
          <div className="flex min-h-12 items-center gap-2 rounded-xl border border-line bg-surface-raised px-3">
            <Avatar name={doorStaff} size={24} />
            <span className="body-5">{doorStaff}</span>
          </div>
        }
      />
      <Figure ratio="16 / 7" position="50% 45%" />
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="heading-4">Ready for the next ticket</h1>
          <p className="body-6 mt-1 tabular-nums text-text-muted">{count} checked in so far</p>
        </div>
        <SimTag />
      </div>

      <form onSubmit={submit} noValidate className="flex flex-1 flex-col gap-4">
        <label className="flex flex-col gap-2">
          <span className="title-4">Pass number</span>
          <input
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            placeholder="7"
            aria-invalid={!!error}
            aria-describedby="pass-help"
            className="min-h-14 rounded-xl border border-line bg-surface-raised px-4 font-mono text-base placeholder:text-text-muted"
          />
          <span id="pass-help" role={error ? 'alert' : undefined} className={`body-6 ${error ? 'text-danger' : 'text-text-muted'}`}>
            {error || 'Camera scanning is not built yet. Type the number shown on the ticket.'}
          </span>
        </label>

        <div className="flex gap-2">
          <Link
            to="/door/recent"
            className="body-5 flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-line bg-surface-raised px-3 transition duration-300 ease-base hover:bg-surface-inset active:scale-[0.98]"
          >
            <ClockCounterClockwiseIcon size={20} aria-hidden="true" />
            Recent
          </Link>
          <Link
            to="/door/manual"
            className="body-5 flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-line bg-surface-raised px-3 transition duration-300 ease-base hover:bg-surface-inset active:scale-[0.98]"
          >
            <HandPalmIcon size={20} aria-hidden="true" />
            Admit manually
          </Link>
        </div>

        <div className="flex-1" />
        <Button type="submit">Check in</Button>
      </form>
    </Screen>
  )
}
