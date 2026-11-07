import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import type { Account } from "../arkiv/accounts.ts";
import { createQueue } from "../utils/queue.ts";
import type { CheckinStore, DoorTicket } from "../arkiv/tickets.ts";
import { signedMessage } from "../utils/signature.ts";
import { createCheckins } from "./checkin.service.ts";

const holderKey = privateKeyToAccount(generatePrivateKey());
const strangerKey = privateKeyToAccount(generatePrivateKey());
const wallet = holderKey.address.toLowerCase();
const passId = "pass-a";

const sign = async (purpose: string, key = holderKey, as = wallet) => {
  const timestamp = Date.now();
  return { wallet: as, timestamp, signature: await key.signMessage({ message: signedMessage(purpose, as, timestamp) }) };
};

let ticket: DoorTicket;
let written: Array<{ passId: string; cm: number }>;
let store: CheckinStore;
let clock: number;
let checkins: ReturnType<typeof createCheckins>;
let writeFails: boolean;
let paymentOk: boolean;
let ended: boolean;
let account: Account | null;
let humanClaimed: boolean;
let ensPassVerified: boolean;
let ensReadFails: boolean;
let ensChecks: number;
let transferPending: boolean;
const registry = { ready: true, findByWallet: async () => account };
const ens = {
  configured: true,
  pass: async (_passId: string, _holder: string) => {
    ensChecks++;
    if (ensReadFails) throw new Error("rpc unavailable");
    return { enabled: true as const, name: `${passId}.demo-event.eth`, chainId: 11155111 as const,
      registry: "0x0000000000000000000000000000000000000022" as const,
      owner: wallet as `0x${string}`, expiry: "9999999999",
      active: ensPassVerified, linked: ensPassVerified, matchesHolder: ensPassVerified };
  },
};

beforeEach(() => {
  ticket = { passId, eventId: "event", holder: wallet, tier: "general", status: "claimed", entityKey: "0x1", bought: false };
  written = [];
  clock = 1_000_000;
  writeFails = false;
  paymentOk = true;
  ended = false;
  account = { wallet, userId: "human-a", nullifierHash: "hash" };
  humanClaimed = false;
  ensPassVerified = true;
  ensReadFails = false;
  ensChecks = 0;
  transferPending = false;
  const exclusive = createQueue();
  store = {
    hasClaimed: async () => humanClaimed,
    doorTicket: async (id) => (id === passId ? ticket : undefined),
    paymentIsValid: async () => paymentOk,
    eventEnded: async () => ended,
    hasCheckedIn: async () => written.length > 0,
    hasPendingTransfer: async () => transferPending,
    commitCheckin: (door, cm, revalidate) => exclusive(async () => {
      const current = await revalidate();
      if (writeFails) throw new Error("write failed");
      written.push({ passId: door.passId, cm });
      if (current.userId) humanClaimed = true;
      return { ordinal: written.length, transactionHash: "0xabc", entityKey: "0xdef" };
    }),
  };
  checkins = createCheckins({ store, registry, allowSkip: false, doorPin: "1234", ens, now: () => clock });
});

const started = async () => {
  const out = await checkins.start({ passId, ...await sign(`checkin:${passId}`) });
  assert.equal(out.status, 200);
  return out as Extract<typeof out, { status: 200 }>;
};
const joined = async () => {
  const { code } = await started();
  const out = checkins.join({ code, pin: "1234" });
  assert.equal(out.status, 200);
  return out as Extract<typeof out, { status: 200 }>;
};
const holderReport = async (id: string, elapsedSeconds: number | null, key = holderKey, as = wallet, attempt = 1) =>
  checkins.report(id, { role: "holder", attempt, elapsedSeconds, ...await sign(`checkin-report:${id}:${attempt}:${elapsedSeconds}`, key, as) });
