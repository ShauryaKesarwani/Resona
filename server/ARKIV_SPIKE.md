# Arkiv demo storage

Arkiv is the only persistent store. Accounts, tickets, and claims are Arkiv entities; the server has no SQL database. The API loads `.env` and `.env.arkiv` on start.

## Configuration

1. Run `npm run arkiv:setup` to create a testnet-only signer in `.env.arkiv`.
2. Fund its address with tGLM and add an Arkiv access key to `.env.arkiv`.
3. Set the World ID fields and a stable `NULLIFIER_HASH_KEY` in `.env`.
4. Set `ARKIV_EVENT_ID` to a stable identifier and `ARKIV_TICKET_LIFETIME_DAYS` to 1 to 180 days. The server hashes the event identifier before storing it.
5. Run `npm start`.

The stored account keeps the wallet, keyed nullifier hash, and a stable user ID hash derived from that nullifier hash. Wallet and nullifier lookups keep the one-human/one-wallet check. Claims refer to the hashed user ID and event ID, so repeat claims can be found without storing a raw World ID nullifier. The event ID written to tickets and claims is SHA-256 of `ARKIV_EVENT_ID`.

The event and payment schemas are in `src/arkiv/records.ts`:

- Event: `eventId` (hash), `eventName`, `organiser`, `eventDate`.
- Payment: `txnHash`, `eventId` (hash), `userId` (hash), `createdAt`.

Event creation and payment ingestion are schema-only for the demo; there are no API routes for them. `npm run arkiv:spike` writes one-day disposable records using the production account, event, ticket, claim, and payment schemas, then reads them back to check their fields, ticket listing, claim batch, and duplicate-claim rejection. Its payment transaction hash is a test value, not a real purchase.

Old SQLite demo tickets are not migrated; create fresh tickets through the Arkiv API. Ticket and claim entities expire after the configured lifetime. Arkiv does not provide uniqueness constraints, so claims are serialized within this single server process; run one instance for the demo.
