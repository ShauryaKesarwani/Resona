import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { isAddress } from 'viem'
import { Avatar } from '../components/Bits'
import { GatewayFlow } from '../components/GatewayFlow'
import { Button } from '../components/Button'
import { Screen, TopBar } from '../components/Screen'
import { RowsSkeleton } from '../components/Skeleton'
import { ordinal, short, wallet } from '../data/mock'
import { allEvents, checkinsFor, type ArkivEvent } from '../services/arkiv'
import { api, type EnsResolvedName } from '../services/api'
import { prettyDate } from './events/art'
import { EventImage } from './events/EventImage'

type Trophy = Awaited<ReturnType<typeof checkinsFor>>[number]

/** Public trophy page. ENS names are forward-resolved before reading the wallet's Arkiv history. */
export default function Profile() {
  const { name = '' } = useParams()
  const validAddress = isAddress(name)
  const [resolved, setResolved] = useState<EnsResolvedName | null>(null)
  const [lookupError, setLookupError] = useState('')
  const address = validAddress ? name : resolved?.address
  const [trophies, setTrophies] = useState<Trophy[]>()
  const [events, setEvents] = useState<ArkivEvent[]>([])
  const [failed, setFailed] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let current = true
    setResolved(null)
    setLookupError('')
    if (validAddress) return () => { current = false }
    api.ensResolve(name).then((result) => {
      if (current) setResolved(result)
    }).catch((error: Error) => {
      if (!current) return
      setLookupError(error.message === 'ens_name_not_found' ? 'We could not find that ENS name.'
        : error.message === 'ens_address_not_set' ? 'That ENS name has no wallet address set.'
          : error.message === 'invalid_ens_name' ? 'That is not a valid ENS name.'
            : 'ENS could not be reached. Try again in a moment.')
    })
    return () => { current = false }
  }, [name, validAddress])

  useEffect(() => {
    if (!address) return
    let current = true
    setTrophies(undefined)
    setEvents([])
    setFailed(false)
    Promise.all([checkinsFor(address), allEvents()])
      .then(([t, e]) => current && (setTrophies(t), setEvents(e)))
      .catch(() => current && setFailed(true))
    return () => {
      current = false
    }
  }, [address])

  async function share() {
    await navigator.clipboard?.writeText(window.location.href).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!address && lookupError) {
    return (
      <Screen>
        <TopBar back="/" />
        <section className="flex flex-1 flex-col justify-center gap-2" role="alert">
          <h1 className="heading-5">We could not find this profile</h1>
          <p className="body-3 text-text-muted">{lookupError}</p>
        </section>
        <Button to="/">Go to Resona</Button>
      </Screen>
    )
  }

  return (
    <Screen>
      <TopBar back={name.toLowerCase() === wallet.address ? '/account' : '/'} />
      <header className="flex flex-col items-center gap-2 pt-4 text-center">
        <div className="relative grid h-44 w-full place-items-center">
          <GatewayFlow className="absolute inset-0 size-full" />
          <span className="relative rounded-full bg-surface p-2">
            <Avatar name={resolved ? resolved.name.split('.')[0]! : name.slice(2)} size={80} />
          </span>
        </div>
        <h1 className="heading-4 font-mono">{resolved?.name ?? short(address ?? name)}</h1>
        {resolved && <p className="caption-5 font-mono text-text-muted [overflow-wrap:anywhere]">{short(resolved.address)}</p>}
        <p className="body-5 text-text-muted tabular-nums">
          {trophies ? `${trophies.length} ${trophies.length === 1 ? 'event' : 'events'} attended` : address ? 'Reading Arkiv' : 'Looking up ENS name'}
        </p>
      </header>

      {failed && (
        <p role="alert" className="body-6 text-danger">
          Could not read this profile from Arkiv. Check your connection, then open this page again.
        </p>
      )}
      {!trophies && !failed && <RowsSkeleton label="Loading trophies" rows={2} />}
      {trophies?.length === 0 && <p className="body-3 text-center text-text-muted">No events attended yet. A trophy appears after the door confirms a check in.</p>}
      {trophies && trophies.length > 0 && (
        <ul className="stagger flex flex-col">
          {trophies.map((t) => {
            const event = events.find((e) => e.eventId === t.eventId)
            return (
              <li key={t.passId} className="flex items-center gap-4 py-3 not-first:border-t not-first:border-line">
                <EventImage eventId={t.eventId} ratio="1 / 1" className="size-16 shrink-0 rounded-full" />
                <div className="min-w-0">
                  <p className="title-3">{event?.eventName ?? 'Event'}</p>
                  <p className="body-6 text-text-muted tabular-nums">
                    {ordinal(t.ordinal)} through the door, {t.distanceCm}&nbsp;cm
                  </p>
                  <p className="body-6 text-text-muted tabular-nums">{prettyDate(t.checkedInAt.slice(0, 10)).replace(/ /g, '\u00a0')}</p>
                </div>
              </li>
            )
          })}
        </ul>
      )}
      <div className="flex-1" />
      <Button onClick={share}>{copied ? 'Link copied' : 'Share'}</Button>
    </Screen>
  )
}