// 17150 cm/s x (door - holder): 0.00175 s apart is about 30 cm.
const measure = async (door: number, holder: number) => {
  const session = await joined();
  await checkins.report(session.id, { role: "door", attempt: 1, elapsedSeconds: door, doorToken: session.doorToken });
  await holderReport(session.id, holder);
  return checkins.status(session.id)!;
};

test("close phones pass, and the check-in is written to Arkiv", async () => {
  const out = await measure(1.50175, 1.5);
  assert.equal(out.state, "pass");
  assert.ok(Math.abs(out.cm! - 30) < 0.1);
  assert.equal(out.ordinal, 1);
  assert.equal(out.transactionHash, "0xabc");
  assert.equal(written.length, 1);
});

test("a missing, expired, unlinked, or mismatched ENS pass is refused at session start", async () => {
  ensPassVerified = false;
  assert.deepEqual(await checkins.start({ passId, ...await sign(`checkin:${passId}`) }), { status: 403, error: "ens_pass_not_verified" });
  assert.equal(written.length, 0);
});

test("the door receives the verified pass name with the check-in session", async () => {
  const { code } = await started();
  const joined = checkins.join({ code, pin: "1234" });
  assert.equal(joined.status, 200);
  if (joined.status === 200) assert.equal(joined.ensName, `${passId}.demo-event.eth`);
});

test("an ENS read failure fails closed", async () => {
  ensReadFails = true;
  assert.deepEqual(await checkins.start({ passId, ...await sign(`checkin:${passId}`) }), { status: 403, error: "ens_verification_failed" });
  assert.equal(written.length, 0);
});

test("check-in is refused while a ticket transfer request is pending", async () => {
  transferPending = true;
  assert.deepEqual(await checkins.start({ passId, ...await sign(`checkin:${passId}`) }), { status: 409, error: "transfer_pending" });
  assert.equal(written.length, 0);
});

test("a transfer request added during sonar is rechecked before admission", async () => {
  const session = await joined();
  transferPending = true;
  await checkins.report(session.id, { role: "door", attempt: 1, elapsedSeconds: 1.50175, doorToken: session.doorToken });
  await holderReport(session.id, 1.5);
  assert.equal(checkins.status(session.id)!.state, "failed");
  assert.equal(checkins.status(session.id)!.problem, "transfer_pending");
  assert.equal(written.length, 0);
});

test("ENS ownership is checked again immediately before the admission write", async () => {
  const session = await joined();
  ensPassVerified = false;
  await checkins.report(session.id, { role: "door", attempt: 1, elapsedSeconds: 1.50175, doorToken: session.doorToken });
  await holderReport(session.id, 1.5);
  assert.equal(checkins.status(session.id)!.state, "failed");
  assert.equal(checkins.status(session.id)!.problem, "ens_pass_not_verified");
  assert.equal(ensChecks, 2);
  assert.equal(written.length, 0);
});

test("phones across the room fail, and nothing is written", async () => {
  const out = await measure(1.512, 1.5);
  assert.equal(out.state, "too_far");
  assert.ok(out.cm! > 200);
  assert.equal(written.length, 0);
});

test("an impossible reading is refused", async () => {
  assert.equal((await measure(1.4, 1.5)).state, "invalid");
  assert.equal(written.length, 0);
});

test("a phone that heard nothing ends the check with no admission", async () => {
  const session = await joined();
  assert.equal((await holderReport(session.id, null)).status, 200);
  assert.equal(checkins.status(session.id)!.state, "no_sound");
  assert.equal(written.length, 0);
});

test("the door can't be run without the PIN", async () => {
  const { code } = await started();
  assert.deepEqual(checkins.join({ code, pin: "0000" }), { status: 403, error: "bad_door_pin" });
  assert.deepEqual(checkins.join({ code }), { status: 403, error: "bad_door_pin" });
});

