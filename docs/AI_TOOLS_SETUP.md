# AI tools setup

This gives Claude Code, Codex and OpenCode the same official Arkiv, World and ENS tools for Resona. It takes a few minutes.

## Before you start

You need:

- At least one of [Claude Code](https://code.claude.com/docs/en/setup), Codex or OpenCode
- Node 20 or newer
- `curl`
- macOS, Linux or WSL, since the script needs bash and the Claude skill folder uses symlinks

## Setup

Skills and MCP settings are committed, so a fresh clone already has them. The script installs anything missing and checks the connections.

1. Run the script from anywhere in your clone:

   ```bash
   ./scripts/setup-ai-tools.sh
   ```

2. Restart your agent from the `Resona` folder, then allow the project's MCP servers:

   | Agent | What to do |
   |---|---|
   | Claude Code | Approve `arkiv`, `world-docs` and `context7` when asked |
   | Codex | Trust this exact folder when asked. Trusting a parent folder doesn't count, and Codex silently skips `.codex/config.toml` until this one is trusted |
   | OpenCode | Nothing, it reads `opencode.json` directly |

3. Paste this into your agent to check everything loaded:

   > Call the Arkiv MCP `server_status` tool and report the profile. Then search the World docs MCP for "nullifier". Then use Context7 to look up ENSv2 roles in `/websites/ens_domains`. Then list the skills you have for Arkiv, World and ENS. Don't change anything.

   The Arkiv profile should be `mumbai`, both searches should return results, and the skills in the table below should be listed.

If the script reports a failure, fix it and run the script again. It skips anything already installed.

## Where things live

| Path | Used by | Holds |
|---|---|---|
| `.agents/skills/` | Codex and OpenCode directly | The real skill files. Add and edit skills here |
| `.claude/skills/` | Claude Code | Symlinks into `.agents/skills/` |
| `skills-lock.json` | `skills` CLI | The source and version of each installed skill |
| `.mcp.json` | Claude Code | MCP servers |
| `.codex/config.toml` | Codex | MCP servers |
| `opencode.json` | OpenCode | MCP servers |

The three MCP files use different formats, so change them together. To add a skill for every agent:

```bash
npx skills@1.7.6 add <source> --skill <name> -a claude-code -a codex -a opencode -y
```

## What gets installed

| Track | Tool | Use it for |
|---|---|---|
| **Arkiv** | `arkiv` MCP, Mumbai profile | Event rules, schema and submission checks, and verifying entities and transactions. It doesn't sign or write |
| **Arkiv** | 16 skills, starting with `arkiv` | Schemas, writes, queries, expiry and write safety for SDK 1.x on Rabdi |
| **World** | `world-docs` MCP | Searching World's docs while coding |
| **World** | `world-id-integration` skill | Adding IDKit, signing requests on the server and verifying proofs |
| **ENS** | `context7` MCP | Searching current ENS docs, using library `/websites/ens_domains`. It's a third-party service that ENS's docs recommend, so don't put secrets in queries |
| **ENS** | `ensskills`: `base`, `ens-protocol`, `enscli`, `enskit`, `enssdk`, `omnigraph` | **Reading** ENS data, such as names, owners and subnames |
| **ENS** | `ensv2-writes` skill and the saved ENS docs | **Writing** on-chain: registering passes, registries and roles |

The World skill keeps only the 11 docs pages that fit Resona's React and Node IDKit flow. The other 21, such as other platforms and contract references, are still available through the `world-docs` MCP. Updating the skill with the `skills` CLI brings them back, so remove them again using the `WORLD_PRUNE` list in the script.

ENS doesn't run its own MCP server. Its docs also list community servers, but we don't install them: they aren't official, and the Namespace server's source doesn't mention Sepolia or ENSv2, which Resona uses. For live ENS lookups, use `enscli`.

The Arkiv skills come from `Arkiv-Network/skills` at the commit Arkiv's plugin pins, and they replace that plugin here so all three agents share one copy. This drops the plugin's automatic session rules, which only Claude Code ran, and the Arkiv router skill carries the essential rules instead. Don't also install the plugin, or you'll get duplicate skills and connections.

The `arkiv-mcp` skill describes Arkiv's General profile as the default, but this project uses the Mumbai one. Trust what `server_status` reports. Arkiv intends the Mumbai profile to be the default through 10 November 2026, so after the event, change the URL in all three MCP files to `https://mcp.arkiv.network`.

## World Developer Portal (optional)

Only the person setting up the World app needs this, so it isn't in the shared MCP files. It lets an agent create the app, relying party and actions. Anyone holding the key can change the team's apps, so keep it to one person.

Create a team API key in the [Developer Portal](https://developer.world.org). It starts with `api_`. Then follow the steps for your agent, in your own terminal rather than an agent chat.

**Claude Code**, which saves the key in your user folder rather than the repo:

```bash
claude mcp add world-developer-portal https://developer.world.org/api/mcp \
  --transport http --scope local --header "Authorization: Bearer api_..."
```

Keep `--scope local`. With `--scope project`, the key would be saved in `.mcp.json`, which is shared through git.

**Codex**, after you export `WORLD_DEVELOPER_API_KEY` in your shell profile. This adds the server to your user config and stores only the variable's name:

```bash
codex mcp add world-developer-portal --url https://developer.world.org/api/mcp --bearer-token-env-var WORLD_DEVELOPER_API_KEY
```

**OpenCode**, after you export the same variable. Add this under `mcp` in `~/.config/opencode/opencode.jsonc`, not the project's `opencode.json`:

```json
"world-developer-portal": {
  "type": "remote",
  "url": "https://developer.world.org/api/mcp",
  "oauth": false,
  "headers": { "Authorization": "Bearer {env:WORLD_DEVELOPER_API_KEY}" }
}
```

## Troubleshooting

| Problem | Fix |
|---|---|
| `enscli` says "fetch failed", or the script warns about ENSNode | ENSNode's TLS certificate didn't match on one network we tested. Try a phone hotspot. Don't turn off certificate checks. Pass issuing doesn't depend on this |
| An MCP server shows "Pending approval" in Claude Code | Restart Claude Code from the `Resona` folder and approve it |
| Codex doesn't list the project's MCP servers | Trust this exact folder in `~/.codex/config.toml`, then run `codex mcp list`. Context7 may show `Not logged in`, which is fine because it works without an account |
| Skills don't appear | Agents load them at startup, so restart yours. For Claude Code, also check that `.claude/skills/` holds symlinks rather than empty files, which can happen on Windows without WSL |

## Secrets

Never commit or paste these into a chat: the World API key, World signing key, Arkiv access keys, or any wallet private key. That includes the MCP files and `.codex/config.toml`, which are committed.
