# ENSv2 implementation and Sepolia runbook

## Current status

Implemented in the standalone operator CLI and an optional read-only server integration:

- Deploy an ENSv2 UserRegistry proxy, link it to an existing event name, issue non-transferable passes, inspect ownership, and simulate a holder transfer.
- Validate event and pass labels against the demo's single-label ASCII `.eth` policy, and reject pass expiries that are not safe future timestamps within the event name's expiry. For this restricted alphabet, ASCII case folding supplies the expected ENSIP-15 normalization.
- Pass owners receive **zero roles**; the operator receives registrar, unregister, renew, and set-parent roles on the registry root. The operator receives no upgrade or role-admin powers.
- `inspect` and `transfer-check` are read-only and do not require a private key. `transfer-check` uses `eth_call`, not a mined transaction.
- The server read path checks that the configured event name still points to the expected registry, reads the pass owner and expiry, and compares the owner with the Arkiv ticket holder. The wallet displays this result when the server has ENS enabled.
- The server transfer-check path uses `eth_call` and accepts only the exact `TransferDisallowed(tokenId, owner)` error. It never submits a transaction; the wallet labels this clearly.
- Offline label/expiry tests and an API-to-RPC integration test cover the ENS read and transfer-check behavior using a local RPC fixture. No live Sepolia deployment has been verified by this implementation.

ENS pass writes remain manual through the CLI and are not reconciled to Arkiv. **Not yet implemented:** door enforcement, automatic parent-name registration, people namespaces/profiles, address/text resolver records, organizer ENS-name input, automatic issuance from the HTTP issue route, organizer-approved reissue, and a mined reverted-transfer transaction. The read-only API expects the pass label to be the ticket's `passId`.

The current `/api/issue` endpoint remains a demo stand-in. It does **not** issue an ENS pass. Do not expose organizer signing through this unauthenticated endpoint. Until organizer authentication and issuance recovery exist, issue the matching on-chain pass explicitly with this CLI.

## 1. Prerequisites

