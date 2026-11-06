import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import type { AccountRegistry } from "../arkiv/accounts.ts";
import type { Ticket, TicketStore } from "../arkiv/tickets.ts";
import { signedMessage } from "../utils/signature.ts";
import { claim } from "./claim.service.ts";

const account = privateKeyToAccount(generatePrivateKey());
const wallet = account.address.toLowerCase();
async function signedClaim(passId: string, signer = account) {
  const timestamp = Date.now();
  const signature = await signer.signMessage({ message: signedMessage(`claim:${passId}`, wallet, timestamp) });
  return { passId, wallet, timestamp, signature };
}

const withAccount = { ready: true, findByWallet: async () => ({ wallet, nullifierHash: "h", userId: "user-hash" }), findByNullifierHash: async () => null, create: async () => {} } satisfies AccountRegistry;
const noAccount = { ...withAccount, findByWallet: async () => null } satisfies AccountRegistry;

let tickets: TicketStore;
let rows: Ticket[];
let passId: string;
beforeEach(() => {
  rows = [];
  const userClaims = new Set<string>();
  tickets = {
    ready: true,
    issue: async () => { throw new Error("Not used in this test"); },
    ticket: async (id) => rows.find((row) => row.passId === id),
    ticketsOf: async () => rows,
    hasClaimed: async (userId) => userClaims.has(userId),
    setStatus: async (id, status) => {
      const row = rows.find((item) => item.passId === id)!;
      row.status = status;
      return row;
    },
    commitClaim: async (id, _operationId, _holder, userId) => {
      if (userClaims.has(userId)) throw new Error("Human already claimed");
      userClaims.add(userId);
      const row = rows.find((item) => item.passId === id)!;
      row.status = "claimed";
      return row;
    },
  };
  passId = "pass-a";
  rows.push({ passId, eventId: "event", holder: wallet, tier: "general", status: "issued", entityKey: `0x${"1".repeat(64)}` as `0x${string}` });
});

test("a signed-in wallet claims with no World proof", async () => {
  const out = await claim(tickets, withAccount, false, await signedClaim(passId));
  assert.equal(out.status, 200);
  assert.equal((await tickets.ticket(passId))?.status, "claimed");
});

test("a request not signed by the wallet is rejected", async () => {
  const attacker = privateKeyToAccount(generatePrivateKey());
  const out = await claim(tickets, withAccount, false, await signedClaim(passId, attacker));
  assert.deepEqual(out, { status: 401, error: "bad_signature" });
  assert.equal((await tickets.ticket(passId))?.status, "issued");
});

test("a signature for one ticket can't claim another", async () => {
  const other = "pass-b";
  rows.push({ ...rows[0], passId: other });
  const out = await claim(tickets, withAccount, false, { ...(await signedClaim(passId)), passId: other });
  assert.deepEqual(out, { status: 401, error: "bad_signature" });
});

test("one account claims one ticket", async () => {
  await claim(tickets, withAccount, false, await signedClaim(passId));
  const second = "pass-b";
  rows.push({ ...rows[0], passId: second, status: "issued" });
  const out = await claim(tickets, withAccount, false, await signedClaim(second));
  assert.deepEqual(out, { status: 409, error: "human_already_claimed" });
});

test("only the ticket's holder can claim it", async () => {
  const theirs = "pass-other";
  rows.push({ ...rows[0], passId: theirs, holder: "0xaaaa000000000000000000000000000000000001" });
  const out = await claim(tickets, withAccount, false, await signedClaim(theirs));
  assert.deepEqual(out, { status: 403, error: "not_ticket_holder" });
});

test("checked-in and revoked tickets cannot be claimed or skipped", async () => {
  for (const status of ["checked_in", "revoked"] as const) {
    rows[0].status = status;
    const out = await claim(tickets, noAccount, true, await signedClaim(passId));
    assert.deepEqual(out, { status: 409, error: "already_claimed" });
    assert.equal((await tickets.ticket(passId))?.status, status);
  }
});

test("a guest is marked skipped only when skip is on, and can claim properly later", async () => {
  assert.deepEqual(await claim(tickets, noAccount, false, await signedClaim(passId)), { status: 403, error: "no_account" });
  await claim(tickets, noAccount, true, await signedClaim(passId));
  assert.equal((await tickets.ticket(passId))?.status, "skipped");
  await claim(tickets, withAccount, false, await signedClaim(passId));
  assert.equal((await tickets.ticket(passId))?.status, "claimed");
});
