import { useEffect, useState } from 'react'
import { Screen, TopBar } from '../../components/Screen'
import { RowsSkeleton } from '../../components/Skeleton'
import { ordinal, short } from '../../data/mock'
import { recentCheckins, type ArkivCheckin } from '../../services/arkiv'

/** D4. Everyone through the door, read from Arkiv, so every door phone sees the same list. */
export default function Recent() {
  const [rows, setRows] = useState<ArkivCheckin[]>()
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    recentCheckins().then(setRows).catch(() => setFailed(true))
  }, [])

  return (
    <Screen tabs>
      <TopBar />
      <h1 className="heading-4">{rows ? `${rows.length} checked in` : 'Recent check ins'}</h1>
      {failed && (
        <p role="alert" className="body-6 text-danger">
          Could not read check ins from Arkiv. Check your connection, then open this page again.
        </p>
      )}
      {!rows && !failed && <RowsSkeleton label="Loading check ins" />}
      {rows?.length === 0 && <p className="body-6 text-text-muted">Nobody has checked in yet.</p>}
      {rows && rows.length > 0 && (
        <ul className="stagger flex flex-col">
          {rows.map((c) => (
            <li key={c.passId} className="flex items-center justify-between gap-4 py-3 not-first:border-t not-first:border-line">
              <div className="min-w-0">
                <p className="title-3 tabular-nums">{ordinal(c.ordinal)} through the door</p>
                <p className="caption-5 font-mono text-text-muted">{short(c.holder)}</p>
              </div>
              <div className="text-right">
                <p className="body-5 font-mono tabular-nums">{c.distanceCm}&nbsp;cm</p>
                <p className="body-6 tabular-nums text-text-muted">{c.checkedInAt.slice(11, 16)}&nbsp;UTC</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Screen>
  )
}