test("selecting a ticket only joins an active holder session with the configured door PIN", async () => {
  assert.deepEqual(checkins.joinSelected({ passId, pin: "1234" }), { status: 404, error: "code_not_found" });
  const session = await started();
  assert.deepEqual(checkins.joinSelected({ passId, pin: "wrong" }), { status: 403, error: "bad_door_pin" });
  assert.deepEqual(checkins.joinSelected({ passId: "other", pin: "1234" }), { status: 404, error: "code_not_found" });
  const joined = checkins.joinSelected({ passId, pin: "1234" });
  assert.equal(joined.status, 200);
  if (joined.status === 200) assert.equal(joined.id, session.id);
  assert.deepEqual(checkins.joinSelected({ passId, pin: "1234" }), { status: 409, error: "check_running" });
});

test("selecting a ticket is disabled when no door PIN is configured", async () => {
  checkins = createCheckins({ store, registry, allowSkip: false, now: () => clock });
  await started();
  assert.deepEqual(checkins.joinSelected({ passId }), { status: 403, error: "door_pin_not_configured" });
});

test("a stranger can't start a check-in, or sign the holder's report", async () => {
  const forged = await checkins.start({ passId, ...await sign(`checkin:${passId}`, strangerKey, wallet) });
  assert.deepEqual(forged, { status: 401, error: "bad_signature" });
  const session = await joined();
  const out = await holderReport(session.id, 1.5, strangerKey, wallet);
  assert.deepEqual(out, { status: 401, error: "bad_signature" });
  const own = await holderReport(session.id, 1.5, strangerKey, strangerKey.address.toLowerCase());
  assert.deepEqual(own, { status: 401, error: "bad_signature" });
});

test("a ticket held by someone else can't be used", async () => {
  ticket.holder = strangerKey.address.toLowerCase();
  const out = await checkins.start({ passId, ...await sign(`checkin:${passId}`) });
  assert.deepEqual(out, { status: 403, error: "not_ticket_holder" });
});

test("the holder can't send the door's measurement", async () => {
  const session = await joined();
  const out = await checkins.report(session.id, { role: "door", attempt: 1, elapsedSeconds: 1.5, doorToken: "guess" });
  assert.deepEqual(out, { status: 403, error: "bad_door_token" });
});

test("a report can't be changed after it is sent", async () => {
  const session = await joined();
  await holderReport(session.id, 1.5);
  assert.deepEqual(await holderReport(session.id, 1.501), { status: 409, error: "already_reported" });
});

test("a report signed for one reading can't carry another", async () => {
  const session = await joined();
  const signed = await sign(`checkin-report:${session.id}:1:1.5`);
  const out = await checkins.report(session.id, { role: "holder", attempt: 1, elapsedSeconds: 1.502, ...signed });
  assert.deepEqual(out, { status: 401, error: "bad_signature" });
});

test("each check-in gets a fresh seed, so an old recording can't be replayed", async () => {
  assert.notEqual((await started()).seed, (await started()).seed);
});

test("a repeat check-in is rejected", async () => {
  await measure(1.50175, 1.5);
  const out = await checkins.start({ passId, ...await sign(`checkin:${passId}`) });
  assert.deepEqual(out, { status: 409, error: "already_checked_in" });
});

test("each ticket status gets the right refusal", async () => {
  const run = async () => checkins.start({ passId, ...await sign(`checkin:${passId}`) });
  ticket.status = "issued";
  assert.deepEqual(await run(), { status: 409, error: "not_claimed" });
  ticket.status = "checked_in";
  assert.deepEqual(await run(), { status: 409, error: "already_checked_in" });
  ticket.status = "revoked";
  assert.deepEqual(await run(), { status: 403, error: "ticket_revoked" });
  ticket.status = "skipped";
  assert.deepEqual(await run(), { status: 403, error: "not_verified" });
});

test("an ended event is refused", async () => {
  ended = true;
  const out = await checkins.start({ passId, ...await sign(`checkin:${passId}`) });
  assert.deepEqual(out, { status: 410, error: "event_ended" });
});

test("a bought ticket needs a real payment, and an issued one doesn't", async () => {
  paymentOk = false;
  assert.equal((await checkins.start({ passId, ...await sign(`checkin:${passId}`) })).status, 200);
  ticket.bought = true;
  const out = await checkins.start({ passId, ...await sign(`checkin:${passId}`) });
  assert.deepEqual(out, { status: 402, error: "payment_not_found" });
});

