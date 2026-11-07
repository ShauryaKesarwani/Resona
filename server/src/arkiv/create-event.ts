import { parseEther, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { createArkivTickets } from "./tickets.ts";

// Usage: npm run arkiv:event -- <slug> <name> <YYYY-MM-DD> <price in tGLM>
const [slug, eventName, eventDate, price] = process.argv.slice(2);
if (!slug || !eventName || !/^\d{4}-\d{2}-\d{2}$/.test(eventDate ?? "") || !price) {
  throw new Error("Usage: npm run arkiv:event -- <slug> <name> <YYYY-MM-DD> <price in tGLM>");
}
const { ARKIV_PRIVATE_KEY: privateKey, ARKIV_ACCESS_KEY: accessKey } = process.env;
if (!privateKey || !accessKey) throw new Error("ARKIV_PRIVATE_KEY and ARKIV_ACCESS_KEY are required");

const tickets = createArkivTickets(privateKey as Hex, accessKey, slug);
console.log(await tickets.createEvent({ slug, eventName, eventDate, priceWei: parseEther(price), organizer: privateKeyToAccount(privateKey as Hex).address }));
