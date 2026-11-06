import { addr, defineSchema, str } from "@arkiv-network/sdk/schema";

/** Small demo event record. eventId is the SHA-256 hash used by related entities. */
export const EventSchema = defineSchema("resona.event", {
  eventId: str().indexed(),
  eventName: str(),
  organiser: addr().indexed(),
  eventDate: str(),
});

/** One payment per transaction: transaction hash, event ID hash, user ID hash, and creation time. */
export const PaymentSchema = defineSchema("resona.payment", {
  txnHash: str().indexed(),
  eventId: str().indexed(),
  userId: str().indexed(),
  createdAt: str().indexed(),
});
