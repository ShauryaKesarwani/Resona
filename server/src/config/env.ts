function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var ${name}`);
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 3000),
  dbPath: process.env.DB_PATH ?? "resona.db",
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
