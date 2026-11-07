import { Router, type Response } from "express";
import { isAddress, parseEther } from "viem";
import type { AccountRegistry } from "../arkiv/accounts.ts";
import { env } from "../config/env.ts";
import type { CheckinStore, TicketStore } from "../arkiv/tickets.ts";
import { claim, type Outcome } from "../services/claim.service.ts";
import { isWalletOwner } from "../utils/signature.ts";
import type { EnsService } from "../ens/service.ts";

const send = (res: Response, outcome: Outcome) =>
  res.status(outcome.status).json("error" in outcome ? { error: outcome.error } : outcome.ticket);

export function ticketRoutes(tickets: TicketStore & CheckinStore, registry: AccountRegistry, ens: EnsService) {
  const router = Router();
  const organizerLogin = async (wallet: string) => {
    const account = await registry.findByWallet(wallet.toLowerCase());
    const listed = env.organizerWallets.includes(wallet.toLowerCase())
      || (!!account && await registry.isOrganizer(account.userId));
    if (!listed) return "not_organizer";
    return account?.sessionHash ? undefined : "organizer_login_required";
  };

  router.post("/organizers/promote", async (req, res) => {
    if (!tickets.ready) return void res.status(503).json({ error: "arkiv_not_configured" });
    const { targetWallet, ...signed } = req.body ?? {};
    if (typeof targetWallet !== "string" || !isAddress(targetWallet)) return void res.status(400).json({ error: "invalid_wallet" });
    if (!(await isWalletOwner(`organizer:promote:${targetWallet.toLowerCase()}`, signed))) return void res.status(401).json({ error: "bad_signature" });
    const access = await organizerLogin(signed.wallet);
    if (access) return void res.status(403).json({ error: access });
    const target = await registry.findByWallet(targetWallet.toLowerCase());
    if (!target?.sessionHash) return void res.status(404).json({ error: "world_account_not_found" });
    try {
      await registry.promoteOrganizer(target, signed.wallet.toLowerCase());
    } catch (error) {
      console.error("Organizer promotion failed:", error instanceof Error ? error.message : "unknown error");
      return void res.status(502).json({ error: "arkiv_write_failed" });
    }
    res.json({ wallet: target.wallet, promoted: true });
  });

  // Each ticket costs the organizer key a write, so only a listed wallet may issue. With none listed, nobody can.
  router.post("/issue", async (req, res) => {
    if (!tickets.ready) return void res.status(503).json({ error: "arkiv_not_configured" });
    const { holder, tier = "general", eventId, ...signed } = req.body ?? {};
    if (typeof holder !== "string") return void res.status(400).json({ error: "holder_required" });
    if (!isAddress(holder)) return void res.status(400).json({ error: "invalid_holder" });
    if (typeof tier !== "string" || !tier.trim()) return void res.status(400).json({ error: "invalid_tier" });
    if (typeof eventId !== "string" || !eventId) return void res.status(400).json({ error: "event_required" });
    if (!(await isWalletOwner(`issue:${eventId}:${holder.toLowerCase()}:${tier}`, signed))) return void res.status(401).json({ error: "bad_signature" });
    const access = await organizerLogin(signed.wallet);
    if (access) return void res.status(403).json({ error: access });
    if (!(await tickets.canManageEvent(eventId, signed.wallet))) return void res.status(403).json({ error: "event_not_owned" });
    res.json(await tickets.issue(holder, tier, eventId));
  });

  // Like /issue, only a listed organizer wallet may publish an event.
  router.post("/event", async (req, res) => {
    if (!tickets.ready) return void res.status(503).json({ error: "arkiv_not_configured" });
    const { eventName, eventDate, price, ...signed } = req.body ?? {};
    const name = typeof eventName === "string" ? eventName.trim() : "";
    if (name.length < 3 || name.length > 60) return void res.status(400).json({ error: "invalid_event_name" });
    if (typeof eventDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(eventDate) || eventDate < new Date().toISOString().slice(0, 10))
      return void res.status(400).json({ error: "invalid_event_date" });
    if (!(await isWalletOwner(`event:${name.toLowerCase()}:${eventDate}`, signed))) return void res.status(401).json({ error: "bad_signature" });
    const access = await organizerLogin(signed.wallet);
    if (access) return void res.status(403).json({ error: access });
    const tokens = Number(price);
    if (!Number.isFinite(tokens) || tokens < 0 || tokens > 100) return void res.status(400).json({ error: "invalid_price" });
    const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${Date.now().toString(36)}`;
    const created = await tickets.createEvent({ slug, eventName: name, eventDate, priceWei: parseEther(String(tokens)), organizer: signed.wallet });
    res.json({ eventId: created.eventId, transactionHash: created.transactionHash });
  });

  router.get("/tickets", async (req, res) => {
    if (!tickets.ready) return void res.status(503).json({ error: "arkiv_not_configured" });
    const holder = String(req.query.holder ?? "");
    if (!isAddress(holder)) return void res.status(400).json({ error: "invalid_holder" });
    res.json(await tickets.ticketsOf(holder));
  });

  // Buyer-written records are not proof of payment. Reuse the door's payment checks.
  router.post("/organizer/verify-purchases", async (req, res) => {
    if (!tickets.ready) return void res.status(503).json({ error: "arkiv_not_configured" });
    const { eventId, candidates, ...signed } = req.body ?? {};
    if (typeof eventId !== "string" || !/^[a-f0-9]{64}$/.test(eventId) || !Array.isArray(candidates) || candidates.length > 50 ||
        !candidates.every((c: any) => c && typeof c.passId === "string" && c.passId.length > 0 && c.passId.length <= 128 && typeof c.holder === "string" && isAddress(c.holder))) {
      return void res.status(400).json({ error: "invalid_request" });
    }
    if (!(await isWalletOwner(`organizer-purchases:${eventId}`, signed))) return void res.status(401).json({ error: "bad_signature" });
    const access = await organizerLogin(signed.wallet);
    if (access) return void res.status(403).json({ error: access });
    if (!(await tickets.canManageEvent(eventId, signed.wallet))) return void res.status(403).json({ error: "event_not_owned" });
    const result = [];
    const seen = new Set<string>();
    for (const candidate of candidates) {
      const identity = `${candidate.passId}:${candidate.holder.toLowerCase()}`;
      if (seen.has(identity)) continue;
      seen.add(identity);
      const ticket = await tickets.doorTicket(candidate.passId, candidate.holder);
      if (!ticket || !ticket.bought || ticket.eventId !== eventId || ticket.holder !== candidate.holder.toLowerCase()) continue;
      if (await tickets.paymentIsValid(ticket)) result.push({ passId: ticket.passId, holder: ticket.holder, tier: ticket.tier, status: ticket.status });
    }
    res.set("Cache-Control", "no-store").json({ tickets: result });
  });

  router.get("/ens/pass/:passId", async (req, res) => {
    if (!ens.configured) return void res.status(503).json({ error: "ens_not_configured" });
    const ticket = await tickets.ticket(req.params.passId!);
    if (!ticket) return void res.status(404).json({ error: "ticket_not_found" });
    res.json(await ens.pass(ticket.passId, ticket.holder));
  });

  router.post("/ens/pass/:passId/transfer-check", async (req, res) => {
    if (!ens.configured) return void res.status(503).json({ error: "ens_not_configured" });
    const ticket = await tickets.ticket(req.params.passId!);
    if (!ticket) return void res.status(404).json({ error: "ticket_not_found" });
    const recipient = req.body?.recipient;
    if (typeof recipient !== "string") return void res.status(400).json({ error: "invalid_recipient" });
    res.json(await ens.transferCheck(ticket.passId, ticket.holder, recipient));
  });

  router.post("/claim", async (req, res) => {
    if (!tickets.ready) return void res.status(503).json({ error: "arkiv_not_configured" });
    send(res, await claim(tickets, registry, env.world.allowSkip, req.body ?? {}));
  });

  // A new wallet holds nothing, so a signed-in human gets test tokens to pay for tickets and gas.
  router.post("/fund", async (req, res) => {
    if (!tickets.ready) return void res.status(503).json({ error: "arkiv_not_configured" });
    if (!(await isWalletOwner("fund", req.body ?? {}))) return void res.status(401).json({ error: "bad_signature" });
    const wallet = req.body.wallet.toLowerCase();
    if (!(await registry.findByWallet(wallet))) return void res.status(403).json({ error: "no_account" });
    await tickets.fund(wallet);
    res.json({ wallet });
  });

  return router;
}