test("a bought ticket needs a World account regardless of demo skip", async () => {
  ticket.bought = true;
  account = null;
  const out = await checkins.start({ passId, ...await sign(`checkin:${passId}`) });
  assert.deepEqual(out, { status: 403, error: "not_verified" });
  account = { wallet, nullifierHash: "hash", userId: "human-a" };
  assert.equal((await checkins.start({ passId, ...await sign(`checkin:${passId}`) })).status, 200);
  account = null;
  const demo = createCheckins({ store, registry, allowSkip: true, doorPin: "1234", now: () => clock });
  assert.deepEqual(await demo.start({ passId, ...await sign(`checkin:${passId}`) }), { status: 403, error: "not_verified" });
});

test("an old code stops working, and a code works once", async () => {
  const { code } = await started();
  clock += 3 * 60 * 1000;
  assert.deepEqual(checkins.join({ code, pin: "1234" }), { status: 404, error: "code_not_found" });
  const fresh = await started();
  assert.equal(checkins.join({ code: fresh.code, pin: "1234" }).status, 200);
  assert.deepEqual(checkins.join({ code: fresh.code, pin: "1234" }), { status: 409, error: "check_running" });
});

test("typing the same code after a failed try starts the next try, and both phones follow", async () => {
  const { code, id } = await started();
  const first = checkins.join({ code, pin: "1234" });
  await holderReport(id, null);
  const second = checkins.join({ code, pin: "1234" });
  assert.equal(second.status, 200);
  const next = checkins.status(id)!;
  assert.equal(next.state, "running");
  assert.equal(next.attempt, 2);
  assert.notEqual(next.seed, (first as { seed: string }).seed);
});

test("a code is dead once the check has passed", async () => {
  const { code, id } = await started();
  const session = checkins.join({ code, pin: "1234" }) as { doorToken: string };
  await checkins.report(id, { role: "door", attempt: 1, elapsedSeconds: 1.50175, doorToken: session.doorToken });
  await holderReport(id, 1.5);
  assert.deepEqual(checkins.join({ code, pin: "1234" }), { status: 404, error: "code_not_found" });
});

test("a run that never finishes expires", async () => {
  const session = await joined();
  clock += 16 * 1000;
  assert.equal(checkins.status(session.id)!.state, "expired");
  assert.deepEqual(await holderReport(session.id, 1.5), { status: 409, error: "session_not_running" });
});

test("a failed Arkiv write fails the check and is never written again", async () => {
  writeFails = true;
  const session = await joined();
  await checkins.report(session.id, { role: "door", attempt: 1, elapsedSeconds: 1.50175, doorToken: session.doorToken });
  await holderReport(session.id, 1.5);
  assert.equal(checkins.status(session.id)!.state, "failed");
  assert.deepEqual(await checkins.retry(session.id, { doorToken: session.doorToken }), { status: 409, error: "cannot_retry" });
  assert.deepEqual(await holderReport(session.id, 1.5), { status: 409, error: "session_not_running" });
});

test("the door can try again with no new code, and the next try can pass", async () => {
  const session = await joined();
  await holderReport(session.id, null);
  assert.deepEqual(await checkins.retry(session.id, { doorToken: session.doorToken }), { status: 200 });
  const next = checkins.status(session.id)!;
  assert.equal(next.state, "running");
  assert.equal(next.attempt, 2);
  assert.notEqual(next.seed, session.seed);
  await checkins.report(session.id, { role: "door", attempt: 2, elapsedSeconds: 1.50175, doorToken: session.doorToken });
  await holderReport(session.id, 1.5, holderKey, wallet, 2);
  assert.equal(checkins.status(session.id)!.state, "pass");
  assert.equal(written.length, 1);
});

