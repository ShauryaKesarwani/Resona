# ENSv2 operator CLI

This standalone Sepolia CLI deploys and links a UserRegistry, issues and inspects ticket subnames, and simulates a transfer attempt. It does not integrate with the HTTP API, Arkiv ticket issuance, or check-in flow.

Copy `server/ens.env.example` to `server/.env.ens` and fill in the current Sepolia contract addresses from the official ENS deployments page. Use a disposable organizer wallet. Keep `.env.ens` private.

From `server/`, with dependencies installed, run commands as:

```sh
node --env-file=.env --env-file-if-exists=.env.ens --import tsx src/ens/cli.ts deploy
node --env-file=.env --env-file-if-exists=.env.ens --import tsx src/ens/cli.ts link
node --env-file=.env --env-file-if-exists=.env.ens --import tsx src/ens/cli.ts issue 7 0xHOLDER EXPIRY_UNIX_SECONDS
node --env-file=.env --env-file-if-exists=.env.ens --import tsx src/ens/cli.ts inspect 7
node --env-file=.env --env-file-if-exists=.env.ens --import tsx src/ens/cli.ts transfer-check 7 0xRECIPIENT
```

`ENS_PRIVATE_KEY` is required only for `deploy`, `link`, and `issue`. `transfer-check` uses `eth_call` as the current pass owner and never broadcasts a transaction. A successful simulation means the pass is transferable; only the exact `TransferDisallowed` error is reported as a blocked transfer.

The registry proxy is initialized with only registrar, set-parent, unregister, and renew roles on its root resource. Pass owners receive no roles. The registry address is returned from the factory's `ProxyDeployed` event; a failed command should not be retried as a way to recover it. Read the deployment transaction receipt instead.
