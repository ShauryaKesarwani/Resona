import { Router } from "express";
import type { Hex } from "viem";
import { privateKeyToAddress } from "viem/accounts";
import { env } from "../config/env.ts";
import { signWorldRequest } from "../services/world.service.ts";

export const worldRoutes = Router();

worldRoutes.get("/config", (_req, res) => {
  const { appId, rpId, action, environment, allowSkip } = env.world;
  // The browser reads Arkiv directly, and only trusts records from this public address.
  const organizer = env.arkiv.privateKey ? privateKeyToAddress(env.arkiv.privateKey as Hex) : undefined;
  res.json({ appId, rpId, action, environment, allowSkip, organizer, doorPinRequired: !!env.doorPin,
    ensEventName: env.ens.enabled ? env.ens.eventName : undefined });
});

worldRoutes.post("/world/sign", (req, res) => {
  res.json(signWorldRequest(env.world, req.body?.session === true));
});
