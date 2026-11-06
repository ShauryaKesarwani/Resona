import path from "node:path";
import express from "express";
import type { AccountRegistry } from "./arkiv/accounts.ts";
import type { TicketStore } from "./arkiv/tickets.ts";
import { arkivRoutes } from "./routes/arkiv.routes.ts";
import { authRoutes } from "./routes/auth.routes.ts";
import { labRoutes } from "./routes/lab.routes.ts";
import { ticketRoutes } from "./routes/tickets.routes.ts";
import { worldRoutes } from "./routes/world.routes.ts";

export function createApp(tickets: TicketStore, registry: AccountRegistry) {
  const app = express();
  app.use(express.json({ limit: "256kb" }));
  app.use("/api", worldRoutes);
  app.use("/api", labRoutes);
  app.use("/api", ticketRoutes(tickets, registry));
  app.use("/api", authRoutes(registry));
  app.use("/api", arkivRoutes());

  const dist = path.resolve(import.meta.dirname, "../../app/dist");
  app.use(express.static(dist));
  app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(dist, "index.html")));
  // RPC errors can contain access keys in URLs; never expose them to clients.
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("Request failed:", err instanceof Error ? err.name : "unknown error");
    res.status(500).json({ error: "internal_error" });
  });
  return app;
}
