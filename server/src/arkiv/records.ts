import { addr, defineSchema, str } from "@arkiv-network/sdk/schema";

/** Small demo event record. eventHash is a stable hash, so related entities can refer to it. */
export const EventSchema = defineSchema("resona.event", {
  eventId: str().indexed(),
  eventName: str(),
  organiser: addr().indexed(),
  eventDate: str(),
});

/** One payment per transaction: transaction hash, event hash, user hash and creation time. */
export const PaymentSchema = defineSchema("resona.payment", {
  txnHash: str().indexed(),
  eventId: str().indexed(),
  userId: str().indexed(),
  createdAt: str().indexed(),
});
