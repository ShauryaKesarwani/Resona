import { Router, type Response } from "express";
import type { AccountRegistry } from "../arkiv/accounts.ts";
import { env } from "../config/env.ts";
import type { Store } from "../db/store.ts";
import { claim, type Outcome } from "../services/claim.service.ts";

const send = (res: Response, outcome: Outcome) =>
  res.status(outcome.status).json("error" in outcome ? { error: outcome.error } : outcome.ticket);

export function ticketRoutes(store: Store, registry: AccountRegistry) {
  const router = Router();

  // Stand-in until the real issue route writes to ENS and Arkiv.
  router.post("/issue", (req, res) => {
    const { holder, tier = "general" } = req.body ?? {};
    if (typeof holder !== "string") return void res.status(400).json({ error: "holder_required" });
    res.json(store.issue(holder, tier));
  });

  router.get("/tickets", (req, res) => {
    res.json(store.ticketsOf(String(req.query.holder ?? "")));
  });

  router.post("/claim", async (req, res) => {
    send(res, await claim(store, registry, env.world.allowSkip, req.body ?? {}));
  });

  return router;
}
