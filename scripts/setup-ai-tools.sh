#!/usr/bin/env bash
# Sets up the shared agent tools for Resona's sponsor tracks (Arkiv, World and ENS)
# for Claude Code, Codex and OpenCode. Skills live in .agents/skills, and .claude/skills
# holds symlinks to them.
# Safe to run more than once. Guide: docs/AI_TOOLS_SETUP.md
set -euo pipefail

cd "$(dirname "$0")/.."

SKILLS_CLI="skills@1.7.6"
ARKIV_REF="51d22fd0485130d701f2340fe003d71101ad571d"
ARKIV_SKILLS=(arkiv arkiv-app-integration arkiv-data-modeling arkiv-encryption
  arkiv-entity-expiration arkiv-entity-lifecycle arkiv-feedback arkiv-first-write
  arkiv-indexing arkiv-large-files arkiv-mcp arkiv-query arkiv-security-trust
  arkiv-social-graph arkiv-troubleshooting arkiv-write-safety)
# World's installer copies its whole docs folder. These pages don't apply to Resona's
# React and Node IDKit flow, and the world-docs MCP still serves them.
WORLD_PRUNE=(4-0-migration from-idkit-standalone yc overview
  idkit/go idkit/kotlin idkit/swift idkit/react-native idkit/mini-apps
  idkit/onchain-verification idkit/session-proofs idkit/design-guidelines
  idkit/build-with-llms idkit/integration-prompt credentials/11 credentials/9303
  reference/authenticator reference/contracts reference/issuer-1 reference/issuer-9303
  sandbox/testing-selfie-check)
ENS_TAG="v1.16.0"
ENS_SKILLS=(base ens-protocol enscli enskit enssdk omnigraph)
ENS_DOCS=".claude/references/ens-docs-llms-full.txt"
SKILLS_DIR=".agents/skills"
AGENTS=(-a claude-code -a codex -a opencode)

export CI=1 NO_COLOR=1 DISABLE_TELEMETRY=1 DO_NOT_TRACK=1

failures=0
log="$(mktemp)"
trap 'rm -f "$log"' EXIT

ok()   { printf '  ok    %s\n' "$1"; }
warn() { printf '  warn  %s\n' "$1"; }
bad()  { printf '  FAIL  %s\n' "$1"; failures=$((failures + 1)); }

# Runs a command quietly, and shows its output only if it fails.
quiet() {
  local label="$1"
  shift
  if "$@" >"$log" 2>&1; then
    ok "$label"
  else
    bad "$label"
    tail -n 15 "$log"
  fi
}

echo "Checking requirements"
for tool in node npx curl; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "  FAIL  $tool is not installed. See docs/AI_TOOLS_SETUP.md"
    exit 1
  fi
done
node_major="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$node_major" -lt 20 ]; then
  echo "  FAIL  Node 20 or newer is required, and you have $(node -v)"
  exit 1
fi
ok "node $(node -v), npx and curl"

# Sets MISSING to --skill flags for the named skills that aren't installed yet.
find_missing() {
  MISSING=()
  local skill
  for skill in "$@"; do
    [ -f "$SKILLS_DIR/$skill/SKILL.md" ] || MISSING+=(--skill "$skill")
  done
}

echo "Arkiv"
find_missing "${ARKIV_SKILLS[@]}"
if [ "${#MISSING[@]}" -eq 0 ]; then
  ok "Arkiv skills already installed"
else
  quiet "Arkiv skills ${ARKIV_REF:0:7}" npx -y "$SKILLS_CLI" add \
    "https://github.com/Arkiv-Network/skills/tree/$ARKIV_REF/skills" \
    "${MISSING[@]}" "${AGENTS[@]}" -y
fi

echo "World"
if [ -f "$SKILLS_DIR/world-id-integration/SKILL.md" ]; then
  ok "world-id-integration skill already installed"
else
  quiet "world-id-integration skill" npx -y "$SKILLS_CLI" add worldcoin/developer-docs \
    --skill world-id-integration "${AGENTS[@]}" -y
  for page in "${WORLD_PRUNE[@]}"; do
    rm -f ".agents/skills/world-id-integration/${page:?}.mdx"
  done
  rmdir .agents/skills/world-id-integration/reference 2>/dev/null || true
