import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { hashSignal } from "@worldcoin/idkit-core/hashing";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import type { Account, AccountRegistry } from "../arkiv/accounts.ts";
import { signedMessage } from "../utils/signature.ts";
import { hashNullifier, session, signup, type AuthConfig } from "./auth.service.ts";
import type { Verifier } from "./world.service.ts";

const config: AuthConfig = { rpId: "rp_test", action: "signin-test", environment: "staging", nullifierHashKey: "secret" };
const first = "0xaaaa000000000000000000000000000000000001";
const second = "0xaaaa000000000000000000000000000000000002";
const passes: Verifier = async () => ({ ok: true, body: { success: true, environment: "staging" } });

const proofFor = (wallet: string, overrides = {}) => ({
  environment: "staging",
  action: "signin-test",
  responses: [{ nullifier: "0xABC", signal_hash: hashSignal(wallet) }],
  ...overrides,
});

export function memoryRegistry(): AccountRegistry & { rows: Account[] } {
  const rows: Account[] = [];
  return {
    rows,
    ready: true,
    findByWallet: async (wallet) => rows.find((row) => row.wallet === wallet) ?? null,
    findByNullifierHash: async (hash) => rows.find((row) => row.nullifierHash === hash) ?? null,
    create: async (account) => void rows.push(account),
  };
}

let registry: ReturnType<typeof memoryRegistry>;
beforeEach(() => {
  registry = memoryRegistry();
});

test("a new human gets an account, stored with a hash and never the raw nullifier", async () => {
  const out = await signup(registry, config, passes, { wallet: first, idkitResponse: proofFor(first) });
  assert.deepEqual(out, { status: 200, wallet: first });
  assert.deepEqual(registry.rows, [{ wallet: first, nullifierHash: hashNullifier("secret", "0xabc") }]);
  assert.ok(!JSON.stringify(registry.rows).includes("abc\""));
});

test("the hash ignores hex casing but depends on the secret", () => {
  assert.equal(hashNullifier("k", "0xABC"), hashNullifier("k", "0xabc"));
  assert.notEqual(hashNullifier("k", "0xabc"), hashNullifier("other", "0xabc"));
});

test("the same human with a second wallet is rejected", async () => {
  await signup(registry, config, passes, { wallet: first, idkitResponse: proofFor(first) });
  const out = await signup(registry, config, passes, { wallet: second, idkitResponse: proofFor(second) });
  assert.deepEqual(out, { status: 409, error: "human_has_account" });
  assert.equal(registry.rows.length, 1);
});

test("two sign-ups at once can't both win", async () => {
  const slowFind = registry.findByNullifierHash;
  registry.findByNullifierHash = async (hash) => {
    await new Promise((resolve) => setTimeout(resolve, 5));
    return slowFind(hash);
  };
  const [a, b] = await Promise.all([
    signup(registry, config, passes, { wallet: first, idkitResponse: proofFor(first) }),
    signup(registry, config, passes, { wallet: second, idkitResponse: proofFor(second) }),
  ]);
  assert.deepEqual([a.status, b.status].sort(), [200, 409]);
  assert.equal(registry.rows.length, 1);
});

test("a wallet can't be taken over by a different human", async () => {
  await signup(registry, config, passes, { wallet: first, idkitResponse: proofFor(first) });
  const other = proofFor(first, { responses: [{ nullifier: "0xdef", signal_hash: hashSignal(first) }] });
  const out = await signup(registry, config, passes, { wallet: first, idkitResponse: other });
  assert.deepEqual(out, { status: 409, error: "wallet_taken" });
});

test("the same wallet and human repeating sign-up is fine, with no new record", async () => {
  await signup(registry, config, passes, { wallet: first, idkitResponse: proofFor(first) });
  const never: Verifier = async () => assert.fail("should not call World");
  const out = await signup(registry, config, never, { wallet: first, idkitResponse: proofFor(first) });
  assert.deepEqual(out, { status: 200, wallet: first });
  assert.equal(registry.rows.length, 1);
});

test("a replay reported by World, or a failed proof, creates nothing", async () => {
  const replay: Verifier = async () => ({ ok: false, body: { code: "nullifier_replayed" } });
  const invalid: Verifier = async () => ({ ok: false, body: { code: "invalid_proof" } });
  const input = { wallet: first, idkitResponse: proofFor(first) };
  assert.deepEqual(await signup(registry, config, replay, input), { status: 409, error: "human_has_account" });
  assert.deepEqual(await signup(registry, config, invalid, input), { status: 400, error: "verification_failed" });
  assert.equal(registry.rows.length, 0);
});

test("wrong action, environment or wallet is rejected before calling World", async () => {
  const never: Verifier = async () => assert.fail("should not call World");
  const run = (idkitResponse: unknown) => signup(registry, config, never, { wallet: first, idkitResponse });
  assert.deepEqual(await run(proofFor(first, { action: "other" })), { status: 400, error: "wrong_action" });
  assert.deepEqual(await run(proofFor(first, { environment: "production" })), { status: 400, error: "wrong_environment" });
  assert.deepEqual(await run(proofFor(second)), { status: 400, error: "wrong_wallet" });
});

test("no World proof is spent when Arkiv isn't configured", async () => {
  const never: Verifier = async () => assert.fail("should not call World");
  const out = await signup({ ...registry, ready: false }, config, never, { wallet: first, idkitResponse: proofFor(first) });
  assert.deepEqual(out, { status: 503, error: "arkiv_not_configured" });
});

test("a returning wallet signs in with a signature and no World proof", async () => {
  const account = privateKeyToAccount(generatePrivateKey());
  const wallet = account.address.toLowerCase();
  const timestamp = Date.now();
  const signature = await account.signMessage({ message: signedMessage("login", wallet, timestamp) });
  assert.deepEqual(await session(registry, { wallet, timestamp, signature }), { status: 404, error: "no_account" });
  registry.rows.push({ wallet, nullifierHash: "h" });
  assert.deepEqual(await session(registry, { wallet, timestamp, signature }), { status: 200, wallet });
});

test("a typed address, someone else's signature or an old signature can't sign in", async () => {
  const account = privateKeyToAccount(generatePrivateKey());
  const wallet = account.address.toLowerCase();
  registry.rows.push({ wallet, nullifierHash: "h" });
  const now = Date.now();
  const attacker = privateKeyToAccount(generatePrivateKey());
  const forged = await attacker.signMessage({ message: signedMessage("login", wallet, now) });
  const old = now - 10 * 60 * 1000;
  const stale = await account.signMessage({ message: signedMessage("login", wallet, old) });
  const denied = { status: 401, error: "bad_signature" };
  assert.deepEqual(await session(registry, { wallet }), denied);
  assert.deepEqual(await session(registry, { wallet, timestamp: now, signature: forged }), denied);
  assert.deepEqual(await session(registry, { wallet, timestamp: old, signature: stale }), denied);
});
