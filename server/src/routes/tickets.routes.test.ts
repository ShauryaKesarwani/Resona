import assert from "node:assert/strict";
import { after, test } from "node:test";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

process.env.NULLIFIER_HASH_KEY ??= "test";
process.env.WORLD_APP_ID ??= "app_test";
process.env.WORLD_RP_ID ??= "rp_test";
process.env.RP_SIGNING_KEY ??= "0x1";
process.env.WORLD_ACTION ??= "test";
process.env.WORLD_ENV ??= "staging";

const organizer = privateKeyToAccount(generatePrivateKey());
const stranger = privateKeyToAccount(generatePrivateKey());
const holder = privateKeyToAccount(generatePrivateKey()).address;
const target = privateKeyToAccount(generatePrivateKey());
const eventId = "event-1";
process.env.ORGANIZER_WALLETS = ` ${organizer.address.toUpperCase().replace("0X", "0x")} `;

const { ticketRoutes } = await import("./tickets.routes.ts");
const { env } = await import("../config/env.ts");
const { signedMessage } = await import("../utils/signature.ts");
const express = (await import("express")).default;

const issued: string[] = [];
const promoted: string[] = [];
let purchaseChecks = 0;
const funded: string[] = [];
const purchaseEvent = "a".repeat(64);
const tickets = {
  ready: true,
  canManageEvent: async (id: string, wallet: string) =>
    ((id === eventId || id === purchaseEvent) && wallet === organizer.address.toLowerCase()) || (id === "target-event" && wallet === target.address.toLowerCase()),
  issue: async (to: string) => { issued.push(to); return { holder: to }; },
  doorTicket: async (passId: string, wallet: string) => ({ passId, holder: wallet.toLowerCase(), eventId: passId === "wrong-event" ? "b".repeat(64) : purchaseEvent, tier: "general", status: "claimed", bought: passId !== "issued" }),
  paymentIsValid: async (ticket: { passId: string }) => { purchaseChecks++; return ticket.passId === "paid"; },
  fund: async (wallet: string) => { funded.push(wallet); },
};
const app = express();
app.use(express.json());
const registry = {
  findByWallet: async (wallet: string) => wallet === organizer.address.toLowerCase()
    ? { wallet, userId: "organizer-human", nullifierHash: "n", sessionHash: "session" }
    : wallet === target.address.toLowerCase()
      ? { wallet, userId: "target-human", nullifierHash: "target-n", sessionHash: "target-session" }
      : null,
  isOrganizer: async (userId: string) => promoted.includes(userId),
  promoteOrganizer: async (account: { userId: string }) => { promoted.push(account.userId); },
};
app.use("/api", ticketRoutes(tickets as never, registry as never, { configured: false } as never));
const server = app.listen(0);
after(() => server.close());

test("demo funding requires the wallet signature and demo skip", async () => {
  const original = env.world.allowSkip;
  const wallet = stranger.address.toLowerCase();
  const timestamp = Date.now();
  const signature = await stranger.signMessage({ message: signedMessage("fund", wallet, timestamp) });
  const { port } = server.address() as { port: number };
  const send = (body: unknown) => fetch(`http://127.0.0.1:${port}/api/fund`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  try {
    env.world.allowSkip = false;
    assert.equal((await send({ wallet, timestamp, signature })).status, 403);
    env.world.allowSkip = true;
    assert.equal((await send({ wallet, timestamp, signature: "0x" })).status, 401);
    assert.equal((await send({ wallet, timestamp, signature })).status, 200);
    assert.deepEqual(funded, [wallet]);
  } finally { env.world.allowSkip = original; }
});

const post = (body: unknown) => {
  const { port } = server.address() as { port: number };
  return fetch(`http://127.0.0.1:${port}/api/issue`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
};

async function signed(account: typeof organizer, to = holder, tier = "general", id = eventId) {
  const wallet = account.address.toLowerCase();
  const timestamp = Date.now();
  const signature = await account.signMessage({ message: signedMessage(`issue:${id}:${to.toLowerCase()}:${tier}`, wallet, timestamp) });
  return { wallet, timestamp, signature, eventId: id };
}

async function rejected(body: unknown, status: number, error: string) {
  const before = issued.length;
  const res = await post(body);
  assert.equal(res.status, status);
  assert.equal((await res.json()).error, error);
  assert.equal(issued.length, before, "a rejected request must not write a ticket");
}

test("an unsigned request cannot issue", () => rejected({ holder, tier: "general", eventId }, 401, "bad_signature"));

test("a wallet that is not an organizer cannot issue", async () => {
  await rejected({ holder, tier: "general", ...(await signed(stranger)) }, 403, "not_organizer");
});

test("a signature for one ticket cannot issue another", async () => {
  const other = privateKeyToAccount(generatePrivateKey()).address;
  await rejected({ holder: other, tier: "general", ...(await signed(organizer)) }, 401, "bad_signature");
  await rejected({ holder, tier: "builder", ...(await signed(organizer)) }, 401, "bad_signature");
});

test("nobody can issue when no organizer is listed", async () => {
  const saved = env.organizerWallets.splice(0);
  await rejected({ holder, tier: "general", ...(await signed(organizer)) }, 403, "not_organizer");
  env.organizerWallets.push(...saved);
});

test("a listed organizer can issue", async () => {
  const res = await post({ holder, tier: "general", ...(await signed(organizer)) });
  assert.equal(res.status, 200);
  assert.deepEqual(issued, [holder]);
});

test("a bootstrap admin can promote an existing World-linked account", async () => {
  const wallet = organizer.address.toLowerCase();
  const timestamp = Date.now();
  const signature = await organizer.signMessage({ message: signedMessage(`organizer:promote:${target.address.toLowerCase()}`, wallet, timestamp) });
  const { port } = server.address() as { port: number };
  const res = await fetch(`http://127.0.0.1:${port}/api/organizers/promote`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ wallet, targetWallet: target.address, timestamp, signature }),
  });
  assert.equal(res.status, 200);
  assert.deepEqual(promoted, ["target-human"]);
});

