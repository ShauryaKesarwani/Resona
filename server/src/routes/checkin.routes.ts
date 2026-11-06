import { Router } from "express";
import type { AccountRegistry } from "../arkiv/accounts.ts";
import type { CheckinStore } from "../arkiv/tickets.ts";
import { env } from "../config/env.ts";
import { createCheckins } from "../services/checkin.service.ts";

/** Coordinates the two phones. It has to be here: a phone can't be trusted to judge its own distance. */
export function checkinRoutes(store: CheckinStore, registry: AccountRegistry) {
  const router = Router();
  const checkins = createCheckins({ store, registry, allowSkip: env.world.allowSkip, doorPin: env.doorPin });

  router.post("/checkin/start", async (req, res) => {
    const { status, ...body } = await checkins.start(req.body ?? {});
    res.status(status).json(body);
  });

  router.post("/checkin/join", (req, res) => {
    const { status, ...body } = checkins.join(req.body ?? {});
    res.status(status).json(body);
  });

  router.get("/checkin/:id", (req, res) => {
    const state = checkins.status(req.params.id);
    res.status(state ? 200 : 404).json(state ?? { error: "session_not_found" });
  });

  router.post("/checkin/:id/report", async (req, res) => {
    const { status, ...body } = await checkins.report(req.params.id, req.body ?? {});
    res.status(status).json(body);
  });

  router.post("/checkin/:id/retry", async (req, res) => {
    const { status, ...body } = await checkins.retry(req.params.id, req.body ?? {});
    res.status(status).json(body);
  });

  return router;
}
