import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { hashSignal } from "@worldcoin/idkit-core/hashing";
import { openStore, type Store } from "../db/store.ts";
import { claim, skip, type ClaimConfig } from "./claim.service.ts";
import type { Verifier } from "./world.service.ts";

const config: ClaimConfig = { rpId: "rp_test", action: "claim-test", environment: "staging", allowSkip: true };
const alice = "0xAAaa000000000000000000000000000000000001";
const aliceAlt = "0xaaaa000000000000000000000000000000000002";
const passes: Verifier = async () => ({ ok: true, body: { success: true, environment: "staging" } });

const proofFor = (wallet: string, overrides = {}) => ({
  environment: "staging",
  action: "claim-test",
  responses: [{ nullifier: "0xABC", signal_hash: hashSignal(wallet.toLowerCase()) }],
  ...overrides,
});

let store: Store;
let passId: string;
beforeEach(() => {
  store = openStore(":memory:");
  passId = store.issue(alice, "general").passId;
});

test("a valid proof claims the ticket", async () => {
  const out = await claim(store, config, passes, { passId, wallet: alice, idkitResponse: proofFor(alice) });
  assert.equal(out.status, 200);
  assert.equal(store.ticket(passId)?.status, "claimed");
});

test("the same human can't claim a second ticket, even with another wallet", async () => {
  await claim(store, config, passes, { passId, wallet: alice, idkitResponse: proofFor(alice) });
  const second = store.issue(aliceAlt, "general").passId;
  const proof = proofFor(aliceAlt, { responses: [{ nullifier: "0xabc", signal_hash: hashSignal(aliceAlt) }] });
  const out = await claim(store, config, passes, { passId: second, wallet: aliceAlt, idkitResponse: proof });
  assert.deepEqual(out, { status: 409, error: "human_already_claimed" });
  assert.equal(store.ticket(second)?.status, "issued");
});

test("a replay reported by World counts as already claimed", async () => {
  const replay: Verifier = async () => ({ ok: false, body: { code: "nullifier_replayed" } });
  const out = await claim(store, config, replay, { passId, wallet: alice, idkitResponse: proofFor(alice) });
  assert.deepEqual(out, { status: 409, error: "human_already_claimed" });
});

test("a proof bound to another wallet is rejected before verifying", async () => {
  const never: Verifier = async () => assert.fail("should not call the Portal");
  const out = await claim(store, config, never, { passId, wallet: alice, idkitResponse: proofFor(aliceAlt) });
  assert.deepEqual(out, { status: 400, error: "wrong_wallet" });
});

test("wrong environment and wrong action are rejected", async () => {
  const input = { passId, wallet: alice };
  const env = await claim(store, config, passes, { ...input, idkitResponse: proofFor(alice, { environment: "production" }) });
  const action = await claim(store, config, passes, { ...input, idkitResponse: proofFor(alice, { action: "other" }) });
  assert.deepEqual(env, { status: 400, error: "wrong_environment" });
  assert.deepEqual(action, { status: 400, error: "wrong_action" });
});

test("a failed verification leaves the ticket unclaimed", async () => {
  const fails: Verifier = async () => ({ ok: false, body: { code: "invalid_proof" } });
  const out = await claim(store, config, fails, { passId, wallet: alice, idkitResponse: proofFor(alice) });
  assert.deepEqual(out, { status: 400, error: "verification_failed" });
  assert.equal(store.ticket(passId)?.status, "issued");
});

test("only the holder can claim or skip", async () => {
  assert.equal(skip(store, config, { passId, wallet: aliceAlt }).status, 403);
  const out = await claim(store, config, passes, { passId, wallet: aliceAlt, idkitResponse: proofFor(aliceAlt) });
  assert.equal(out.status, 403);
});

test("skip marks the ticket skipped, and it can still be verified later", async () => {
  assert.equal(skip(store, config, { passId, wallet: alice }).status, 200);
  assert.equal(store.ticket(passId)?.status, "skipped");
  const out = await claim(store, config, passes, { passId, wallet: alice, idkitResponse: proofFor(alice) });
  assert.equal(out.status, 200);
  assert.equal(store.ticket(passId)?.status, "claimed");
});

test("skip can be turned off, and can't undo a verified claim", async () => {
  assert.deepEqual(skip(store, { ...config, allowSkip: false }, { passId, wallet: alice }), { status: 403, error: "skip_disabled" });
  await claim(store, config, passes, { passId, wallet: alice, idkitResponse: proofFor(alice) });
  assert.deepEqual(skip(store, config, { passId, wallet: alice }), { status: 409, error: "already_claimed" });
});
