# Arkiv lifecycle spike

This isolated test writes public, disposable `resona.spike.*` entities to Rabdi; it does not change the API or the SQLite store. It creates a ticket, reads it using the organizer as owner, patches the status, and creates and reads a read-only check-in. Both records expire after one day. Read-only prevents attribute changes, not deletion or ownership transfer.

1. Use Node 22.13 or newer and run `npm install` in `server/`.
2. Create a **testnet-only** account and fund it with tGLM from the [faucet](https://hub.arkiv.network/faucet). Get an [Arkiv access key](https://hub.arkiv.network/access-keys).
3. In `server/`, copy `.env.example` to `.env` and set `ARKIV_PRIVATE_KEY` and `ARKIV_ACCESS_KEY` locally. Never share or commit them.
4. Run `node --env-file=.env --import tsx src/arkiv/spike.ts` (or export the variables and run `npm run arkiv:spike`).

The script prints the organizer address, entity keys, and transaction hashes for inspection in the Arkiv explorer. Every run creates new onchain records and spends testnet gas. If an operation fails after a write, that record remains until expiration. A successful spike does not implement actual ticket issuance, sonar verification, or ENS.
