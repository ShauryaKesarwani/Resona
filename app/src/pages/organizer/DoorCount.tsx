import { useEffect, useState } from 'react'
import { ordinal, short } from '../../data/mock'
import { recentCheckins, type ArkivCheckin } from '../../services/arkiv'

/** How many people have come through the door, read from Arkiv every few seconds. */
export function DoorCount() {
  const [rows, setRows] = useState<ArkivCheckin[]>()
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let current = true
    const load = () =>
      recentCheckins()
        .then((r) => current && (setRows(r), setFailed(false)))
        .catch(() => current && setFailed(true))
    load()
    const timer = setInterval(load, 5000)
    return () => {
      current = false
      clearInterval(timer)
    }
  }, [])

  return (
    <section className="flex flex-1 flex-col gap-4" aria-live="polite">
      <div className="flex flex-col items-center gap-1 rounded-2xl border border-line bg-surface-raised py-8 text-center">
        <p className="heading-1 tabular-nums">{rows ? rows.length : '…'}</p>
        <p className="body-3 text-text-muted">through the door</p>
      </div>
      {failed && (
        <p role="alert" className="body-6 text-danger">
          Could not read check ins from Arkiv. This page keeps trying.
        </p>
      )}
      {rows && rows.length > 0 && (
        <ul className="flex flex-col">
          {rows.slice(0, 8).map((c) => (
            <li key={c.passId} className="flex items-center justify-between gap-4 py-3 not-first:border-t not-first:border-line">
              <div className="min-w-0">
                <p className="title-3 tabular-nums">{ordinal(c.ordinal)}</p>
                <p className="caption-5 font-mono text-text-muted">{short(c.holder)}</p>
              </div>
              <p className="body-5 font-mono tabular-nums">{c.distanceCm}&nbsp;cm</p>
            </li>
          ))}
        </ul>
      )}
      {rows?.length === 0 && <p className="body-6 text-text-muted">Nobody has checked in yet.</p>}
    </section>
  )
}
