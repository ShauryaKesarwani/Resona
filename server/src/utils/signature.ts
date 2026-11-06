import { isAddress, verifyMessage, type Hex } from "viem";

const MAX_AGE_MS = 5 * 60 * 1000;

export type Signed = { wallet: string; timestamp: number; signature: string };

/** The exact text a wallet signs. It must match app/src/services/auth.ts. */
export const signedMessage = (purpose: string, wallet: string, timestamp: number) =>
  `Resona ${purpose} ${wallet.toLowerCase()} ${timestamp}`;

/** Proves the caller holds this wallet's private key, with no server session to store. */
export async function isWalletOwner(purpose: string, input: Partial<Signed>, now = Date.now()) {
  const { wallet, timestamp, signature } = input;
  if (typeof wallet !== "string" || !isAddress(wallet, { strict: false })) return false;
  if (typeof timestamp !== "number" || Math.abs(now - timestamp) > MAX_AGE_MS) return false;
  if (typeof signature !== "string") return false;
  return verifyMessage({
    address: wallet as Hex,
    message: signedMessage(purpose, wallet, timestamp),
    signature: signature as Hex,
  }).catch(() => false);
}
