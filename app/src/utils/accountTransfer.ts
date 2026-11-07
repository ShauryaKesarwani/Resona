import { privateKeyToAccount } from 'viem/accounts'

const iterations = 310_000
const encoder = new TextEncoder()
const decoder = new TextDecoder()
const encode = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes))
const decode = (value: string) => Uint8Array.from(atob(value), (c) => c.charCodeAt(0))

async function keyFor(password: string, salt: Uint8Array) {
  const base = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}

export type TransferAccount = { walletKey: `0x${string}`; session: `session_${string}` }

function validAccount(value: unknown): value is TransferAccount {
  if (!value || typeof value !== 'object') return false
  const { walletKey, session } = value as Record<string, unknown>
  if (typeof walletKey !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(walletKey) || typeof session !== 'string' || !/^session_[a-zA-Z0-9_-]+$/.test(session)) return false
  try { privateKeyToAccount(walletKey as `0x${string}`); return true } catch { return false }
}

export async function exportAccount(account: TransferAccount, password: string): Promise<string> {
  if (!validAccount(account) || password.length < 12) throw new Error('invalid_input')
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await keyFor(password, salt)
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(JSON.stringify(account)))
  return JSON.stringify({ version: 1, salt: encode(salt), iv: encode(iv), ciphertext: encode(new Uint8Array(ciphertext)) })
}

export async function importAccount(file: string, password: string): Promise<TransferAccount> {
  if (file.length > 4096 || password.length < 12) throw new Error('invalid_input')
  const envelope = JSON.parse(file)
  if (envelope?.version !== 1 || typeof envelope.salt !== 'string' || typeof envelope.iv !== 'string' || typeof envelope.ciphertext !== 'string') throw new Error('invalid_file')
  const salt = decode(envelope.salt), iv = decode(envelope.iv), ciphertext = decode(envelope.ciphertext)
  if (salt.length !== 16 || iv.length !== 12 || ciphertext.length < 17 || ciphertext.length > 2048) throw new Error('invalid_file')
  const key = await keyFor(password, salt)
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext)
  const account: unknown = JSON.parse(decoder.decode(plaintext))
  if (!validAccount(account)) throw new Error('invalid_account')
  return account
}
