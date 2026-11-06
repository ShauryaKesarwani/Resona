import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { beforeEach, test } from "node:test";
import { hashSignal } from "@worldcoin/idkit-core/hashing";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import type { Account, AccountRegistry } from "../arkiv/accounts.ts";
import { signedMessage } from "../utils/signature.ts";
import { hashNullifier, hashSession, login, signup, type AuthConfig } from "./auth.service.ts";
import type { Verifier } from "./world.service.ts";

const config: AuthConfig = { rpId: "rp_test", action: "signin-test", environment: "staging", nullifierHashKey: "secret" };
const keyOne = privateKeyToAccount(generatePrivateKey());
const keyTwo = privateKeyToAccount(generatePrivateKey());
const first = keyOne.address.toLowerCase();
const second = keyTwo.address.toLowerCase();
const passes: Verifier = async () => ({ ok: true, body: { success: true, environment: "staging" } });
const never: Verifier = async () => assert.fail("should not call World");

const signed = async (purpose: string, key = keyOne, wallet = key.address.toLowerCase()) => {
  const timestamp = Date.now();
  return { wallet, timestamp, signature: await key.signMessage({ message: signedMessage(purpose, wallet, timestamp) }) };
};
const proofFor = (wallet: string, overrides = {}) => ({
  environment: "staging",
  action: "signin-test",
  session_id: "session_abc",
  responses: [{ nullifier: "0xABC", signal_hash: hashSignal(wallet) }],
  ...overrides,
});
let proofCount = 0;
const sessionProof = (wallet: string, overrides = {}) => ({
  environment: "staging",
  session_id: "session_abc",
  responses: [{ session_nullifier: [`0x${++proofCount}`, "0x1"], signal_hash: hashSignal(wallet) }],
  ...overrides,
});
const enroll = async (key = keyOne, overrides = {}) =>
  signup(registry, config, passes, { ...await signed("signup", key), idkitResponse: proofFor(key.address.toLowerCase(), overrides) });

export function memoryRegistry(): AccountRegistry & { rows: Account[] } {
  const rows: Account[] = [];
  return {
    rows,
    ready: true,
    findByWallet: async (wallet) => {
      const mine = rows.filter((row) => row.wallet === wallet);
      return mine.find((row) => row.sessionHash) ?? mine[0] ?? null;
    },
    findByNullifierHash: async (hash) => rows.find((row) => row.nullifierHash === hash) ?? null,
    create: async ({ wallet, nullifierHash, sessionHash, userId }) =>
      void rows.push({ wallet, nullifierHash, sessionHash, userId: userId ?? createHash("sha256").update(nullifierHash).digest("hex") }),
  };
}

let registry: ReturnType<typeof memoryRegistry>;
beforeEach(() => {
  registry = memoryRegistry();
});

test("a new human gets an account, stored with hashes and never the raw nullifier or session", async () => {
  assert.deepEqual(await enroll(), { status: 200, wallet: first });
  const nullifierHash = hashNullifier("secret", "0xabc");
  assert.deepEqual(registry.rows, [{
    wallet: first, nullifierHash, sessionHash: hashSession("secret", "session_abc"),
    userId: createHash("sha256").update(nullifierHash).digest("hex"),
  }]);
  assert.ok(!JSON.stringify(registry.rows).includes("session_abc"));
});

test("the hash ignores hex casing but depends on the secret", () => {
  assert.equal(hashNullifier("k", "0xABC"), hashNullifier("k", "0xabc"));
  assert.notEqual(hashNullifier("k", "0xabc"), hashNullifier("other", "0xabc"));
});

test("the same human with a second wallet is rejected", async () => {
  await enroll();
  assert.deepEqual(await enroll(keyTwo), { status: 409, error: "human_has_account" });
  assert.equal(registry.rows.length, 1);
});

test("two sign-ups at once can't both win", async () => {
  const slowFind = registry.findByNullifierHash;
  registry.findByNullifierHash = async (hash) => {
    await new Promise((resolve) => setTimeout(resolve, 5));
    return slowFind(hash);
  };
  const [a, b] = await Promise.all([enroll(), enroll(keyTwo)]);
  assert.deepEqual([a.status, b.status].sort(), [200, 409]);
  assert.equal(registry.rows.length, 1);
});

test("a wallet with a session can't be taken over by a different human", async () => {
  await enroll();
  const other = { responses: [{ nullifier: "0xdef", signal_hash: hashSignal(first) }] };
  assert.deepEqual(await enroll(keyOne, other), { status: 409, error: "wallet_taken" });
});

test("sign-up needs the wallet's own signature, so nobody can attach a session to someone else's account", async () => {
  registry.rows.push({ wallet: first, nullifierHash: "old", userId: "kept" });
  const forged = await signed("signup", keyTwo, first);
  const out = await signup(registry, config, never, { ...forged, idkitResponse: proofFor(first) });
  assert.deepEqual(out, { status: 401, error: "bad_signature" });
  assert.equal(registry.rows.length, 1);
});

