import path from "node:path";
import express from "express";
import type { AccountRegistry } from "./arkiv/accounts.ts";
import type { CheckinStore, TicketStore } from "./arkiv/tickets.ts";
import { arkivRoutes } from "./routes/arkiv.routes.ts";
import { authRoutes } from "./routes/auth.routes.ts";
import { checkinRoutes } from "./routes/checkin.routes.ts";
import { labRoutes } from "./routes/lab.routes.ts";
import { ticketRoutes } from "./routes/tickets.routes.ts";
import { worldRoutes } from "./routes/world.routes.ts";
import { createEnsService } from "./ens/service.ts";
import { env } from "./config/env.ts";

export function createApp(tickets: TicketStore & CheckinStore, registry: AccountRegistry) {
  const app = express();
  // Liveness only: this does not check external services.
  app.get("/api/health", (_req, res) => res.set("Cache-Control", "no-store").json({ status: "ok" }));
  app.use(express.json({ limit: "256kb" }));
  app.use("/api", worldRoutes);
  app.use("/api", labRoutes);
  app.use("/api", ticketRoutes(tickets, registry, createEnsService(env.ens)));
  app.use("/api", authRoutes(registry));
  app.use("/api", arkivRoutes());
  app.use("/api", checkinRoutes(tickets, registry));

  const dist = path.resolve(import.meta.dirname, "../../app/dist");
  // Built files have hashed names, but the page that points at them must never be cached, or phones keep an old build.
  const fresh = (res: express.Response) => res.set("Cache-Control", "no-store");
  app.use(express.static(dist, { setHeaders: (res, file) => void (file.endsWith(".html") && fresh(res)) }));
  app.get(/^\/(?!api\/).*/, (_req, res) => {
    fresh(res);
    res.sendFile(path.join(dist, "index.html"));
  });
  // RPC errors can contain access keys in URLs; never expose them to clients.
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("Request failed:", err instanceof Error ? err.name : "unknown error");
    res.status(500).json({ error: "internal_error" });
  });
  return app;
}
