import type { Hex } from "viem";
import { createApp } from "./app.ts";
import { arkivAccounts, unconfiguredAccounts } from "./arkiv/accounts.ts";
import { createArkivTickets, unconfiguredTickets } from "./arkiv/tickets.ts";
import { env } from "./config/env.ts";

const { privateKey, accessKey, maxCostWei } = env.arkiv;
const registry = privateKey && accessKey
  ? arkivAccounts({ privateKey: privateKey as Hex, accessKey, maxCostWei })
  : unconfiguredAccounts;
if (!registry.ready) console.warn("Arkiv keys are missing: World sign-up is unavailable.");
const tickets = privateKey && accessKey
  ? createArkivTickets(privateKey as Hex, accessKey, env.arkiv.eventId)
  : unconfiguredTickets;
if (!tickets.ready) console.warn("Arkiv keys are missing: ticket operations are unavailable.");

createApp(tickets, registry).listen(env.port, () => {
  console.log(`Resona server on :${env.port} (World: ${env.world.environment})`);
});
