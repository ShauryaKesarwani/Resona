import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
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

beforeEach(() => {
  ticket = { passId, eventId: "event", holder: wallet, tier: "general", status: "claimed", entityKey: "0x1", bought: false };
  written = [];
  clock = 1_000_000;
  writeFails = false;
  paymentOk = true;
  ended = false;
  store = {
    doorTicket: async (id) => (id === passId ? ticket : undefined),
    paymentIsValid: async () => paymentOk,
    eventEnded: async () => ended,
    hasCheckedIn: async () => written.length > 0,
    commitCheckin: async (door, cm) => {
      if (writeFails) throw new Error("write failed");
      written.push({ passId: door.passId, cm });
      return { ordinal: written.length, transactionHash: "0xabc", entityKey: "0xdef" };
    },
  };
  checkins = createCheckins({ store, allowSkip: false, doorPin: "1234", now: () => clock });
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

test("the failure says which phone heard what", async () => {
  const session = await joined();
  await checkins.report(session.id, { role: "door", attempt: 1, elapsedSeconds: null, problem: "no-holder-sound", doorToken: session.doorToken });
  assert.equal(checkins.status(session.id)!.problem, "door:no-holder-sound");
});