test("an account from before sessions adds one and keeps its user ID, so tickets carry over", async () => {
  registry.rows.push({ wallet: first, nullifierHash: "old", userId: "kept" });
  assert.deepEqual(await enroll(), { status: 200, wallet: first });
  const account = await registry.findByWallet(first);
  assert.equal(account?.userId, "kept");
  assert.equal(account?.sessionHash, hashSession("secret", "session_abc"));
});

test("the same wallet and human repeating sign-up is fine, with no new record", async () => {
  await enroll();
  const out = await signup(registry, config, never, { ...await signed("signup"), idkitResponse: proofFor(first) });
  assert.deepEqual(out, { status: 200, wallet: first });
  assert.equal(registry.rows.length, 1);
});

test("a replay reported by World, or a failed proof, creates nothing", async () => {
  const replay: Verifier = async () => ({ ok: false, body: { code: "nullifier_replayed" } });
  const invalid: Verifier = async () => ({ ok: false, body: { code: "invalid_proof" } });
  const input = { ...await signed("signup"), idkitResponse: proofFor(first) };
  assert.deepEqual(await signup(registry, config, replay, input), { status: 409, error: "human_has_account" });
  assert.deepEqual(await signup(registry, config, invalid, input), { status: 400, error: "verification_failed" });
  assert.equal(registry.rows.length, 0);
});

test("wrong action, environment, wallet or a missing session is rejected before calling World", async () => {
  const base = await signed("signup");
  const run = (idkitResponse: unknown) => signup(registry, config, never, { ...base, idkitResponse });
  assert.deepEqual(await run(proofFor(first, { action: "other" })), { status: 400, error: "wrong_action" });
  assert.deepEqual(await run(proofFor(first, { environment: "production" })), { status: 400, error: "wrong_environment" });
  assert.deepEqual(await run(proofFor(second)), { status: 400, error: "wrong_wallet" });
  assert.deepEqual(await run(proofFor(first, { session_id: undefined })), { status: 400, error: "malformed_proof" });
});

test("no World proof is spent when Arkiv isn't configured", async () => {
  const out = await signup({ ...registry, ready: false }, config, never, { ...await signed("signup"), idkitResponse: proofFor(first) });
  assert.deepEqual(out, { status: 503, error: "arkiv_not_configured" });
});

test("a returning human signs in with a World proof of their own session", async () => {
  await enroll();
  const out = await login(registry, config, passes, { ...await signed("login"), idkitResponse: sessionProof(first) });
  assert.deepEqual(out, { status: 200, wallet: first });
});

test("a wallet signature alone is no longer enough to sign in", async () => {
  await enroll();
  const out = await login(registry, config, never, await signed("login"));
  assert.deepEqual(out, { status: 400, error: "wrong_environment" });
});

test("someone else's session, or a proof made for another wallet, can't sign in", async () => {
  await enroll();
  const run = async (idkitResponse: unknown) => login(registry, config, never, { ...await signed("login"), idkitResponse });
  assert.deepEqual(await run(sessionProof(first, { session_id: "session_other" })), { status: 403, error: "wrong_session" });
  assert.deepEqual(await run(sessionProof(second)), { status: 400, error: "wrong_wallet" });
});

test("a session proof works once", async () => {
  await enroll();
  const idkitResponse = sessionProof(first);
  assert.equal((await login(registry, config, passes, { ...await signed("login"), idkitResponse })).status, 200);
  const again = await login(registry, config, never, { ...await signed("login"), idkitResponse });
  assert.deepEqual(again, { status: 409, error: "proof_replayed" });
});

test("a proof World rejects doesn't sign in", async () => {
  await enroll();
  const invalid: Verifier = async () => ({ ok: false, body: { code: "invalid_proof" } });
  const out = await login(registry, config, invalid, { ...await signed("login"), idkitResponse: sessionProof(first) });
  assert.deepEqual(out, { status: 400, error: "verification_failed" });
});

test("an account with no session is told to add one", async () => {
  registry.rows.push({ wallet: first, nullifierHash: "old", userId: "u" });
  const out = await login(registry, config, never, { ...await signed("login"), idkitResponse: sessionProof(first) });
  assert.deepEqual(out, { status: 403, error: "no_session" });
});

test("a typed address, someone else's signature or an old signature can't sign in", async () => {
  await enroll();
  const now = Date.now();
  const forged = await keyTwo.signMessage({ message: signedMessage("login", first, now) });
  const old = now - 10 * 60 * 1000;
  const stale = await keyOne.signMessage({ message: signedMessage("login", first, old) });
  const denied = { status: 401, error: "bad_signature" };
  const idkitResponse = sessionProof(first);
  assert.deepEqual(await login(registry, config, never, { wallet: first, idkitResponse }), denied);
  assert.deepEqual(await login(registry, config, never, { wallet: first, timestamp: now, signature: forged, idkitResponse }), denied);
  assert.deepEqual(await login(registry, config, never, { wallet: first, timestamp: old, signature: stale, idkitResponse }), denied);
});
