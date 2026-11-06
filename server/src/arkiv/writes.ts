import { appendFile } from "node:fs/promises";
import { createQueue } from "../utils/queue.ts";

/** Every write from the organizer key goes through this queue, so two writes never share a nonce. */
export const organizerWrites = createQueue();

/** A small record measured about 340k gas on Rabdi, so this covers the 2x margin and Arkiv's gas floor. */
export const gasFor = (operations: number) => 1_000_000n * BigInt(operations);

const JOURNAL = "arkiv-writes.log";

/** Keeps a durable trail of intents and hashes, so an uncertain write is checked and never sent again. */
export const journal = (line: string) =>
  appendFile(JOURNAL, `${new Date().toISOString()} ${line}\n`, { flush: true });
