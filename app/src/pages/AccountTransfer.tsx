import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/Button'
import { Screen, TopBar } from '../components/Screen'
import { exportAccount, importAccount } from '../utils/accountTransfer'

export default function AccountTransfer() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [file, setFile] = useState<File>()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [replace, setReplace] = useState(false)
  const walletKey = localStorage.getItem('resona.walletKey')
  const session = localStorage.getItem('resona.worldSession')

  async function download() {
    if (!walletKey || !session) return
    setBusy(true); setMessage('')
    try {
      const encrypted = await exportAccount({ walletKey: walletKey as `0x${string}`, session: session as `session_${string}` }, password)
      const url = URL.createObjectURL(new Blob([encrypted], { type: 'application/json' }))
      const link = document.createElement('a'); link.href = url; link.download = 'resona-account.json'; link.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      setMessage('File saved. Open the new Resona address and import it there using the same password.')
      setPassword('')
    } catch { setMessage('Could not create the file. Use a password of at least 12 characters and check that this browser has a World session.') }
    finally { setBusy(false) }
  }

  async function restore() {
    if (!file || file.size > 4096 || !replace) return
    setBusy(true); setMessage('')
    try {
      const account = await importAccount(await file.text(), password)
      const keys = ['resona.walletKey', 'resona.worldSession', 'resona.signedIn', 'resona.guest']
      const previous = keys.map((key) => localStorage.getItem(key))
      try {
        localStorage.setItem(keys[0], account.walletKey)
        localStorage.setItem(keys[1], account.session)
        localStorage.removeItem(keys[2]); localStorage.removeItem(keys[3])
      } catch (error) {
        keys.forEach((key, i) => previous[i] === null ? localStorage.removeItem(key) : localStorage.setItem(key, previous[i]!))
        throw error
      }
      navigate('/signin', { replace: true })
    } catch { setMessage('Could not open the file. Check the file and password, then try again. Your current account was not changed.') }
    finally { setBusy(false) }
  }

  return (
    <Screen>
      <TopBar back="/signin" title="Move your account" />
      <h1 className="heading-4">Move your Resona account</h1>
      <p className="body-3 text-text-muted">On your old Resona address, save an encrypted file. On the new address, open this page and import it. You will still need to approve sign-in with World ID.</p>
      <p className="body-3 text-text-muted">Choose a unique password of at least 12 characters. Anyone with the file and password can control your wallet. Keep both private and delete the file after the move.</p>
      <label className="body-3">Transfer password
        <input className="mt-2 w-full rounded-xl border border-line bg-surface-raised p-3" type="password" autoComplete="off" value={password} onChange={(e) => setPassword(e.target.value)} />
      </label>
      <Button onClick={download} busy={busy} disabled={!walletKey || !session || password.length < 12}>Save encrypted account file</Button>
      {(!walletKey || !session) && <p className="body-6 text-text-muted">To save a file, open this page on the old address where you signed in.</p>}
      <label className="body-3">Account file from your old address
        <input className="mt-2 block w-full" type="file" accept="application/json,.json" onChange={(e) => setFile(e.target.files?.[0])} />
      </label>
      <label className="body-3 flex items-start gap-2"><input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} /> I understand this replaces this browser’s current wallet and session. Tickets for its current wallet may no longer appear.</label>
      <Button variant="secondary" onClick={restore} busy={busy} disabled={!file || !replace || password.length < 12}>Import account and sign in</Button>
      {message && <p className="body-3" role="status">{message}</p>}
    </Screen>
  )
}