test("the holder can also try again, but only with their own wallet", async () => {
  const session = await joined();
  await holderReport(session.id, null);
  const forged = await checkins.retry(session.id, await sign(`checkin-retry:${session.id}:1`, strangerKey, wallet));
  assert.deepEqual(forged, { status: 403, error: "not_in_this_check" });
  assert.deepEqual(await checkins.retry(session.id, { doorToken: "guess" }), { status: 403, error: "not_in_this_check" });
  assert.deepEqual(await checkins.retry(session.id, await sign(`checkin-retry:${session.id}:1`)), { status: 200 });
});

test("a reading from an earlier try can't count in the next one", async () => {
  const session = await joined();
  await holderReport(session.id, null);
  await checkins.retry(session.id, { doorToken: session.doorToken });
  const out = await checkins.report(session.id, { role: "door", attempt: 1, elapsedSeconds: 1.5, doorToken: session.doorToken });
  assert.deepEqual(out, { status: 409, error: "old_attempt" });
  assert.deepEqual(await holderReport(session.id, 1.5), { status: 409, error: "old_attempt" });
});

test("a running or passed check can't be restarted", async () => {
  const session = await joined();
  assert.deepEqual(await checkins.retry(session.id, { doorToken: session.doorToken }), { status: 409, error: "cannot_retry" });
  await checkins.report(session.id, { role: "door", attempt: 1, elapsedSeconds: 1.50175, doorToken: session.doorToken });
  await holderReport(session.id, 1.5);
  assert.deepEqual(await checkins.retry(session.id, { doorToken: session.doorToken }), { status: 409, error: "cannot_retry" });
});

test("purchased tickets require a trusted World account even when demo skip is enabled", async () => {
  ticket.bought = true;
  account = null;
  checkins = createCheckins({ store, registry, allowSkip: true });
  for (const status of ["claimed", "skipped"] as const) {
    ticket.status = status;
    assert.deepEqual(await checkins.start({ passId, ...await sign(`checkin:${passId}`) }), { status: 403, error: "not_verified" });
  }
  assert.equal(written.length, 0);
});

test("a verified buyer with payment is admitted and consumes the event claim", async () => {
  ticket.bought = true;
  assert.equal((await measure(1.50175, 1.5)).state, "pass");
  assert.equal(humanClaimed, true);
});

test("a buyer cannot use an event already claimed by their human", async () => {
  ticket.bought = true;
  humanClaimed = true;
  assert.deepEqual(await checkins.start({ passId, ...await sign(`checkin:${passId}`) }), { status: 409, error: "human_already_claimed" });
  assert.equal(written.length, 0);
});

test("demo skip still admits an organizer-issued skipped ticket", async () => {
  ticket.status = "skipped";
  account = null;
  checkins = createCheckins({ store, registry, allowSkip: true });
  assert.equal((await measure(1.50175, 1.5)).state, "pass");
});

for (const [reason, change] of [
  ["ticket_revoked", () => { ticket = { ...ticket, status: "revoked" }; }],
  ["not_claimed", () => { ticket = { ...ticket, status: "issued" }; }],
  ["already_checked_in", () => { ticket = { ...ticket, status: "checked_in" }; }],
  ["not_verified", () => { ticket = { ...ticket, status: "skipped" }; }],
  ["not_ticket_holder", () => { ticket = { ...ticket, holder: strangerKey.address.toLowerCase() }; }],
  ["ticket_changed", () => { ticket = { ...ticket, eventId: "another-event" }; }],
  ["ticket_changed", () => { ticket = { ...ticket, entityKey: "0x999" }; }],
  ["ticket_changed", () => { ticket = { ...ticket, bought: false }; }],
  ["ticket_not_found", () => { store.doorTicket = async () => undefined; }],
  ["event_ended", () => { ended = true; }],
  ["already_checked_in", () => { store.hasCheckedIn = async () => true; }],
  ["not_verified", () => { account = null; }],
  ["human_already_claimed", () => { humanClaimed = true; }],
  ["payment_not_found", () => { paymentOk = false; }],
] as const) {
  test(`admission rechecks eligibility: ${reason} (${change.toString()})`, async () => {
    ticket.bought = true;
    const session = await joined();
    await checkins.report(session.id, { role: "door", attempt: 1, elapsedSeconds: 1.50175, doorToken: session.doorToken });
    change();
    await holderReport(session.id, 1.5);
    assert.equal(checkins.status(session.id)!.state, "failed");
    assert.equal(checkins.status(session.id)!.problem, reason);
    assert.equal(written.length, 0);
  });
}

