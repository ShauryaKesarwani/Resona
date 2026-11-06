import { HandPalmIcon, WaveformIcon } from '@phosphor-icons/react'
import { Avatar, SimTag } from '../../components/Bits'
import { Button } from '../../components/Button'
import { Screen, TopBar } from '../../components/Screen'
import { ago, ordinal, useCheckins } from '../../data/mock'

/** D5. Latest check ins, newest first. Will read from Arkiv. */
export default function Recent() {
  const list = useCheckins()
  return (
    <Screen>
      <TopBar back="/door" title="Recent check ins" heading />
      <div className="flex items-center justify-between gap-2">
        <p className="body-6 tabular-nums text-text-muted">{list.length} so far</p>
        <SimTag />
      </div>
      {list.length === 0 ? (
        <section className="flex flex-1 flex-col justify-center gap-2 text-center">
          <h2 className="heading-5">No check ins yet</h2>
          <p className="body-3 text-text-muted">Check in the first ticket and it will show up here.</p>
        </section>
      ) : (
        <ul className="flex flex-col gap-2">
          {list.map((c) => (
            <li key={c.id} className="flex items-center gap-3 rounded-2xl border border-line bg-surface-raised p-3">
              <Avatar name={c.name} />
              <div className="min-w-0 flex-1">
                <p className="title-3 truncate">{c.name}</p>
                <p className="body-6 text-text-muted">
                  Pass&nbsp;{c.pass}, {ordinal(c.ordinal)} through the door
                </p>
                <p className="caption-4 mt-1 flex items-center gap-1 text-text-muted">
                  {c.method === 'sound' ? (
                    <>
                      <WaveformIcon size={14} aria-hidden="true" />
                      Sound check, {c.cm} cm
                    </>
                  ) : (
                    <>
                      <HandPalmIcon size={14} aria-hidden="true" />
                      Manual, {c.reason}
                    </>
                  )}
                </p>
              </div>
              <span className="caption-4 shrink-0 tabular-nums whitespace-nowrap text-text-muted">{ago(c.at)}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="flex-1" />
      <Button to="/door">Back to the door</Button>
    </Screen>
  )
}
