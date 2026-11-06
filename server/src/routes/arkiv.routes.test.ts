import assert from "node:assert/strict";
import { test } from "node:test";

process.env.NULLIFIER_HASH_KEY ??= "test";
process.env.WORLD_APP_ID ??= "app_test";
process.env.WORLD_RP_ID ??= "rp_test";
process.env.RP_SIGNING_KEY ??= "0x1";
process.env.WORLD_ACTION ??= "test";
process.env.WORLD_ENV ??= "staging";
process.env.ARKIV_ACCESS_KEY = "secret-key";

const { arkivRoutes } = await import("./arkiv.routes.ts");
const express = (await import("express")).default;

async function post(body: unknown) {
  const app = express();
  app.use(express.json());
  app.use("/api", arkivRoutes());
  const server = app.listen(0);
  const { port } = server.address() as { port: number };
  const res = await fetch(`http://127.0.0.1:${port}/api/arkiv`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  server.close();
  return { status: res.status, text: await res.text() };
}

test("writes and unknown methods never reach Arkiv with our key", async () => {
  const realFetch = globalThis.fetch;
  let forwarded = 0;
  globalThis.fetch = ((url: string, init: RequestInit) => {
    if (String(url).includes("arkiv.network")) forwarded++;
    return realFetch(url, init);
  }) as typeof fetch;
  try {
    for (const method of ["eth_sendRawTransaction", "eth_sendTransaction", "debug_traceTransaction", undefined]) {
      assert.equal((await post({ jsonrpc: "2.0", id: 1, method })).status, 400);
    }
    const mixed = [{ method: "eth_chainId" }, { method: "eth_sendRawTransaction" }];
    assert.equal((await post(mixed)).status, 400);
    assert.equal(forwarded, 0);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("a failed upstream call doesn't reveal the access key", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = ((url: string, init: RequestInit) =>
    String(url).includes("arkiv.network") ? Promise.reject(new Error(`failed ${url}`)) : realFetch(url, init)) as typeof fetch;
  try {
    const { status, text } = await post({ jsonrpc: "2.0", id: 1, method: "eth_chainId" });
    assert.equal(status, 502);
    assert.ok(!text.includes("secret-key"));
  } finally {
    globalThis.fetch = realFetch;
  }
});
