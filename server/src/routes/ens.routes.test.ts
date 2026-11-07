import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { test } from "node:test";
import { encodeErrorResult, encodeFunctionResult, decodeFunctionData, parseAbi, toFunctionSelector, type Hex } from "viem";

const holder = "0x0000000000000000000000000000000000000001" as const;
const parentRegistry = "0x0000000000000000000000000000000000000011" as const;
const eventRegistry = "0x0000000000000000000000000000000000000022" as const;
const testAbi = parseAbi([
  "function getSubregistry(uint256 anyId) view returns (address)",
  "function getOwner(uint256 anyId) view returns (address)",
  "function getTokenId(uint256 anyId) view returns (uint256)",
  "function getExpiry(uint256 anyId) view returns (uint64)",
  "function safeTransferFrom(address from, address to, uint256 tokenId, uint256 amount, bytes data)",
  "error TransferDisallowed(uint256 tokenId, address owner)",
]);

function result(abi: typeof testAbi, functionName: "getSubregistry" | "getOwner" | "getTokenId" | "getExpiry", value: unknown) {
  return encodeFunctionResult({ abi, functionName, result: value } as never);
}

async function rpcServer() {
  const server: Server = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const rpc = JSON.parse(Buffer.concat(chunks).toString()) as { id: number; method: string; params: [{ data: Hex }] };
    const data = rpc.params?.[0]?.data;
    const selector = data?.slice(0, 10);
    const fn = testAbi.find((item) => item.type === "function" && toFunctionSelector(item) === selector);
    if (!fn) {
      res.writeHead(400).end("unknown call");
      return;
    }
    const call = decodeFunctionData({ abi: testAbi, data });
    let encoded: Hex;
    if (call.functionName === "getSubregistry") encoded = result(testAbi, call.functionName, eventRegistry);
    else if (call.functionName === "getOwner") encoded = result(testAbi, call.functionName, holder);
    else if (call.functionName === "getTokenId") encoded = result(testAbi, call.functionName, 7n);
    else if (call.functionName === "getExpiry") encoded = result(testAbi, call.functionName, BigInt(Math.floor(Date.now() / 1000) + 3600));
    else {
      res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({
        jsonrpc: "2.0", id: rpc.id,
        error: { code: 3, message: "execution reverted", data: encodeErrorResult({ abi: testAbi, errorName: "TransferDisallowed", args: [7n, holder] }) },
      }));
      return;
    }
    res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ jsonrpc: "2.0", id: rpc.id, result: encoded }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  return { server, url: `http://127.0.0.1:${address.port}` };
}

test("ENS pass ownership and transfer policy flow through the API against a Sepolia RPC fixture", async () => {
  process.env.NULLIFIER_HASH_KEY ??= "test";
  process.env.WORLD_APP_ID ??= "app_test";
  process.env.WORLD_RP_ID ??= "rp_test";
  process.env.RP_SIGNING_KEY ??= "0x1";
  process.env.WORLD_ACTION ??= "test";
  process.env.WORLD_ENV ??= "staging";

  const rpc = await rpcServer();
  const express = (await import("express")).default;
  const { createEnsService } = await import("../ens/service.ts");
  const { ticketRoutes } = await import("./tickets.routes.ts");
  const tickets = {
    ready: true,
    ticket: async (passId: string) => passId === "a1b2" ? { passId, holder, tier: "general", eventId: "demo", status: "claimed", entityKey: "0x" } : undefined,
  } as never;
  const registry = {} as never;
  const ens = createEnsService({ enabled: true, rpcUrl: rpc.url, eventName: "demo-event.eth", parentRegistry, eventRegistry });
  const app = express();
  app.use(express.json());
  app.use("/api", ticketRoutes(tickets, registry, ens));
  const httpServer = app.listen(0);
  const port = (httpServer.address() as { port: number }).port;

  try {
    const passRes = await fetch(`http://127.0.0.1:${port}/api/ens/pass/a1b2`);
    assert.equal(passRes.status, 200);
    const pass = await passRes.json() as { name: string; owner: string; matchesHolder: boolean; linked: boolean; active: boolean };
    assert.equal(pass.name, "a1b2.demo-event.eth");
    assert.equal(pass.owner.toLowerCase(), holder);
    assert.equal(pass.matchesHolder && pass.linked && pass.active, true);

    const transferRes = await fetch(`http://127.0.0.1:${port}/api/ens/pass/a1b2/transfer-check`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ recipient: "0x0000000000000000000000000000000000000002" }),
    });
    assert.equal(transferRes.status, 200);
    const transfer = await transferRes.json() as { result: string; tokenId: string; error: string };
    assert.deepEqual(transfer, { result: "blocked", pass, tokenId: "7", error: "TransferDisallowed" });

    const missing = await fetch(`http://127.0.0.1:${port}/api/ens/pass/missing`);
    assert.equal(missing.status, 404);
  } finally {
    httpServer.close();
    await new Promise<void>((resolve) => rpc.server.close(() => resolve()));
  }
});

test("ENS name lookup normalizes input and reads the address record through ENSNode", async () => {
  let received: { query: string; variables: { name: string; coinType: string | number } } | undefined;
  const node: Server = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    received = JSON.parse(Buffer.concat(chunks).toString());
    const exists = received.variables.name !== "missing.resona-id.eth";
    res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({
      data: { domain: exists ? {
        canonical: { name: { interpreted: received.variables.name } },
        resolve: { records: { addresses: [{ address: holder }] } },
      } : null },
    }));
  });
  await new Promise<void>((resolve) => node.listen(0, "127.0.0.1", resolve));
  const address = node.address();
  assert.ok(address && typeof address !== "string");
  const { createEnsService } = await import("../ens/service.ts");
  const ens = createEnsService({ enabled: false, ensNodeUrl: `http://127.0.0.1:${address.port}` });

  try {
    assert.deepEqual(await ens.resolveName("Sam.Resona-id.eth"), { name: "sam.resona-id.eth", address: holder });
    assert.equal(received?.variables.name, "sam.resona-id.eth");
    assert.equal(String(received?.variables.coinType), "2155277743");
    assert.match(received?.query ?? "", /addresses\(coinTypes:\s*\[\$coinType\]\)/);
    await assert.rejects(ens.resolveName("missing.resona-id.eth"), { message: "ens_name_not_found" });
  } finally {
    await new Promise<void>((resolve) => node.close(() => resolve()));
  }
});
