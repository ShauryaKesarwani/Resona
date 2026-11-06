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
process.env.ORGANIZER_WALLETS = ` ${organizer.address.toUpperCase().replace("0X", "0x")} `;

const { ticketRoutes } = await import("./tickets.routes.ts");
const { env } = await import("../config/env.ts");
const { signedMessage } = await import("../utils/signature.ts");
const express = (await import("express")).default;

const issued: string[] = [];
const tickets = { ready: true, issue: async (to: string) => { issued.push(to); return { holder: to }; } };
const app = express();
app.use(express.json());
app.use("/api", ticketRoutes(tickets as never, {} as never));
const server = app.listen(0);
after(() => server.close());

const post = (body: unknown) => {
  const { port } = server.address() as { port: number };
  return fetch(`http://127.0.0.1:${port}/api/issue`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
};

async function signed(account: typeof organizer, to = holder, tier = "general") {
  const wallet = account.address.toLowerCase();
  const timestamp = Date.now();
  const signature = await account.signMessage({ message: signedMessage(`issue:${to.toLowerCase()}:${tier}`, wallet, timestamp) });
  return { wallet, timestamp, signature };
}

async function rejected(body: unknown, status: number, error: string) {
  const before = issued.length;
  const res = await post(body);
  assert.equal(res.status, status);
  assert.equal((await res.json()).error, error);
  assert.equal(issued.length, before, "a rejected request must not write a ticket");
}

test("an unsigned request cannot issue", () => rejected({ holder, tier: "general" }, 401, "bad_signature"));

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
