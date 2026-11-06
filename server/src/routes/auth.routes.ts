import { Router } from "express";
import type { AccountRegistry } from "../arkiv/accounts.ts";
import { env } from "../config/env.ts";
import { login, signup, type AuthOutcome } from "../services/auth.service.ts";
import { portalVerifier } from "../services/world.service.ts";

const body = (outcome: AuthOutcome) => ("error" in outcome ? { error: outcome.error } : { wallet: outcome.wallet });

export function authRoutes(registry: AccountRegistry) {
  const router = Router();
  const config = { ...env.world, nullifierHashKey: env.nullifierHashKey };

  router.post("/auth/signup", async (req, res) => {
    const outcome = await signup(registry, config, portalVerifier, req.body ?? {});
    res.status(outcome.status).json(body(outcome));
  });

  router.post("/auth/login", async (req, res) => {
    const outcome = await login(registry, config, portalVerifier, req.body ?? {});
    res.status(outcome.status).json(body(outcome));
  });

  return router;
}
