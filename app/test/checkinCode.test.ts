import assert from 'node:assert/strict'
import { test } from 'node:test'
import { checkinCode } from '../src/utils/checkinCode.ts'

test('accepts a six-digit check-in code, preserving leading zeroes', () => {
  assert.equal(checkinCode(' 001234 '), '001234')
})

test('rejects unrelated QR codes and malformed check-in codes', () => {
  for (const value of ['', '12345', '1234567', '12a456', 'https://example.com/123456']) {
    assert.equal(checkinCode(value), null)
  }
})
