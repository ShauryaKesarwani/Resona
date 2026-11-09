import { addr, defineSchema, str } from "@arkiv-network/sdk/schema";

/** An event people can buy tickets for. eventId is the SHA-256 hash used by related entities. */
export const EventSchema = defineSchema("resona.event", {
  eventId: str().indexed(),
  eventName: str(),
  organiser: addr().indexed(),
  eventDate: str(),
  priceWei: str(),
});

/** One admission through the door. It can't be edited, and a repeat is refused for the same holder and event. */
export const CheckinSchema = defineSchema("resona.checkin", {
  eventId: str().indexed(),
  passId: str().indexed(),
  holder: addr().indexed(),
  ordinal: str(),
  distanceCm: str(),
  checkedInAt: str(),
  verificationLevel: str().optional(),
});

/** One payment per transaction, with hashed event and user IDs. Reading by userId gives a person's purchase history. */
export const PaymentSchema = defineSchema("resona.payment", {
  txnHash: str().indexed(),
  eventId: str().indexed(),
  userId: str().indexed(),
  passId: str().indexed(),
  amountWei: str(),
  createdAt: str().indexed(),
});
