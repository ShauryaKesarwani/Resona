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
    ticketLifetimeDays: Number(process.env.ARKIV_TICKET_LIFETIME_DAYS ?? 30),
  },
  world: {
    appId: requireEnv("WORLD_APP_ID"),
    rpId: requireEnv("WORLD_RP_ID"),
    signingKey: requireEnv("RP_SIGNING_KEY"),
    action: requireEnv("WORLD_ACTION"),
    environment: requireEnv("WORLD_ENV"),
    allowSkip: process.env.ALLOW_WORLD_SKIP === "true",
  },
};

export type WorldEnv = typeof env.world;
