import { rabdi } from "@arkiv-network/sdk/chains";
import { Router } from "express";
import { env } from "../config/env.ts";

const READS = new Set([
  "arkiv_query", "eth_blockNumber", "eth_chainId", "eth_gasPrice", "eth_getBalance",
  "eth_getBlockByNumber", "eth_getTransactionByHash", "eth_getTransactionCount", "eth_getTransactionReceipt",
]);
const MAX_CALLS = 10;

/** Adds the access key to the browser's Arkiv reads, because the keyless endpoint runs out after a few pages. */
export function arkivRoutes() {
  const router = Router();
  const { accessKey } = env.arkiv;
  const url = accessKey ? rabdi({ accessKey }).rpcUrls.default.http[0] : undefined;

  router.post("/arkiv", async (req, res) => {
    if (!url) return void res.status(503).json({ error: "arkiv_not_configured" });
    const calls = Array.isArray(req.body) ? req.body : [req.body];
    if (!calls.length || calls.length > MAX_CALLS || !calls.every((call) => READS.has(call?.method))) {
      return void res.status(400).json({ error: "read_not_allowed" });
    }
    try {
      const upstream = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(req.body),
        redirect: "error",
        signal: AbortSignal.timeout(12_000),
      });
      res.status(upstream.status).type("application/json").send(await upstream.text());
    } catch {
      // The upstream error holds the keyed URL, so it never reaches the client.
      res.status(502).json({ error: "arkiv_unreachable" });
    }
  });

  return router;
}
