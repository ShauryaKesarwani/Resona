# ENSv2 implementation and Sepolia runbook

## Current status

Implemented as a standalone operator CLI in `server/src/ens/`:

- Deploy an ENSv2 UserRegistry proxy, link it to an existing event name, issue non-transferable passes, inspect ownership, and simulate a holder transfer.
- Validate event and pass labels against the demo's single-label ASCII `.eth` policy, and reject pass expiries that are not safe future timestamps within the event name's expiry. For this restricted alphabet, ASCII case folding supplies the expected ENSIP-15 normalization.
- Pass owners receive **zero roles**; the operator receives registrar, unregister, renew, and set-parent roles on the registry root. The operator receives no upgrade or role-admin powers.
- `inspect` and `transfer-check` are read-only and do not require a private key. `transfer-check` uses `eth_call`, not a mined transaction.
- Offline tests cover label and expiry validation. On-chain CLI behavior and ownership verification are not yet covered by automated tests.

The CLI is not connected to the HTTP API, ticket store, app, or check-in flow. **Not yet implemented:** door enforcement, automatic parent-name registration, people namespaces/profiles, address/text resolver records, organizer ENS-name input, automatic issuance from the HTTP issue route, organizer-approved reissue, and an on-chain reverted-transfer transaction or demo page. No live Sepolia deployment has been verified by this implementation.

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

The standalone CLI loads `.env.ens` after `.env` using Node's env-file flags. Server startup does not load ENS configuration. `ENS_PRIVATE_KEY` is only needed by CLI writes. Nothing belongs in `VITE_*` variables.

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

The CLI does not create or change the SQLite ticket. Never assign a different wallet on-chain from the ticket's holder. A duplicate registration reverts rather than silently overwriting the existing pass.

## 4. Confirm the transfer restriction

```sh
node --env-file=.env --env-file-if-exists=.env.ens --import tsx src/ens/cli.ts transfer-check 7 0xDIFFERENT_RECIPIENT
```

This performs `eth_call` as the current owner using the current token ID. It needs **no holder private key**, spends no gas and broadcasts no transaction. A zero exit code and `result: "blocked"` mean the contract returned the exact `TransferDisallowed(tokenId, owner)` custom error for that pass. Network errors and unrelated reverts fail the command; they are not treated as transfer-policy evidence. If a deployment returns a different error (for example an emancipation safety check), investigate rather than calling that success.

This is a simulation, **not** a mined reverted transaction. To meet the demo's transaction-link requirement, a later holder-signed transfer flow must deliberately broadcast the failing transaction with an explicit gas limit and show its failed receipt. Never invent a transaction hash for an `eth_call`.

## 5. Door ownership enforcement (not implemented)

The server currently has no ENS door enforcement. `ENS_ENABLED` is not read by the server. This section records the intended behavior; adding it requires integration with the active check-in flow and must wait until that flow is settled.

The intended deployment setting, after implementation, is:

```dotenv
ENS_ENABLED=true
```

With enforcement enabled, a near sonar result should be accepted only when the configured event's parent still points to the configured registry and `getOwner(labelhash(passId))` matches the ticket holder. ENSv2 masks expired ownership to the zero address, so expired names should be rejected. The verification should run immediately before the check-in write; it is not an atomic cross-chain transaction, and the organizer remains trusted to manage the namespace.

No current door behavior changes based on ENS configuration.

## Validation

```sh
cd server
npm test
npx tsc --noEmit --types node --target es2023 --module nodenext --moduleResolution nodenext --allowImportingTsExtensions --skipLibCheck src/ens/cli.ts src/ens/contracts.test.ts
cd ../app
npm run build
```

The CLI has not been run against a live Sepolia deployment. Automated tests cover only label and expiry validation; on-chain CLI behavior and ownership verification remain untested. Manual validation remains the deployment, issue, inspect, and transfer simulation workflow above.

## References

- [ENSv2 permissioned registry](https://docs.ens.domains/ensv2/permissioned-registry)
- [Verifiable Factory](https://docs.ens.domains/ensv2/verifiable-factory)
- [Subnames](https://docs.ens.domains/ensv2/subnames)
- [Official contract interfaces](https://github.com/ensdomains/contracts-v2/blob/main/contracts/src/registry/interfaces/IStandardRegistry.sol)
- [Product architecture](ARCHITECTURE.md#ensv2-tickets-as-subnames)
