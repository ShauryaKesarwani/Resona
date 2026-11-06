import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import type { AccountRegistry } from "../arkiv/accounts.ts";
import { openStore, type Store } from "../db/store.ts";
import { signedMessage } from "../utils/signature.ts";
import { claim } from "./claim.service.ts";

const account = privateKeyToAccount(generatePrivateKey());
const wallet = account.address.toLowerCase();

async function signedClaim(passId: string, signer = account) {
  const timestamp = Date.now();
  const signature = await signer.signMessage({ message: signedMessage(`claim:${passId}`, wallet, timestamp) });
  return { passId, wallet, timestamp, signature };
}

const withAccount = { ready: true, findByWallet: async () => ({ wallet, nullifierHash: "h" }) } as unknown as AccountRegistry;
const noAccount = { ready: true, findByWallet: async () => null } as unknown as AccountRegistry;

let store: Store;
let passId: string;
beforeEach(() => {
  store = openStore(":memory:");
  passId = store.issue(wallet, "general").passId;
});

test("a signed-in wallet claims with no World proof", async () => {
  const out = await claim(store, withAccount, false, await signedClaim(passId));
  assert.equal(out.status, 200);
  assert.equal(store.ticket(passId)?.status, "claimed");
});

test("a request not signed by the wallet is rejected", async () => {
  const attacker = privateKeyToAccount(generatePrivateKey());
  const out = await claim(store, withAccount, false, await signedClaim(passId, attacker));
  assert.deepEqual(out, { status: 401, error: "bad_signature" });
  assert.equal(store.ticket(passId)?.status, "issued");
});

test("a signature for one ticket can't claim another", async () => {
  const other = store.issue(wallet, "general").passId;
  const out = await claim(store, withAccount, false, { ...(await signedClaim(passId)), passId: other });
  assert.deepEqual(out, { status: 401, error: "bad_signature" });
});

test("one account claims one ticket", async () => {
  await claim(store, withAccount, false, await signedClaim(passId));
  const second = store.issue(wallet, "general").passId;
  const out = await claim(store, withAccount, false, await signedClaim(second));
  assert.deepEqual(out, { status: 409, error: "human_already_claimed" });
});

test("only the ticket's holder can claim it", async () => {
  const theirs = store.issue("0xaaaa000000000000000000000000000000000001", "general").passId;
  const out = await claim(store, withAccount, false, await signedClaim(theirs));
  assert.deepEqual(out, { status: 403, error: "not_ticket_holder" });
});

test("a guest is marked skipped only when skip is on, and can claim properly later", async () => {
  assert.deepEqual(await claim(store, noAccount, false, await signedClaim(passId)), { status: 403, error: "no_account" });
  await claim(store, noAccount, true, await signedClaim(passId));
  assert.equal(store.ticket(passId)?.status, "skipped");
  await claim(store, withAccount, false, await signedClaim(passId));
  assert.equal(store.ticket(passId)?.status, "claimed");
});
