#!/usr/bin/env bash
# Sets up the Claude Code tools for Resona's sponsor tracks: Arkiv, World and ENS.
# Safe to run more than once. Guide: docs/AI_TOOLS_SETUP.md
set -euo pipefail

cd "$(dirname "$0")/.."

SKILLS_CLI="skills@1.7.6"
ENS_TAG="v1.16.0"
ENS_SKILLS=(base ens-protocol enscli enskit enssdk omnigraph)
ENS_DOCS=".claude/references/ens-docs-llms-full.txt"

export CI=1 NO_COLOR=1

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
for tool in claude node npx curl; do
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
ok "claude, node $(node -v), npx and curl"

echo "Arkiv"
quiet "plugin marketplace" claude plugin marketplace add Arkiv-Network/ai-plugin --scope project
quiet "plugin" claude plugin install arkiv@arkiv --scope project

echo "World"
if grep -qs '"world-docs"' .mcp.json; then
  ok "world-docs MCP already configured"
else
  quiet "world-docs MCP" claude mcp add --transport http --scope project world-docs https://docs.world.org/mcp
fi
if [ -f .claude/skills/world-id-integration/SKILL.md ]; then
  ok "world-id-integration skill already installed"
else
  quiet "world-id-integration skill" npx -y "$SKILLS_CLI" add worldcoin/developer-docs \
    --skill world-id-integration -a claude-code -y
fi

echo "ENS"
missing=()
for skill in "${ENS_SKILLS[@]}"; do
  [ -f ".claude/skills/$skill/SKILL.md" ] || missing+=(--skill "$skill")
done
if [ "${#missing[@]}" -eq 0 ]; then
  ok "ensskills already installed"
else
  quiet "ensskills $ENS_TAG" npx -y "$SKILLS_CLI" add \
    "https://github.com/namehash/ensnode/tree/$ENS_TAG/packages/ensskills/skills" \
    "${missing[@]}" -a claude-code -y
fi

mkdir -p .claude/references
if [ -s "$ENS_DOCS" ]; then
  ok "ENS docs already downloaded"
else
  quiet "ENS docs" curl -fsSL https://docs.ens.domains/llms-full.txt -o "$ENS_DOCS"
fi

if [ -f .claude/skills/ensv2-writes/SKILL.md ]; then
  ok "ensv2-writes skill already installed"
else
  mkdir -p .claude/skills/ensv2-writes
  cat >.claude/skills/ensv2-writes/SKILL.md <<'SKILL'
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
echo "Done. Restart Claude Code from this folder and approve world-docs when asked."
echo "Next steps are in docs/AI_TOOLS_SETUP.md"
