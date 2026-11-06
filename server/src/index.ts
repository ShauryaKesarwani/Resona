import path from "node:path";
import express from "express";
import { signRequest } from "@worldcoin/idkit-core/signing";
import { openStore } from "./store.ts";
import { claim, portalVerifier, skip, type Outcome, type WorldConfig } from "./claim.ts";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var ${name}`);
  return value;
}

const appId = requireEnv("WORLD_APP_ID");
const signingKey = requireEnv("RP_SIGNING_KEY");
const config: WorldConfig = {
  rpId: requireEnv("WORLD_RP_ID"),
  action: requireEnv("WORLD_ACTION"),
  environment: requireEnv("WORLD_ENV"),
  allowSkip: process.env.ALLOW_WORLD_SKIP === "true",
};

const store = openStore(process.env.DB_PATH ?? "resona.db");
const app = express();
app.use(express.json({ limit: "256kb" }));

const send = (res: express.Response, outcome: Outcome) =>
  res.status(outcome.status).json("error" in outcome ? { error: outcome.error } : outcome.ticket);

app.get("/api/config", (_req, res) => {
  const { action, environment, allowSkip, rpId } = config;
  res.json({ appId, rpId, action, environment, allowSkip });
});

app.post("/api/world/sign", (_req, res) => {
  const { sig, nonce, createdAt, expiresAt } = signRequest({ signingKeyHex: signingKey, action: config.action });
  res.json({ rp_id: config.rpId, nonce, created_at: createdAt, expires_at: expiresAt, signature: sig });
});

// Stand-in until the real issue route writes to ENS and Arkiv.
app.post("/api/issue", (req, res) => {
  const { holder, tier = "general" } = req.body ?? {};
  if (typeof holder !== "string") return void res.status(400).json({ error: "holder_required" });
  res.json(store.issue(holder, tier));
});

app.get("/api/tickets", (req, res) => {
  res.json(store.ticketsOf(String(req.query.holder ?? "")));
});

app.post("/api/claim", async (req, res) => {
  send(res, await claim(store, config, portalVerifier, req.body));
});

app.post("/api/claim/skip", (req, res) => {
  send(res, skip(store, config, req.body));
});

const dist = path.resolve(import.meta.dirname, "../../app/dist");
app.use(express.static(dist));
app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(dist, "index.html")));

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => console.log(`Resona server on :${port} (World: ${config.environment})`));
