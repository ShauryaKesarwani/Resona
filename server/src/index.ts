import { createApp } from "./app.ts";
import { env } from "./config/env.ts";
import { openStore } from "./db/store.ts";

createApp(openStore(env.dbPath)).listen(env.port, () => {
  console.log(`Resona server on :${env.port} (World: ${env.world.environment})`);
});
