import { randomUUID } from "node:crypto";
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

  router.get("/ens/resolve", async (req, res) => {
    const name = req.query.name;
    if (typeof name !== "string" || !name.trim()) return void res.status(400).json({ error: "invalid_ens_name" });
    try {
      res.json(await ens.resolveName(name));
    } catch (error) {
      const code = error instanceof Error ? error.message : "ens_lookup_unavailable";
      const status = code === "invalid_ens_name" ? 400 : code === "ens_name_not_found" ? 404 : code === "ens_address_not_set" ? 422 : 502;
      res.status(status).json({ error: code });
    }
  });

  router.post("/ens/pass/:passId/transfer-check", async (req, res) => {
    if (!ens.configured) return void res.status(503).json({ error: "ens_not_configured" });
    const ticket = await tickets.ticket(req.params.passId!);
    if (!ticket) return void res.status(404).json({ error: "ticket_not_found" });
    const recipient = req.body?.recipient;
    if (typeof recipient !== "string") return void res.status(400).json({ error: "invalid_recipient" });
    res.json(await ens.transferCheck(ticket.passId, ticket.holder, recipient));
  });

  router.post("/transfers/status", async (req, res) => {
    const { passId, ...signed } = req.body ?? {};
    if (typeof passId !== "string" || !passId) return void res.status(400).json({ error: "invalid_pass" });
    if (!(await isWalletOwner(`transfer-status:${passId}`, signed))) return void res.status(401).json({ error: "bad_signature" });
    const request = await tickets.transfer(passId);
    if (request && request.fromHolder !== signed.wallet.toLowerCase() && request.toHolder !== signed.wallet.toLowerCase())
      return void res.status(403).json({ error: "not_transfer_party" });
    res.json(request ?? null);
  });

  router.post("/transfers/request", async (req, res) => {
    if (!tickets.ready) return void res.status(503).json({ error: "arkiv_not_configured" });
    const { passId, recipient, ...signed } = req.body ?? {};
    if (typeof passId !== "string" || !passId || typeof recipient !== "string" || !isAddress(recipient))
      return void res.status(400).json({ error: "invalid_transfer" });
    if (!(await isWalletOwner(`transfer:${passId}:${recipient.toLowerCase()}`, signed))) return void res.status(401).json({ error: "bad_signature" });
    const ticket = await tickets.ticket(passId);
    if (!ticket || ticket.holder !== signed.wallet.toLowerCase()) return void res.status(403).json({ error: "not_ticket_holder" });
    if (ticket.status !== "claimed") return void res.status(409).json({ error: "ticket_not_transferable" });
    if (await tickets.hasCheckedIn(ticket.eventId, ticket.holder)) return void res.status(409).json({ error: "ticket_already_used" });
    if (await tickets.eventEnded(ticket.eventId)) return void res.status(409).json({ error: "event_ended" });
    if (recipient.toLowerCase() === ticket.holder) return void res.status(400).json({ error: "same_recipient" });
    if (!ens.configured) return void res.status(503).json({ error: "ens_not_configured" });
    if (!ens.writeConfigured) return void res.status(503).json({ error: "ens_write_not_configured" });
    try {
      const pass = await ens.pass(passId, ticket.holder);
      if (!pass.active || !pass.linked || !pass.matchesHolder) return void res.status(409).json({ error: "ens_pass_not_verified" });
      const requestedAt = new Date().toISOString();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const request = await tickets.requestTransfer(passId, ticket.holder, recipient, randomUUID(), requestedAt, expiresAt);
      return void res.status(201).json(request);
    } catch (error) {
      const code = error instanceof Error ? error.message : "transfer_request_failed";
      const status = ["ticket_not_transferable", "ticket_already_used", "transfer_already_pending", "event_ended"].includes(code) ? 409 : 502;
      return void res.status(status).json({ error: code });
    }
  });

  router.post("/transfers/cancel", async (req, res) => {
    const { passId, ...signed } = req.body ?? {};
    if (typeof passId !== "string" || !passId) return void res.status(400).json({ error: "invalid_pass" });
    if (!(await isWalletOwner(`transfer-cancel:${passId}`, signed))) return void res.status(401).json({ error: "bad_signature" });
    try {
      await tickets.cancelTransfer(passId, signed.wallet);
      res.json({ cancelled: true });
    } catch (error) {
      res.status(409).json({ error: error instanceof Error ? error.message : "transfer_cancel_failed" });
    }
  });

  router.post("/organizers/transfers", async (req, res) => {
    const { eventId, ...signed } = req.body ?? {};
    if (typeof eventId !== "string" || !eventId) return void res.status(400).json({ error: "event_required" });
    if (!(await isWalletOwner(`organizer:transfers:${eventId}`, signed))) return void res.status(401).json({ error: "bad_signature" });
    const access = await organizerLogin(signed.wallet);
    if (access) return void res.status(403).json({ error: access });
    if (!(await tickets.canManageEvent(eventId, signed.wallet))) return void res.status(403).json({ error: "event_not_owned" });
    res.json(await tickets.transfersForEvent(eventId));
  });

  router.post("/organizers/transfers/decision", async (req, res) => {
    if (!tickets.ready) return void res.status(503).json({ error: "arkiv_not_configured" });
    const { passId, requestId, decision, ...signed } = req.body ?? {};
    if (typeof passId !== "string" || typeof requestId !== "string" || !["approve", "decline"].includes(decision))
      return void res.status(400).json({ error: "invalid_transfer_decision" });
    if (!(await isWalletOwner(`organizer:transfer:${requestId}:${decision}`, signed))) return void res.status(401).json({ error: "bad_signature" });
    const access = await organizerLogin(signed.wallet);
    if (access) return void res.status(403).json({ error: access });
    const request = await tickets.transfer(passId);
    if (!request || request.requestId !== requestId) return void res.status(404).json({ error: "transfer_not_found" });
    if (!(await tickets.canManageEvent(request.eventId, signed.wallet))) return void res.status(403).json({ error: "event_not_owned" });
    if (decision === "approve" && (request.status !== "pending" || request.expiresAt <= new Date().toISOString()))
      return void res.status(409).json({ error: "transfer_not_pending" });
    if (decision === "approve") {
      const recipientAccount = await registry.findByWallet(request.toHolder);
      if (!recipientAccount?.userId) return void res.status(409).json({ error: "transfer_recipient_not_registered" });
      if (await tickets.hasClaimed(recipientAccount.userId, request.eventId))
        return void res.status(409).json({ error: "transfer_recipient_already_claimed" });
    }
    if (decision === "decline") {
      try { await tickets.declineTransfer(passId, requestId); return void res.json({ status: "declined" }); }
      catch (error) { return void res.status(409).json({ error: error instanceof Error ? error.message : "transfer_not_pending" }); }
    }
    if (!ens.configured) return void res.status(503).json({ error: "ens_not_configured" });
    if (!ens.writeConfigured) return void res.status(503).json({ error: "ens_write_not_configured" });
    let beginAttempted = false;
    try {
      beginAttempted = true;
      const processing = await tickets.beginTransfer(passId, requestId);
      const txs = await ens.reassignPass(passId, processing.fromHolder, processing.toHolder);
      await tickets.finishTransfer(passId, requestId, txs.unregisterTxHash, txs.registerTxHash);
      return void res.json({ status: "approved", ...txs });
    } catch (error) {
      if (beginAttempted) await tickets.reviewTransfer(passId, requestId).catch(() => {});
      console.error("Transfer needs review:", error instanceof Error ? error.message : "unknown error");
      return void res.status(502).json({ error: "transfer_needs_review" });
    }
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