fi

echo "ENS"
find_missing "${ENS_SKILLS[@]}"
if [ "${#MISSING[@]}" -eq 0 ]; then
  ok "ensskills already installed"
else
  quiet "ensskills $ENS_TAG" npx -y "$SKILLS_CLI" add \
    "https://github.com/namehash/ensnode/tree/$ENS_TAG/packages/ensskills/skills" \
    "${MISSING[@]}" "${AGENTS[@]}" -y
fi

mkdir -p .claude/references
if [ -s "$ENS_DOCS" ]; then
  ok "ENS docs already downloaded"
else
  quiet "ENS docs" curl -fsSL https://docs.ens.domains/llms-full.txt -o "$ENS_DOCS"
fi

if [ -f "$SKILLS_DIR/ensv2-writes/SKILL.md" ]; then
  ok "ensv2-writes skill already installed"
else
  mkdir -p "$SKILLS_DIR/ensv2-writes"
  cat >"$SKILLS_DIR/ensv2-writes/SKILL.md" <<'SKILL'
---
name: ensv2-writes
description: Find official ENSv2 docs for writing on-chain, such as registering subnames, deploying a UserRegistry through the Verifiable Factory, setSubregistry, role bitmaps (ROLE_CAN_TRANSFER_ADMIN, ROLE_REGISTRAR, ROLE_UNREGISTER), grantSetterRoles and the permissioned resolver. Use for Resona's pass issuing, transfers and revocation. The ensskills skills only cover reading ENS data.
---

# ENSv2 writes

The full ENS docs are saved at `.claude/references/ens-docs-llms-full.txt`, copied from https://docs.ens.domains/llms-full.txt.

The file is 1.8 MB, so never read it whole. Use `grep -n` for a term, then read only the lines around each match. Refresh it with `curl` if it might be out of date.

Resona's design is in `docs/ARCHITECTURE.md`, under "ENSv2: tickets as subnames".
SKILL
  ok "ensv2-writes skill"
fi

echo "Agent folders"
mkdir -p .claude/skills
link_failures=0
for dir in "$SKILLS_DIR"/*/; do
  name="$(basename "$dir")"
  link=".claude/skills/$name"
  if [ -L "$link" ]; then
    continue
  elif [ -e "$link" ]; then
    bad "$link is a real folder, so Claude may not use the shared copy. Move it to $SKILLS_DIR"
    link_failures=$((link_failures + 1))
  else
    ln -s "../../$SKILLS_DIR/$name" "$link"
  fi
done
[ "$link_failures" -eq 0 ] && ok "Claude skill links"
for config in .mcp.json .codex/config.toml opencode.json; do
  missing_servers=""
  for server in arkiv world-docs context7; do
    grep -qs "$server" "$config" || missing_servers="$missing_servers $server"
  done
  if [ -z "$missing_servers" ]; then
    ok "$config lists every MCP server"
  else
    bad "$config is missing:$missing_servers"
  fi
done

echo "Checking connections"
mcp_check() {
  local name="$1" url="$2"
  local body='{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"resona-setup","version":"1"}}}'
  if curl -s -m 20 -X POST "$url" \
    -H 'Content-Type: application/json' \
    -H 'Accept: application/json, text/event-stream' \
    -d "$body" | grep -q '"serverInfo"'; then
    ok "$name MCP responds"
  else
    bad "$name MCP did not respond at $url"
  fi
}
mcp_check "Arkiv" https://mcp.arkiv.network/mumbai
mcp_check "World" https://docs.world.org/mcp
mcp_check "Context7" https://mcp.context7.com/mcp

if curl -s -m 15 -o /dev/null https://api.v2-sepolia.ensnode.io/health; then
  ok "ENSNode sepolia-v2 reachable"
else
  warn "ENSNode sepolia-v2 unreachable, so enscli lookups won't work on this network. Try another network; building isn't blocked"
fi

echo
if [ "$failures" -gt 0 ]; then
  echo "Finished with $failures failure(s). Fix them, then run this script again."
  exit 1
fi
echo "Done. Restart your agent from this folder, and approve or trust the project when asked."
echo "Codex ignores .codex/config.toml until this exact folder is trusted."
echo "Next steps are in docs/AI_TOOLS_SETUP.md"
