import { randomBytes, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import { distanceCm, verdictFor } from "../../../app/src/sonar/distance.ts";
import type { AccountRegistry } from "../arkiv/accounts.ts";
import type { CheckinStore, DoorTicket } from "../arkiv/tickets.ts";
import { isWalletOwner, type Signed } from "../utils/signature.ts";
import type { EnsService } from "../ens/service.ts";

export type CheckinState = "waiting" | "running" | "saving" | "pass" | "too_far" | "no_sound" | "invalid" | "expired" | "failed";
type Failure = { status: 400 | 401 | 402 | 403 | 404 | 409 | 410; error: string };
type Started = { status: 200; id: string; code: string; seed: string; attempt: number };
type Joined = { status: 200; id: string; seed: string; attempt: number; doorToken: string; holder: string; tier: string; ensName?: string };

type Session = {
  id: string; code: string; seed: string; ticket: DoorTicket; state: CheckinState; ensName?: string;
  createdAt: number; runningAt?: number; doorToken?: string;
  attempt: number; problem?: string;
  door?: number; holder?: number; cm?: number;
  ordinal?: number; transactionHash?: string; entityKey?: string;
};
export type Options = { store: CheckinStore; registry: Pick<AccountRegistry, "ready" | "findByWallet">; allowSkip: boolean; doorPin?: string; ens?: Pick<EnsService, "configured" | "pass">; now?: () => number };

const CODE_TTL_MS = 2 * 60 * 1000;
/** The phones record for 6 seconds and then analyse, so a run with no result by now has gone wrong. */
const RUN_TTL_MS = 15 * 1000;
const MAX_SESSIONS = 200;
const FINISHED: CheckinState[] = ["pass", "too_far", "no_sound", "invalid", "expired", "failed"];
/** A failed write is left alone: it may have landed, so it is never run again. */
const RETRYABLE: CheckinState[] = ["too_far", "no_sound", "invalid", "expired"];
const MAX_ATTEMPTS = 20;
const PROBLEMS = ["no-door-sound", "no-holder-sound", "overlap", "dropout"];

const sameSecret = (a: string, b: string) => {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};

/** Live check-ins, held in memory for a few minutes. Only a passed check-in is permanent, on Arkiv. */
class EligibilityError extends Error {}

export function createCheckins({ store, registry, allowSkip, doorPin, ens, now = Date.now }: Options) {
  const sessions = new Map<string, Session>();

  function refresh(session: Session) {
    const age = now() - (session.runningAt ?? session.createdAt);
    const limit = session.state === "waiting" ? CODE_TTL_MS : RUN_TTL_MS;
    if ((session.state === "waiting" || session.state === "running") && age > limit) session.state = "expired";
    return session;
  }

  /** Shared by session start and the serialized admission write; buyer status is not World evidence. */
  async function eligible(passId: string, wallet: string): Promise<{ ticket: DoorTicket; userId?: string; ensName?: string } | Failure> {
    const ticket = await store.doorTicket(passId, wallet);
    if (!ticket) return { status: 404, error: "ticket_not_found" };
    if (ticket.holder !== wallet) return { status: 403, error: "not_ticket_holder" };
    if (ticket.status === "checked_in") return { status: 409, error: "already_checked_in" };
    if (ticket.status === "revoked") return { status: 403, error: "ticket_revoked" };
    if (ticket.status === "issued") return { status: 409, error: "not_claimed" };
    if (ticket.status === "skipped" && !allowSkip) return { status: 403, error: "not_verified" };
    if (await store.eventEnded(ticket.eventId)) return { status: 410, error: "event_ended" };
    if (await store.hasCheckedIn(ticket.eventId, wallet)) return { status: 409, error: "already_checked_in" };
    if (!ticket.bought && await store.hasPendingTransfer(ticket.passId)) return { status: 409, error: "transfer_pending" };
    let ensName: string | undefined;
    if (ens?.configured) {
      try {
        const pass = await ens.pass(ticket.passId, wallet);
        if (!pass.active || !pass.linked || !pass.matchesHolder) return { status: 403, error: "ens_pass_not_verified" };
        ensName = pass.name;
      } catch {
        return { status: 403, error: "ens_verification_failed" };
      }
    }
    let userId: string | undefined;
    if (ticket.bought) {
      // Demo skip applies only to organizer-issued tickets, never to self-reported buyer status.
      const account = registry.ready ? await registry.findByWallet(wallet) : null;
      if (!account || account.wallet.toLowerCase() !== wallet || !account.userId) return { status: 403, error: "not_verified" };
      userId = account.userId;
      if (await store.hasClaimed(userId, ticket.eventId)) return { status: 409, error: "human_already_claimed" };
      if (!(await store.paymentIsValid(ticket))) return { status: 402, error: "payment_not_found" };
    }
    return { ticket, userId, ensName };
  }

  /** The holder's wallet proves it is here before any sound plays. */
  async function start(input: Partial<Signed> & { passId?: string }): Promise<Started | Failure> {
    const passId = String(input.passId ?? "");
    if (!(await isWalletOwner(`checkin:${passId}`, input))) return { status: 401, error: "bad_signature" };
    const wallet = input.wallet!.toLowerCase();
    const result = await eligible(passId, wallet);
    if ("error" in result) return result;
    const ticket = { ...result.ticket };

    for (const [id, old] of sessions) {
      if (old.ticket.passId === passId || FINISHED.includes(refresh(old).state)) sessions.delete(id);
    }
    if (sessions.size >= MAX_SESSIONS) sessions.delete(sessions.keys().next().value!);

    const taken = new Set([...sessions.values()].map((item) => item.code));
    let code: string;
    do code = String(randomInt(100_000, 1_000_000)); while (taken.has(code));
    const session: Session = { id: randomUUID(), code, seed: randomBytes(16).toString("hex"), ticket, ensName: result.ensName, state: "waiting", createdAt: now(), attempt: 1 };
    sessions.set(session.id, session);
    return { status: 200, id: session.id, code, seed: session.seed, attempt: session.attempt };
  }

  /** A fresh seed for every try, so a recording of the last one is useless. */
  function restart(session: Session) {
    session.attempt += 1;
    session.seed = randomBytes(16).toString("hex");
    session.state = "running";
    session.runningAt = now();
    delete session.door;
    delete session.holder;
    delete session.cm;
    delete session.problem;
  }

  /** The door joins with the holder's code. That is the moment both phones start recording. */
  function joinSession(session: Session | undefined): Joined | Failure {
    if (!session) return { status: 404, error: "code_not_found" };
    const state = refresh(session).state;
    if (state === "running" || state === "saving") return { status: 409, error: "check_running" };
    // Typing the same code after a failed try just starts the next try.
    if (RETRYABLE.includes(state) && session.runningAt && session.attempt < MAX_ATTEMPTS) restart(session);
    else if (state === "waiting") {
      session.state = "running";
      session.runningAt = now();
    } else return { status: 404, error: "code_not_found" };
    session.doorToken = randomBytes(16).toString("hex");
    return { status: 200, id: session.id, seed: session.seed, attempt: session.attempt, doorToken: session.doorToken, holder: session.ticket.holder, tier: session.ticket.tier, ensName: session.ensName };
  }

  function join(input: { code?: string; pin?: string }): Joined | Failure {
    if (doorPin && !sameSecret(String(input.pin ?? ""), doorPin)) return { status: 403, error: "bad_door_pin" };
    return joinSession([...sessions.values()].find((item) => item.code === String(input.code ?? "").trim()));
  }

  /** A public pass ID is not a secret, so joining by selection requires a configured door PIN. */
  function joinSelected(input: { passId?: string; pin?: string }): Joined | Failure {
    if (!doorPin) return { status: 403, error: "door_pin_not_configured" };
    if (!sameSecret(String(input.pin ?? ""), doorPin)) return { status: 403, error: "bad_door_pin" };
    if (typeof input.passId !== "string" || !input.passId) return { status: 400, error: "invalid_pass" };
    return joinSession([...sessions.values()].find((item) => item.ticket.passId === input.passId));
  }

  function status(id: string) {
    const session = sessions.get(id);
    if (!session) return null;
    const { state, cm, ordinal, transactionHash, entityKey, attempt, seed, problem } = refresh(session);
    return { state, cm, ordinal, transactionHash, entityKey, attempt, seed, problem };
  }

  async function finish(session: Session) {
    const cm = distanceCm(session.door!, session.holder!);
    session.cm = cm;
    const verdict = verdictFor(cm);
    if (verdict === "invalid") return void (session.state = "invalid");
    if (verdict === "far") return void (session.state = "too_far");
    session.state = "saving";
    try {
      Object.assign(session, await store.commitCheckin(session.ticket, cm, async () => {
        const result = await eligible(session.ticket.passId, session.ticket.holder);
        if ("error" in result) throw new EligibilityError(result.error);
        const current = result.ticket;
        if (current.passId !== session.ticket.passId || current.eventId !== session.ticket.eventId
          || current.entityKey !== session.ticket.entityKey || current.bought !== session.ticket.bought) {
          throw new EligibilityError("ticket_changed");
        }
        return result;
      }));
      session.state = "pass";
    } catch (error) {
      console.error("Check-in write failed:", error instanceof Error ? error.message.replace(/https?:\/\/\S+/g, "[url]").slice(0, 200) : "unknown");
      session.state = "failed";
      if (error instanceof EligibilityError) session.problem = error.message;
    }
  }

  /**
   * Each phone reports once. Only the door holds its token, and only the holder's wallet can sign,
   * so neither side can send the other's measurement.
   */
  async function report(
    id: string,
    input: Partial<Signed> & { role?: string; elapsedSeconds?: number | null; doorToken?: string; attempt?: number; problem?: string },
  ): Promise<{ status: 200 } | Failure> {
    const session = sessions.get(id);
    if (!session) return { status: 404, error: "session_not_found" };
    if (refresh(session).state !== "running") return { status: 409, error: "session_not_running" };
    if (input.attempt !== session.attempt) return { status: 409, error: "old_attempt" };
    const { role, elapsedSeconds } = input;
    const heard = typeof elapsedSeconds === "number" && Number.isFinite(elapsedSeconds);
    if (!heard && elapsedSeconds !== null) return { status: 400, error: "invalid_report" };

    if (role === "door") {
      if (!session.doorToken || !sameSecret(String(input.doorToken ?? ""), session.doorToken)) return { status: 403, error: "bad_door_token" };
    } else if (role === "holder") {
      const signedFor = input.wallet?.toLowerCase() === session.ticket.holder;
      if (!signedFor || !(await isWalletOwner(`checkin-report:${id}:${session.attempt}:${elapsedSeconds}`, input))) return { status: 401, error: "bad_signature" };
    } else {
      return { status: 400, error: "invalid_report" };
    }
    if (session[role] !== undefined) return { status: 409, error: "already_reported" };
    if (!heard) {
      session.state = "no_sound";
      if (PROBLEMS.includes(String(input.problem))) session.problem = `${role}:${input.problem}`;
      return { status: 200 };
    }
    session[role] = elapsedSeconds;
    if (session.door !== undefined && session.holder !== undefined) await finish(session);
    return { status: 200 };
  }

  /**
   * Starts another try without a new code. It gets a fresh seed, so a recording of the last try is
   * useless, and only the two phones in this check can ask for it.
   */
  async function retry(id: string, input: Partial<Signed> & { doorToken?: string }): Promise<{ status: 200 } | Failure> {
    const session = sessions.get(id);
    if (!session) return { status: 404, error: "session_not_found" };
    const isDoor = !!session.doorToken && sameSecret(String(input.doorToken ?? ""), session.doorToken);
    const isHolder = !isDoor && input.wallet?.toLowerCase() === session.ticket.holder
      && (await isWalletOwner(`checkin-retry:${id}:${session.attempt}`, input));
    if (!isDoor && !isHolder) return { status: 403, error: "not_in_this_check" };
    if (!RETRYABLE.includes(refresh(session).state) || !session.runningAt) return { status: 409, error: "cannot_retry" };
    if (session.attempt >= MAX_ATTEMPTS) return { status: 409, error: "too_many_attempts" };
    restart(session);
    return { status: 200 };
  }

  return { start, join, joinSelected, status, report, retry };
}