test("a promoted World-linked account can issue for its own event", async () => {
  const res = await post({ holder, tier: "general", ...(await signed(target, holder, "general", "target-event")) });
  assert.equal(res.status, 200);
  assert.deepEqual(issued, [holder, holder]);
});

test("an organizer cannot issue against an event assigned to another wallet", async () => {
  const id = "someone-elses-event";
  await rejected({ holder, tier: "general", ...(await signed(organizer, holder, "general", id)) }, 403, "event_not_owned");
});

test("purchase list requires an authorized organizer and checks the payment", async () => {
  const { port } = server.address() as { port: number };
  const send = (body: unknown) => fetch(`http://127.0.0.1:${port}/api/organizer/verify-purchases`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const candidates = ["paid", "paid", "unpaid", "wrong-event", "issued"].map((passId) => ({ passId, holder }));
  const wallet = organizer.address.toLowerCase();
  const timestamp = Date.now();
  const signature = await organizer.signMessage({ message: signedMessage(`organizer-purchases:${purchaseEvent}`, wallet, timestamp) });
  purchaseChecks = 0;
  assert.equal((await send({ eventId: purchaseEvent, candidates })).status, 401);
  assert.equal(purchaseChecks, 0);
  const otherWallet = stranger.address.toLowerCase();
  const otherSignature = await stranger.signMessage({ message: signedMessage(`organizer-purchases:${purchaseEvent}`, otherWallet, timestamp) });
  assert.equal((await send({ eventId: purchaseEvent, candidates, wallet: otherWallet, timestamp, signature: otherSignature })).status, 403);
  assert.equal(purchaseChecks, 0);
  const otherEvent = "b".repeat(64);
  const otherEventSignature = await organizer.signMessage({ message: signedMessage(`organizer-purchases:${otherEvent}`, wallet, timestamp) });
  const refused = await send({ eventId: otherEvent, candidates, wallet, timestamp, signature: otherEventSignature });
  assert.equal(refused.status, 403);
  assert.equal((await refused.json()).error, "event_not_owned");
  assert.equal(purchaseChecks, 0);
  const res = await send({ eventId: purchaseEvent, candidates, wallet, timestamp, signature });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.deepEqual(body.tickets.map((item: { passId: string }) => item.passId), ["paid"]);
  assert.equal(purchaseChecks, 2);
});

test("organizer status says which wallets organize, and rejects anything else", async () => {
  const { port } = server.address() as { port: number };
  const status = async (wallet: string) => {
    const res = await fetch(`http://127.0.0.1:${port}/api/organizers/status?wallet=${wallet}`);
    return { code: res.status, body: await res.json() };
  };
  assert.deepEqual(await status(organizer.address), { code: 200, body: { organizer: true } });
  assert.deepEqual(await status(stranger.address), { code: 200, body: { organizer: false } });
  assert.equal((await status("nobody")).code, 400);
});
