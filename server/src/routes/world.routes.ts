import { Router } from "express";
import { env } from "../config/env.ts";
import { signWorldRequest } from "../services/world.service.ts";

export const worldRoutes = Router();

worldRoutes.get("/config", (_req, res) => {
  const { appId, rpId, action, environment, allowSkip } = env.world;
  res.json({ appId, rpId, action, environment, allowSkip });
});

worldRoutes.post("/world/sign", (_req, res) => {
  res.json(signWorldRequest(env.world));
});
