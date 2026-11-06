import path from "node:path";
import express from "express";
import type { Store } from "./db/store.ts";
import { labRoutes } from "./routes/lab.routes.ts";
import { ticketRoutes } from "./routes/tickets.routes.ts";
import { worldRoutes } from "./routes/world.routes.ts";

export function createApp(store: Store) {
  const app = express();
  app.use(express.json({ limit: "256kb" }));
  app.use("/api", worldRoutes);
  app.use("/api", labRoutes);
  app.use("/api", ticketRoutes(store));

  const dist = path.resolve(import.meta.dirname, "../../app/dist");
  app.use(express.static(dist));
  app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(dist, "index.html")));
  return app;
}
