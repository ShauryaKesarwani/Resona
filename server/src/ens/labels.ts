/**
 * ENS labels are deliberately restricted to ASCII for this demo. ASCII case
 * folding is equivalent to ENSIP-15 normalization for the accepted alphabet.
 */
const ASCII_LABEL = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

export function normalizeEventName(value: string): string {
  const name = value.trim().toLowerCase();
  const labels = name.split(".");
  if (labels.length !== 2 || labels[1] !== "eth" || !ASCII_LABEL.test(labels[0]!)) {
    throw new Error("ENS_EVENT_NAME must be a single-label .eth name, such as demo-event.eth");
  }
  return name;
}

export function passLabel(value: string): string {
  const label = value.trim().toLowerCase();
  if (!ASCII_LABEL.test(label)) {
    throw new Error("Pass ID must be a single ENS label containing only letters, digits, or hyphens");
  }
  return label;
}

export function parsePassExpiry(value: string, now: bigint, parentExpiry: bigint): bigint {
  if (!/^\d+$/.test(value)) throw new Error("Expiry must be a Unix timestamp in seconds");
  const expiry = BigInt(value);
  if (expiry <= now || expiry > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("Expiry must be a future Unix timestamp");
  }
  if (expiry > parentExpiry) throw new Error("Pass expiry cannot exceed the event name expiry");
  return expiry;
}
