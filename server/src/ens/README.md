# ENSv2 operator CLI

The standalone Sepolia CLI deploys and links a UserRegistry, issues and inspects ticket subnames, and simulates a direct transfer attempt. The server API resolves ENS names through ENSNode, reads a ticket's configured pass owner, and supports organizer-approved reassignment. Name lookup reads the Rabdi-specific EVM address record (coin type `2155277743` for chain ID `7794095`). When ENS is configured, check-in checks the pass at session start and again before the Arkiv write. Live ENSNode/Sepolia and phone verification remain pending.

Copy `server/ens.env.example` to `server/.env.ens` and fill in the current Sepolia contract addresses from the official ENS deployments page. Use a disposable organizer wallet. Keep `.env.ens` private.

From `server/`, with dependencies installed, run commands as:

```sh
node --env-file=.env --env-file-if-exists=.env.ens --import tsx src/ens/cli.ts deploy
node --env-file=.env --env-file-if-exists=.env.ens --import tsx src/ens/cli.ts link
node --env-file=.env --env-file-if-exists=.env.ens --import tsx src/ens/cli.ts issue 7 0xHOLDER EXPIRY_UNIX_SECONDS
node --env-file=.env --env-file-if-exists=.env.ens --import tsx src/ens/cli.ts inspect 7
node --env-file=.env --env-file-if-exists=.env.ens --import tsx src/ens/cli.ts transfer-check 7 0xRECIPIENT
```

`ENS_PRIVATE_KEY` is required for `deploy`, `link`, and `issue`. `transfer-check` uses `eth_call` as the current pass owner and never broadcasts a transaction. A successful simulation means the pass is transferable; only the exact `TransferDisallowed` error is reported as a blocked transfer.

For the server API, set `ENS_ENABLED=true`, `ENS_RPC_URL`, `ENS_EVENT_NAME`, `ENS_PARENT_REGISTRY`, and `ENS_EVENT_REGISTRY` in `server/.env` or the server's deployment environment. `ENSNODE_URL` defaults to the public ENSv2 Sepolia instance and can be overridden. Name lookups read each name's Rabdi-specific address record. Pass names are derived from the Arkiv `passId`.

Organizer-approved transfers additionally require `ENS_PRIVATE_KEY` in the server environment. The key is used only by the server to unregister and re-register a pass after an authorized organizer approves a holder request. Confirm that its account has the registry's unregister and registrar permissions before enabling the flow. ENS and Arkiv are separate writes: an uncertain result is recorded as `needs_review` and must be reconciled manually; do not retry it blindly. The wallet's transfer screen and organizer review screen are wired to the API, but live role/write/reconciliation and phone checks remain to be done.

The registry proxy is initialized with only registrar, set-parent, unregister, and renew roles on its root resource. Pass owners receive no roles. The registry address is returned from the factory's `ProxyDeployed` event; a failed command should not be retried as a way to recover it. Read the deployment transaction receipt instead.