1. Use a disposable organizer wallet with Sepolia ETH. Never use a production wallet.
2. Register an event name using the [Sepolia ENS app](https://sepolia.app.ens.domains). The organizer wallet must control this name and have permission to set its subregistry. ENSv2 registration uses test stablecoins; the [deployment page](https://docs.ens.domains/learn/deployments#sepolia-ensv2) describes freely mintable MockUSDC. The name must remain active beyond the pass expiry.
3. Get the **current Sepolia ENSv2** `ETHRegistry`, `VerifiableFactory` and `UserRegistryImpl` addresses from the official deployment page. Do not use the legacy ENSv1 registry or an implementation address as the event registry. Addresses are intentionally not hard-coded because test deployments change.
4. Create `server/.env.ens` (git-ignored):

```dotenv
ENS_ENABLED=false
ENS_RPC_URL=https://YOUR_SEPOLIA_RPC
ENS_PRIVATE_KEY=0xYOUR_DISPOSABLE_ORGANIZER_KEY
ENS_EVENT_NAME=YOUR_EVENT.eth
ENS_PARENT_REGISTRY=0xCURRENT_ENSV2_ETH_REGISTRY
ENS_FACTORY=0xCURRENT_VERIFIABLE_FACTORY
ENS_USER_REGISTRY_IMPL=0xCURRENT_USER_REGISTRY_IMPLEMENTATION
ENS_EVENT_REGISTRY=
```

The standalone CLI loads `.env.ens` after `.env` using Node's env-file flags. Server startup does not load `.env.ens`: set `ENS_ENABLED=true`, `ENS_RPC_URL`, `ENS_EVENT_NAME`, `ENS_PARENT_REGISTRY`, and `ENS_EVENT_REGISTRY` in the server's normal environment (for local startup, `server/.env`). `ENS_PRIVATE_KEY` is only needed by CLI writes. Nothing belongs in `VITE_*` variables. The API performs no ENS writes and does not need the private key.

## 2. Deploy and link the event registry

From `server/`:

```sh
node --env-file=.env --env-file-if-exists=.env.ens --import tsx src/ens/cli.ts deploy
```

This sends a Sepolia transaction and prints its explorer URL. Wait for success and copy the printed `ENS_EVENT_REGISTRY=...` into `.env.ens`. Each deploy invocation uses a fresh salt and creates a new proxy; **do not rerun to recover an existing address**. Recover it from the previous transaction's `ProxyDeployed` event instead.

```sh
node --env-file=.env --env-file-if-exists=.env.ens --import tsx src/ens/cli.ts link
```

This sets the child registry's backward parent pointer, then the event name's forward subregistry pointer. It refuses to replace a different existing subregistry. If the second transaction fails, retry `link` with the same addresses after fixing the parent-name permissions. Initialization grants the organizer its operational roles directly; there is no later role-granting transaction.

Use the same workflow with separate environment values if a people namespace is later needed. This CLI currently accepts a second-level `.eth` parent only.

## 3. Issue the matching pass

Create/claim a demo ticket through the existing app. Obtain its exact pass ID and wallet address from the ticket API, then:

```sh
# Replace 7, the holder address and expiry with the actual ticket's values.
# Expiry is Unix seconds, in the future, no later than the parent name expiry.
node --env-file=.env --env-file-if-exists=.env.ens --import tsx src/ens/cli.ts issue 7 0xHOLDER_WALLET EXPIRY_UNIX_SECONDS
node --env-file=.env --env-file-if-exists=.env.ens --import tsx src/ens/cli.ts inspect 7
```

`issue` checks the parent linkage, validates expiry, simulates the registration, sends it and waits for a successful receipt. It registers `7.YOUR_EVENT.eth` with no child registry, no resolver and a holder role bitmap of `0`. Name ownership is available, but this does not yet set address/text records for standard ENS resolution. `inspect` reads the current owner, current token ID and expiry. Token IDs can change; never assume the labelhash is the current token ID.

The CLI does not create or change the Arkiv ticket. Use the exact Arkiv `passId` as the ENS label and its `holder` as the pass owner. Never assign a different wallet on-chain from the ticket's holder. A duplicate registration reverts rather than silently overwriting the existing pass.

## 4. Confirm the transfer restriction

```sh
node --env-file=.env --env-file-if-exists=.env.ens --import tsx src/ens/cli.ts transfer-check 7 0xDIFFERENT_RECIPIENT
```

This performs `eth_call` as the current owner using the current token ID. It needs **no holder private key**, spends no gas and broadcasts no transaction. A zero exit code and `result: "blocked"` mean the contract returned the exact `TransferDisallowed(tokenId, owner)` custom error for that pass. Network errors and unrelated reverts fail the command; they are not treated as transfer-policy evidence. If a deployment returns a different error (for example an emancipation safety check), investigate rather than calling that success.

This is a simulation, **not** a mined reverted transaction. To meet the demo's transaction-link requirement, a later holder-signed transfer flow must deliberately broadcast the failing transaction with an explicit gas limit and show its failed receipt. Never invent a transaction hash for an `eth_call`.

## 5. Wallet ownership display and door ownership enforcement (partially implemented)

The optional read-only API is enabled with `ENS_ENABLED=true`. `GET /api/ens/pass/:passId` first loads the organizer-owned Arkiv ticket, then checks the event's parent subregistry link, the pass owner, and expiry on Sepolia. It returns whether the pass is active, linked and owned by the ticket holder. The wallet ticket screen displays that result. `POST /api/ens/pass/:passId/transfer-check` simulates a transfer to a fixed demo recipient and reports `blocked` only for the expected custom error. No transaction is sent.

This does **not** enforce the door: its current check-in and results are simulated, and there is no server check-in route. When a real check-in route exists, it must repeat the ownership check after the sonar pass and immediately before recording the check-in. It must fail closed if the registry link, owner, expiry or ticket holder disagree.

For local or hosted server API use, configure these public ENS values in the server environment:

```dotenv
ENS_ENABLED=true
ENS_RPC_URL=https://YOUR_SEPOLIA_RPC
ENS_EVENT_NAME=YOUR_EVENT.eth
ENS_PARENT_REGISTRY=0xCURRENT_ENSV2_ETH_REGISTRY
ENS_EVENT_REGISTRY=0xYOUR_DEPLOYED_EVENT_REGISTRY
```

`ENS_ENABLED` defaults to false. The service does not use an organizer private key. ENS verification is a point-in-time read, not an atomic cross-chain transaction; the organizer remains trusted to manage the namespace.

## Validation

```sh
cd server
npm test
npx tsc --noEmit --types node --target es2023 --module nodenext --moduleResolution nodenext --allowImportingTsExtensions --skipLibCheck src/ens/cli.ts src/ens/contracts.test.ts
cd ../app
npm run build
```

The API-to-RPC integration test exercises ownership, linkage, expiry, holder match, transfer blocking, and missing-ticket handling against a local RPC fixture. The CLI has not been run against a live Sepolia deployment. A live demo pass and live ownership/transfer check remain necessary before calling ENS deployment and door behavior verified. The app build also currently fails because the installed app dependencies cannot resolve `@arkiv-network/sdk`; see `TODO.md`.

## References

- [ENSv2 permissioned registry](https://docs.ens.domains/ensv2/permissioned-registry)
- [Verifiable Factory](https://docs.ens.domains/ensv2/verifiable-factory)
- [Subnames](https://docs.ens.domains/ensv2/subnames)
- [Official contract interfaces](https://github.com/ensdomains/contracts-v2/blob/main/contracts/src/registry/interfaces/IStandardRegistry.sol)
- [Product architecture](ARCHITECTURE.md#ensv2-tickets-as-subnames)
