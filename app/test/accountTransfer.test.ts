import assert from 'node:assert/strict'
import { test } from 'node:test'
import { exportAccount, importAccount } from '../src/utils/accountTransfer.ts'

const account = { walletKey: `0x${'01'.repeat(32)}` as const, session: 'session_abc123' as const }
const password = 'correct horse battery staple'

test('encrypted transfer restores the account without exposing secrets', async () => {
  const file = await exportAccount(account, password)
  assert.ok(!file.includes(account.walletKey))
  assert.ok(!file.includes(account.session))
  assert.deepEqual(await importAccount(file, password), account)
})

test('wrong passwords, modified files and invalid accounts are rejected', async () => {
  const file = await exportAccount(account, password)
  await assert.rejects(importAccount(file, 'incorrect password'))
  const envelope = JSON.parse(file)
  envelope.ciphertext = `${envelope.ciphertext.slice(0, -4)}AAAA`
  await assert.rejects(importAccount(JSON.stringify(envelope), password))
  await assert.rejects(exportAccount({ ...account, walletKey: `0x${'00'.repeat(32)}` }, password))
})
