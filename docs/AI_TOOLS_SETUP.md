# AI tools setup

This gives Claude Code the official Arkiv, World and ENS tools for Resona. It takes a few minutes.

## Before you start

You need:

- [Claude Code](https://code.claude.com/docs/en/setup)
- Node 20 or newer
- `curl`
- macOS, Linux or WSL, since the script needs bash

## Setup

1. Run the script from anywhere in your clone:

   ```bash
   ./scripts/setup-ai-tools.sh
   ```

2. Restart Claude Code from the `Resona` folder, and approve `world-docs` when asked.

3. Paste this into Claude Code to check everything loaded:

   > Call the Arkiv MCP `server_status` tool and report the profile. Then search the World docs MCP for "nullifier". Then list the skills you have for World and ENS. Don't change anything.

   The Arkiv profile should be `mumbai`, the World search should return results, and the skills in the table below should be listed.

If the script reports a failure, fix it and run the script again. It skips anything already installed.

## What gets installed

Everything is scoped to this project, except for a shared plugin cache in your user folder.

| Track | Tool | Use it for |
|---|---|---|
| **Arkiv** | Plugin with skills and the Mumbai MCP server | Schemas, writes, queries and the event's rules. Skills are named `arkiv:<skill>`, and `/arkiv:arkiv` is the place to start |
| **World** | `world-docs` MCP | Searching World's docs while coding |
| **World** | `world-id-integration` skill | Adding IDKit, signing requests on the server and verifying proofs |
| **ENS** | `ensskills`: `base`, `ens-protocol`, `enscli`, `enskit`, `enssdk`, `omnigraph` | **Reading** ENS data, such as names, owners and subnames |
| **ENS** | `ensv2-writes` skill and the saved ENS docs | **Writing** on-chain: registering passes, registries and roles |

There's no official ENS MCP server, so ENS is skills only.

## World Developer Portal (optional)

Only the person setting up the World app needs this. It lets Claude create the app, relying party and actions. Anyone holding the key can change the team's apps, so keep it to one person.

1. Create a team API key in the [Developer Portal](https://developer.world.org). It starts with `api_`.
2. Run this in your own terminal, not in a Claude chat:

   ```bash
   claude mcp add world-developer-portal https://developer.world.org/api/mcp \
     --transport http --scope local --header "Authorization: Bearer api_..."
   ```

Keep `--scope local`. With `--scope project`, the key would be saved in `.mcp.json`, which is shared through git.

## Troubleshooting

| Problem | Fix |
|---|---|
| `enscli` says "fetch failed", or the script warns about ENSNode | ENSNode's TLS certificate didn't match on one network we tested. Try a phone hotspot. Don't turn off certificate checks. Pass issuing doesn't depend on this |
| `world-docs` shows "Pending approval" | Restart Claude Code from the `Resona` folder and approve it |
| Skills or the plugin don't appear | Claude Code loads them at startup, so restart it |
| You want to turn off Arkiv's telemetry | Set `ARKIV_TELEMETRY=off` before starting Claude Code |

## Secrets

Never commit or paste these into a chat: the World API key, World signing key, Arkiv access keys, or any wallet private key.
