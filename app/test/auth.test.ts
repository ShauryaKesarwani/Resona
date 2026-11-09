import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { continueAsGuest, markSignedIn, signOut, worldSignInStatus, useSignedIn } from '../src/services/auth.ts'

test('unverified and verified sign-in states remain distinct', () => {
  const values = new Map<string, string>()
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  } })
  continueAsGuest()
  assert.equal(useSignedIn(), true)
  assert.equal(worldSignInStatus(), false)
  markSignedIn()
  assert.equal(worldSignInStatus(), true)
  continueAsGuest()
  assert.equal(worldSignInStatus(), false)
  signOut()
  assert.equal(useSignedIn(), false)
})
