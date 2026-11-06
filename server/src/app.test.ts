import assert from "node:assert/strict";
import { test } from "node:test";

process.env.NULLIFIER_HASH_KEY ??= "test";
process.env.WORLD_APP_ID ??= "app_test";
process.env.WORLD_RP_ID ??= "rp_test";
process.env.RP_SIGNING_KEY ??= "0x1";
process.env.WORLD_ACTION ??= "test";
process.env.WORLD_ENV ??= "staging";

const { createApp } = await import("./app.ts");
const { unconfiguredTickets } = await import("./arkiv/tickets.ts");
const { unconfiguredAccounts } = await import("./arkiv/accounts.ts");

test("health endpoint reports server liveness even when Arkiv is not configured", async () => {
  const server = createApp(unconfiguredTickets, unconfiguredAccounts).listen(0);
  try {
    const { port } = server.address() as { port: number };
    const response = await fetch(`http://127.0.0.1:${port}/api/health`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual(await response.json(), { status: "ok" });
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
