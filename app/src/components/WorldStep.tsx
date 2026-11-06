import { useEffect, useState } from 'react'
import { CredentialRequest, useIDKitRequest, useIDKitSession, type IDKitHookResult, type IDKitResult, type RpContext } from '@worldcoin/idkit'
import { QRCodeSVG } from 'qrcode.react'
import { api, type WorldConfig } from '../services/api'
import { Button } from './Button'

type Setup = { config: WorldConfig; rpContext: RpContext }
type Props = {
  signal: string
  /** A saved World session to prove again. Without one, this is a first sign in that creates it. */
  session?: `session_${string}` | null
  /** Sends the proof to the server. Throw an Error with a server code to reject it. */
  submit: (result: IDKitResult) => Promise<unknown>
  onDone: () => void
  onSkip?: () => void
  /** Handles a code itself, such as a repeat. Return true if handled. */
  onCode?: (code: string) => boolean
  messages?: Record<string, string>
}

/** One World ID proof. Skip stays on screen the whole time, in case verification is slow. */
export function WorldStep({ signal, session, submit, onDone, onSkip, onCode, messages = {} }: Props) {
  const [setup, setSetup] = useState<Setup>()
  const [error, setError] = useState<string>()
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let current = true
    Promise.all([api.config(), api.sign(!!session)])
      .then(([config, rpContext]) => current && setSetup({ config, rpContext }))
      .catch(() => current && setError('Could not reach the Resona server. Check that it is running, then try again.'))
    return () => {
      current = false
    }
  }, [attempt])

  const retry = () => {
    setError(undefined)
    setSetup(undefined)
    setAttempt((n) => n + 1)
  }

  function failed(code: string) {
    if (onCode?.(code)) return
    console.error('World ID step failed:', code)
    setError(`${messages[code] ?? 'Verification failed. Try again.'} (${code})`)
  }

  return (
    <>
      {error ? (
        <>
          <p className="body-3 text-danger" role="alert">{error}</p>
          <Button onClick={retry}>Try again</Button>
        </>
      ) : setup ? (
        session ? (
          <ProveSession key={attempt} session={session} setup={setup} signal={signal} submit={submit} onDone={onDone} onFailed={failed} />
        ) : (
          <FirstSignIn key={attempt} setup={setup} signal={signal} submit={submit} onDone={onDone} onFailed={failed} />
        )
      ) : (
        <Button busy>Starting World ID</Button>
      )}
      {setup?.config.allowSkip && onSkip && (
        <Button variant="secondary" size="md" onClick={onSkip}>
          Skip for now
        </Button>
      )}
    </>
  )
}

type RequestProps = Pick<Props, 'signal' | 'submit' | 'onDone'> & { setup: Setup; onFailed: (code: string) => void }

const polling = { interval: 2_000, timeout: 300_000 }

/** One proof that this is a new human, which also creates their World session. */
function FirstSignIn({ setup, signal, ...rest }: RequestProps) {
  const flow = useIDKitRequest({
    app_id: setup.config.appId,
    action: setup.config.action,
    session_id: 'create',
    rp_context: setup.rpContext,
    allow_legacy_proofs: false,
    environment: setup.config.environment,
    constraints: CredentialRequest('proof_of_human', { signal }),
    polling,
  })
  return <Flow flow={flow} {...rest} />
}

/** Proves the saved session again, so the same human is back. */
function ProveSession({ setup, signal, session, ...rest }: RequestProps & { session: `session_${string}` }) {
  const flow = useIDKitSession({
    app_id: setup.config.appId,
    existing_session_id: session,
    rp_context: setup.rpContext,
    environment: setup.config.environment,
    constraints: CredentialRequest('proof_of_human', { signal }),
    polling,
  })
  return <Flow flow={flow} {...rest} />
}

type FlowProps = Pick<Props, 'submit' | 'onDone'> & { flow: IDKitHookResult<IDKitResult>; onFailed: (code: string) => void }

function Flow({ flow, submit, onDone, onFailed }: FlowProps) {
  // Open once per attempt, and submit each proof once.
  useEffect(() => flow.open(), [])
  useEffect(() => {
    if (!flow.result) return
    submit(flow.result).then(onDone).catch((err: Error) => onFailed(err.message))
  }, [flow.result])
  useEffect(() => {
    if (flow.errorCode) onFailed(flow.errorCode)
  }, [flow.errorCode])

  if (flow.result) return <Button busy>Checking your proof</Button>
  if (flow.isAwaitingUserConfirmation) return <Button busy>Approve in World ID</Button>
  if (!flow.connectorURI) return <Button busy>Starting World ID</Button>

  const openLink = (
    <a className="button-lg inline-flex min-h-16 w-full items-center justify-center rounded-xl bg-accent px-3 py-2 text-on-accent" href={flow.connectorURI}>
      Open World ID
    </a>
  )

  // A phone opens World App directly. Anything else also gets a code to scan with one.
  if (/Android|iPhone|iPad/.test(navigator.userAgent)) return openLink

  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <QRCodeSVG value={flow.connectorURI} size={200} marginSize={2} className="rounded-xl" />
      <p className="body-6 text-text-muted">Scan with your phone's camera to open World ID.</p>
      {openLink}
    </div>
  )
}
