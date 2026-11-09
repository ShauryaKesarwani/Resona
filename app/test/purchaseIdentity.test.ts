import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { unverifiedPurchaseId } from '../src/services/purchaseIdentity.ts'

test('unverified purchase metadata is clearly marked and wallet scoped', () => {
  assert.equal(unverifiedPurchaseId('0xAbC'), 'unverified:0xabc')
  assert.notEqual(unverifiedPurchaseId('0xAbC'), unverifiedPurchaseId('0xDEF'))
})
