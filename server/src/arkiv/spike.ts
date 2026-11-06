// Disposable one-day Rabdi integration check for the production Arkiv schemas.
import { createHash, randomUUID } from "node:crypto";
import { createPublicClient, createWalletClient, ExpirationTime } from "@arkiv-network/sdk";
import { rabdi } from "@arkiv-network/sdk/chains";
import { eq } from "@arkiv-network/sdk/query";
import { addr } from "@arkiv-network/sdk/schema";
import { http, isHex, keccak256, stringToBytes, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { Accounts } from "./accounts.ts";
import { createArkivTickets } from "./tickets.ts";
import { EventSchema, PaymentSchema } from "./records.ts";

const digest = (value: string) => createHash("sha256").update(value).digest("hex");
let stage = "configuration";

async function main() {
  const key = process.env.ARKIV_PRIVATE_KEY;
  if (!key || !isHex(key) || key.length !== 66) {
    throw new Error("Set ARKIV_PRIVATE_KEY to a testnet-only 0x-prefixed 32-byte private key.");
  }
  const account = privateKeyToAccount(key as Hex);
  const chain = rabdi({ accessKey: process.env.ARKIV_ACCESS_KEY ?? "" });
  const reader = createPublicClient({ chain, transport: http() });
  const writer = createWalletClient({ chain, transport: http(), account });
  const expiration = ExpirationTime.fromDays(1);
  const suffix = randomUUID();
  const eventId = digest(`resona-spike-event:${suffix}`);
  const eventIdentifier = `resona-spike-event:${suffix}`;
  const nullifierHash = digest(`resona-spike-nullifier:${suffix}`);
  const userId = digest(nullifierHash);
  const operationId = randomUUID();
  const tickets = createArkivTickets(key as Hex, process.env.ARKIV_ACCESS_KEY ?? "", eventIdentifier, 1);
  console.log(`Arkiv schema check using organizer ${account.address}; event ${eventId}`);

  stage = "event create";
  const event = await writer.createEntity(EventSchema, {
    eventId,
    eventName: "Resona disposable schema check",
    organiser: addr(account.address),
    eventDate: new Date().toISOString(),
  }, { expiration, flags: { readonly: true } });
  const { entities: events } = await reader.select({ $key: true, eventName: true })
    .from(EventSchema, { onMismatch: "throw" }).ownedBy(account.address).where(eq("eventId", eventId)).fetch();
  if (events.length !== 1 || events[0].$key !== event.entityKey || events[0].eventName.value !== "Resona disposable schema check") {
    throw new Error("Event schema create/read failed.");
  }

  stage = "account create";
  const user = await writer.createEntity(Accounts, {
    wallet: addr(account.address), nullifierHash, userId,
  }, { expiration, flags: { readonly: true } });
  const { entities: users } = await reader.select({ $key: true, userId: true })
    .from(Accounts, { onMismatch: "throw" }).ownedBy(account.address).where(eq("wallet", addr(account.address))).fetch();
  if (!users.some((row) => row.$key === user.entityKey && row.userId?.value === userId)) {
    throw new Error("Account schema create/read failed.");
  }

  stage = "ticket issue and read";
  const ticket = await tickets.issue(account.address, "schema-check");
  if (ticket.eventId !== eventId) throw new Error("Ticket used an unexpected event ID hash.");
  let storedTicket;
  for (let attempt = 0; attempt < 8; attempt++) {
    storedTicket = await tickets.ticket(ticket.passId);
    if (storedTicket) break;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  if (!storedTicket || storedTicket.status !== "issued") throw new Error("Ticket schema create/read failed.");
  if (await tickets.hasClaimed(userId)) throw new Error("New user unexpectedly has a claim.");
  stage = "claim create and status patch";
  await tickets.commitClaim(ticket.passId, operationId, account.address, userId);
  if (!(await tickets.hasClaimed(userId)) || (await tickets.ticket(ticket.passId))?.status !== "claimed") {
    throw new Error("Claim schema create and ticket claim batch failed.");
  }
  stage = "duplicate-claim check";
  const secondTicket = await tickets.issue(account.address, "schema-check");
  let duplicateRejected = false;
  try {
    await tickets.commitClaim(secondTicket.passId, randomUUID(), account.address, userId);
  } catch (error) {
    duplicateRejected = error instanceof Error && error.message === "Human already claimed";
  }
  if (!duplicateRejected) throw new Error("A second ticket claim for the same user was not rejected.");
  const holderTickets = await tickets.ticketsOf(account.address);
  if (!holderTickets.some((row) => row.passId === secondTicket.passId && row.status === "issued")) {
    throw new Error("Ticket list query failed.");
  }

  stage = "payment create and read";
  const txnHash = keccak256(stringToBytes(`resona-spike-payment:${suffix}`));
  const createdAt = new Date().toISOString();
  const payment = await writer.createEntity(PaymentSchema, { txnHash, eventId, userId, createdAt }, { expiration, flags: { readonly: true } });
  const { entities: payments } = await reader.select({ $key: true, txnHash: true, eventId: true, userId: true, createdAt: true })
    .from(PaymentSchema, { onMismatch: "throw" }).ownedBy(account.address).where(eq("txnHash", txnHash)).fetch();
  if (payments.length !== 1 || payments[0].$key !== payment.entityKey || payments[0].eventId.value !== eventId || payments[0].userId.value !== userId) {
    throw new Error("Payment schema create/read failed.");
  }

  console.log("Account, event, ticket, claim, and payment schema checks passed. Entities expire after one day.");
}

main().catch((error: unknown) => {
  // RPC errors may contain access keys in URLs; never print the access key.
  const message = error instanceof Error ? error.message : "Unknown error";
  const accessKey = process.env.ARKIV_ACCESS_KEY;
  console.error(`Arkiv schema check failed at ${stage}:`, accessKey ? message.replaceAll(accessKey, "[redacted]") : message);
  process.exitCode = 1;
});
