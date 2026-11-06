# Arkiv demo storage

Arkiv is the only persistent store. Accounts, tickets, and claims are Arkiv entities; the server has no SQL database. The API loads `.env` and `.env.arkiv` on start.

## Configuration

1. Run `npm run arkiv:setup` to create a testnet-only signer in `.env.arkiv`.
2. Fund its address with tGLM and add an Arkiv access key to `.env.arkiv`.
3. Set the World ID fields and a stable `NULLIFIER_HASH_KEY` in `.env`.
4. Set `ARKIV_EVENT_ID` to a stable identifier. The server hashes the event identifier before storing it.
5. Run `npm start`.

The stored account keeps the wallet, keyed nullifier hash, and a stable user ID hash derived from that nullifier hash. Wallet and nullifier lookups keep the one-human/one-wallet check. Claims refer to the hashed user ID and event ID, so repeat claims can be found without storing a raw World ID nullifier. The event ID written to tickets and claims is SHA-256 of `ARKIV_EVENT_ID`.

The event and payment schemas are in `src/arkiv/records.ts`:

- Event: `eventId` (hash), `eventName`, `organiser`, `eventDate`, `priceWei`. Create one with `npm run arkiv:event -- <slug> <name> <YYYY-MM-DD> <price in tGLM>`.
- Payment: `txnHash`, `eventId` (hash), `userId` (hash), `passId`, `amountWei`, `createdAt`. The buyer's wallet writes it from the browser.

Relationships are simple indexed hash fields that match across entities.

`npm run arkiv:spike` writes test records using the production account, event, ticket, claim, and payment schemas, then reads them back to check their fields, ticket listing, claim batch, and duplicate-claim rejection. Its payment transaction hash is a test value, not a real purchase.

Old SQLite demo tickets are not migrated; create fresh tickets through the Arkiv API. Tickets, claims and payments use the longest lifetime Arkiv allows, about six months. Arkiv does not provide uniqueness constraints, so claims are serialized within this single server process; run one instance for the demo.