test("two wallets of the same human cannot both be admitted in concurrent sessions", async () => {
  const secondWallet = strangerKey.address.toLowerCase();
  const tickets = [
    { ...ticket, bought: true },
    { ...ticket, passId: "pass-b", holder: secondWallet, entityKey: "0x2" as const, bought: true },
  ];
  store.doorTicket = async (id) => tickets.find((t) => t.passId === id);
  store.hasCheckedIn = async () => false; // Isolate human uniqueness from wallet duplicate protection.
  const sharedHumanRegistry = { ready: true, findByWallet: async (wallet: string) => ({ wallet, userId: "same-human", nullifierHash: "hash" }) };
  checkins = createCheckins({ store, registry: sharedHumanRegistry, allowSkip: false, doorPin: "1234" });
  const first = await joined();
  const second = await checkins.start({ passId: "pass-b", ...await sign("checkin:pass-b", strangerKey, secondWallet) });
  assert.equal(second.status, 200);
  if (second.status !== 200) return;
  const door = checkins.join({ code: second.code, pin: "1234" });
  assert.equal(door.status, 200);
  if (door.status !== 200) return;
  await checkins.report(first.id, { role: "door", attempt: 1, elapsedSeconds: 1.50175, doorToken: first.doorToken });
  await checkins.report(door.id, { role: "door", attempt: 1, elapsedSeconds: 1.50175, doorToken: door.doorToken });
  await Promise.all([holderReport(first.id, 1.5), holderReport(door.id, 1.5, strangerKey, secondWallet)]);
  assert.deepEqual([checkins.status(first.id)!.state, checkins.status(door.id)!.state].sort(), ["failed", "pass"]);
  assert.equal(written.length, 1);
});

test("eligibility is re-read after waiting for the admission queue", async () => {
  const session = await joined();
  const commit = store.commitCheckin;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let entered!: () => void;
  const waiting = new Promise<void>((resolve) => { entered = resolve; });
  store.commitCheckin = async (...args) => { entered(); await gate; return commit(...args); };
  await checkins.report(session.id, { role: "door", attempt: 1, elapsedSeconds: 1.50175, doorToken: session.doorToken });
  const finishing = holderReport(session.id, 1.5);
  await waiting;
  ticket = { ...ticket, status: "revoked" };
  release();
  await finishing;
  assert.equal(checkins.status(session.id)!.problem, "ticket_revoked");
  assert.equal(written.length, 0);
});

test("eligibility read failures fail closed without writing", async () => {
  const session = await joined();
  store.doorTicket = async () => { throw new Error("upstream unavailable"); };
  await checkins.report(session.id, { role: "door", attempt: 1, elapsedSeconds: 1.50175, doorToken: session.doorToken });
  await holderReport(session.id, 1.5);
  assert.equal(checkins.status(session.id)!.state, "failed");
  assert.equal(written.length, 0);
});

test("a failed bought-ticket admission does not consume a claim", async () => {
  ticket.bought = true;
  writeFails = true;
  assert.equal((await measure(1.50175, 1.5)).state, "failed");
  assert.equal(humanClaimed, false);
});

test("the failure says which phone heard what", async () => {
  const session = await joined();
  await checkins.report(session.id, { role: "door", attempt: 1, elapsedSeconds: null, problem: "no-holder-sound", doorToken: session.doorToken });
  assert.equal(checkins.status(session.id)!.problem, "door:no-holder-sound");
});
