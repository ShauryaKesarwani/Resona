import { Router, type Response } from "express";
import { isAddress } from "viem";
import type { AccountRegistry } from "../arkiv/accounts.ts";
import { env } from "../config/env.ts";
import type { TicketStore } from "../arkiv/tickets.ts";
import { claim, type Outcome } from "../services/claim.service.ts";
import { isWalletOwner } from "../utils/signature.ts";

const send = (res: Response, outcome: Outcome) =>
  res.status(outcome.status).json("error" in outcome ? { error: outcome.error } : outcome.ticket);

export function ticketRoutes(tickets: TicketStore, registry: AccountRegistry) {
  const router = Router();

  // Minimal demo issuance directly to Arkiv.
  router.post("/issue", async (req, res) => {
    if (!tickets.ready) return void res.status(503).json({ error: "arkiv_not_configured" });
    const { holder, tier = "general" } = req.body ?? {};
    if (typeof holder !== "string") return void res.status(400).json({ error: "holder_required" });
    if (!isAddress(holder)) return void res.status(400).json({ error: "invalid_holder" });
    if (typeof tier !== "string" || !tier.trim()) return void res.status(400).json({ error: "invalid_tier" });
    res.json(await tickets.issue(holder, tier));
  });

  router.get("/tickets", async (req, res) => {
    if (!tickets.ready) return void res.status(503).json({ error: "arkiv_not_configured" });
    const holder = String(req.query.holder ?? "");
    if (!isAddress(holder)) return void res.status(400).json({ error: "invalid_holder" });
    res.json(await tickets.ticketsOf(holder));
  });

  router.post("/claim", async (req, res) => {
    if (!tickets.ready) return void res.status(503).json({ error: "arkiv_not_configured" });
    send(res, await claim(tickets, registry, env.world.allowSkip, req.body ?? {}));
  });

  // A new wallet holds nothing, so a signed-in human gets test tokens to pay for tickets and gas.
  router.post("/fund", async (req, res) => {
    if (!tickets.ready) return void res.status(503).json({ error: "arkiv_not_configured" });
    if (!(await isWalletOwner("fund", req.body ?? {}))) return void res.status(401).json({ error: "bad_signature" });
    const wallet = req.body.wallet.toLowerCase();
    if (!(await registry.findByWallet(wallet))) return void res.status(403).json({ error: "no_account" });
    await tickets.fund(wallet);
    res.json({ wallet });
  });

  return router;
}
