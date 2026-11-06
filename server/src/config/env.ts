function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var ${name}`);
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 3000),
  nullifierHashKey: requireEnv("NULLIFIER_HASH_KEY"),
  arkiv: {
    privateKey: process.env.ARKIV_PRIVATE_KEY,
    accessKey: process.env.ARKIV_ACCESS_KEY,
    maxCostWei: BigInt(process.env.ARKIV_MAX_COST_WEI ?? "10000000000000000"),
    eventId: process.env.ARKIV_EVENT_ID ?? "demo-event",
  },
  world: {
    appId: requireEnv("WORLD_APP_ID"),
    rpId: requireEnv("WORLD_RP_ID"),
    signingKey: requireEnv("RP_SIGNING_KEY"),
    action: requireEnv("WORLD_ACTION"),
    environment: requireEnv("WORLD_ENV"),
    allowSkip: process.env.ALLOW_WORLD_SKIP === "true",
  },
  ens: {
    rpcUrl: process.env.ENS_RPC_URL,
    eventName: process.env.ENS_EVENT_NAME?.trim().toLowerCase(),
    parentRegistry: process.env.ENS_PARENT_REGISTRY,
    eventRegistry: process.env.ENS_EVENT_REGISTRY,
    enabled: process.env.ENS_ENABLED === "true",
  },
};

export type WorldEnv = typeof env.world;
