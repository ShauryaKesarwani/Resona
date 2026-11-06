import { useEffect, useState } from 'react'
import { proofOfHuman, useIDKitRequest, type RpContext } from '@worldcoin/idkit'
import { QRCodeSVG } from 'qrcode.react'
import { Button } from '../../components/Button'
import { serverPass, wallet } from '../../data/mock'
import { api, type WorldConfig } from '../../services/api'

const MESSAGES: Record<string, string> = {
  already_claimed: 'This ticket is already claimed.',
  wrong_wallet: 'This proof belongs to a different wallet.',
  verification_failed: 'World ID could not verify this proof. Try again.',
}

type Setup = { config: WorldConfig; rpContext: RpContext; passId: string }
type Props = { onVerified: () => void; onSkipped: () => void; onRejected: () => void }

/** The real World ID step. Skip stays on screen the whole time, in case verification is slow. */
export function WorldVerify({ onVerified, onSkipped, onRejected }: Props) {
  const [setup, setSetup] = useState<Setup>()
  const [error, setError] = useState<string>()
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let current = true
    setSetup(undefined)
    Promise.all([api.config(), api.sign(), serverPass()])
      .then(([config, rpContext, passId]) => current && setSetup({ config, rpContext, passId }))
      .catch(() => current && setError('Could not reach the Resona server. Check that it is running, then try again.'))
    return () => {
      current = false
    }
  }, [attempt])

  const retry = () => {
    setError(undefined)
    setAttempt((n) => n + 1)
  }

  async function skip() {
    try {
      await api.skip(setup!.passId, wallet.address)
      onSkipped()
    } catch (err) {
      setError(MESSAGES[(err as Error).message] ?? 'Could not skip this step.')
    }
  }

  function failed(code: string) {
    if (code === 'human_already_claimed') onRejected()
    else setError(MESSAGES[code] ?? 'Verification failed. Try again.')
  }

  return (
    <>
      {error ? (
        <>
          <p className="body-3 text-danger" role="alert">{error}</p>
          <Button onClick={retry}>Try again</Button>
        </>
      ) : setup ? (
        <Request key={attempt} setup={setup} onVerified={onVerified} onFailed={failed} />
      ) : (
        <Button busy>Starting World ID</Button>
      )}
      {setup?.config.allowSkip && (
        <Button variant="secondary" size="md" onClick={skip}>
          Skip for now
        </Button>
      )}
    </>
  )
}

function Request({ setup, onVerified, onFailed }: { setup: Setup; onVerified: () => void; onFailed: (code: string) => void }) {
  const { config, rpContext, passId } = setup
  const flow = useIDKitRequest({
    app_id: config.appId,
    action: config.action,
    rp_context: rpContext,
    allow_legacy_proofs: true,
    environment: config.environment,
    preset: proofOfHuman({ signal: wallet.address }),
    polling: { interval: 2_000, timeout: 300_000 },
  })

  // Open once per attempt, and submit each proof once.
  useEffect(() => flow.open(), [])
  useEffect(() => {
    if (!flow.result) return
    api.claim(passId, wallet.address, flow.result).then(onVerified).catch((err: Error) => onFailed(err.message))
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
      <p className="body-6 text-text-muted">Scan with your phone’s camera to open World ID.</p>
      {openLink}
    </div>
  )
}
