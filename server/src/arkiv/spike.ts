// A disposable testnet lifecycle test, deliberately separate from the API's store.
import { randomUUID } from "node:crypto";
import { createPublicClient, createWalletClient, ExpirationTime } from "@arkiv-network/sdk";
import { rabdi } from "@arkiv-network/sdk/chains";
import { eq } from "@arkiv-network/sdk/query";
import { addr, defineSchema, str } from "@arkiv-network/sdk/schema";
import { http, isHex, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const Tickets = defineSchema("resona.spike.ticket", {
  passId: str().indexed(),
  holder: addr().indexed(),
  status: str().indexed(),
});
const Checkins = defineSchema("resona.spike.checkin", {
  passId: str().indexed(),
  holder: addr().indexed(),
});

async function main() {
  const key = process.env.ARKIV_PRIVATE_KEY;
  if (!key || !isHex(key) || key.length !== 66) {
    throw new Error("Set ARKIV_PRIVATE_KEY to a testnet-only 0x-prefixed 32-byte private key.");
  }
  const account = privateKeyToAccount(key as Hex);
  const chain = rabdi({ accessKey: process.env.ARKIV_ACCESS_KEY ?? "" });
  const publicClient = createPublicClient({ chain, transport: http() });
  const wallet = createWalletClient({ chain, transport: http(), account });
  const passId = randomUUID();
  const expiration = ExpirationTime.fromDays(1);
  console.log(`Organizer: ${account.address}; spike pass: ${passId}`);

  const ticket = await wallet.createEntity(Tickets, {
    passId, holder: addr(account.address), status: "issued",
  }, { expiration });
  console.log(`Ticket: ${ticket.entityKey}; transaction: ${ticket.txHash}`);

  async function readTicket(expectedStatus: string) {
    const { entities } = await publicClient.select({ $key: true, status: true })
      .from(Tickets).ownedBy(account.address).where(eq("passId", passId)).fetch();
    if (entities.length !== 1 || entities[0].$key !== ticket.entityKey || entities[0].status.value !== expectedStatus) {
      throw new Error(`Expected the organizer-owned ticket with status ${expectedStatus}; check indexing and retry with a new spike.`);
    }
    console.log(`Read organizer-owned ticket: ${expectedStatus}`);
  }

  await readTicket("issued");
  await wallet.patchEntity(Tickets, ticket.entityKey, { set: { status: "checked_in" } });
  await readTicket("checked_in");

  const checkin = await wallet.createEntity(Checkins, {
    passId, holder: addr(account.address),
  }, { expiration, flags: { readonly: true } });
  console.log(`Read-only check-in: ${checkin.entityKey}; transaction: ${checkin.txHash}`);
  const { entities } = await publicClient.select({ $key: true }).from(Checkins)
    .ownedBy(account.address).where(eq("passId", passId)).fetch();
  if (entities.length !== 1 || entities[0].$key !== checkin.entityKey) {
    throw new Error("Could not read the organizer-owned check-in; check indexing.");
  }
  console.log("Arkiv lifecycle spike passed.");
}

main().catch((error: unknown) => {
  // RPC errors may include an access key in the URL; do not print them verbatim.
  const message = error instanceof Error ? error.message : "Unknown error";
  const accessKey = process.env.ARKIV_ACCESS_KEY;
  console.error("Arkiv spike failed:", accessKey ? message.replaceAll(accessKey, "[redacted]") : message);
  process.exitCode = 1;
});
