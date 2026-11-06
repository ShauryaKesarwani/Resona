# Arkiv lifecycle spike

This isolated test writes public, disposable `resona.spike.*` entities to Rabdi; it does not change the API or the SQLite store. It creates a ticket, reads it using the organizer as owner, patches the status, and creates and reads a read-only check-in. Both records expire after one day. Read-only prevents attribute changes, not deletion or ownership transfer.

1. Use Node 22.13 or newer and run `npm install` in `server/`.
2. Run `npm run arkiv:setup`. It creates `.env.arkiv` with a new testnet-only private key and prints its public address. It will not overwrite an existing file.
3. Fund the printed address with tGLM from the [faucet](https://hub.arkiv.network/faucet). Get an [Arkiv access key](https://hub.arkiv.network/access-keys).
4. Open `.env.arkiv` locally and add the access key after `ARKIV_ACCESS_KEY=`. Never share or commit this file.
5. Run `npm run arkiv:spike`.

The script prints the organizer address, entity keys, and transaction hashes for inspection in the Arkiv explorer. Every run creates new onchain records and spends testnet gas. If an operation fails after a write, that record remains until expiration. A successful spike does not implement actual ticket issuance, sonar verification, or ENS.
