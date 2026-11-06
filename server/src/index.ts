import type { Hex } from "viem";
import { createApp } from "./app.ts";
import { arkivAccounts, unconfiguredAccounts } from "./arkiv/accounts.ts";
import { env } from "./config/env.ts";
import { openStore } from "./db/store.ts";

const { privateKey, accessKey, maxCostWei } = env.arkiv;
const registry = privateKey && accessKey
  ? arkivAccounts({ privateKey: privateKey as Hex, accessKey, maxCostWei })
  : unconfiguredAccounts;
if (!registry.ready) console.warn("Arkiv keys are missing: World sign-up is unavailable.");

createApp(openStore(env.dbPath), registry).listen(env.port, () => {
  console.log(`Resona server on :${env.port} (World: ${env.world.environment})`);
});
