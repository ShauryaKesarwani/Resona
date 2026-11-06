#!/usr/bin/env bash
# Keeps the VPS on the latest origin/main. Run it in its own tmux session:
#   tmux new-session -d -s resona-deploy "$HOME/Resona/scripts/autodeploy.sh"
#
# Checks every INTERVAL seconds, rebuilds only what changed, and restarts the
# server only when server code changed, because a restart drops check-in sessions.
# Pause it before a demo with `touch ~/.resona-deploy-paused`, and remove the file to resume.

set -u

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SESSION="${RESONA_SESSION:-resona}"
BRANCH="${RESONA_BRANCH:-main}"
INTERVAL="${RESONA_INTERVAL:-60}"
PAUSE_FILE="${RESONA_PAUSE_FILE:-$HOME/.resona-deploy-paused}"
START_CMD='npm start; exec bash'

log() { echo "[$(date '+%H:%M:%S')] $*"; }

server_running() { tmux has-session -t "=$SESSION" 2>/dev/null; }

start_or_restart() {
  if server_running; then
    tmux respawn-pane -k -t "=$SESSION:" -c "$REPO/server" "$START_CMD"
    log "server restarted"
  else
    tmux new-session -d -s "$SESSION" -c "$REPO/server" "$START_CMD"
    log "server started"
  fi
}

# Returns 0 if the new commit is live, non-zero if it should not be retried.
deploy() {
  local old="$1" new="$2" changed
  changed="$(git diff --name-only "$old" "$new")"

  if ! git merge --ff-only -q "$new"; then
    log "FAILED: could not fast-forward to ${new:0:7}. Local commits or edits are in the way"
    return 1
  fi

  if grep -q '^app/' <<<"$changed"; then
    log "building app"
    if ! (cd app && npm ci --silent && npm run build); then
      log "FAILED: app build for ${new:0:7}. The previous build may still be served"
      return 1
    fi
  fi

  if grep -q '^server/' <<<"$changed"; then
    if grep -q '^server/package' <<<"$changed"; then
      log "installing server packages"
      if ! (cd server && npm ci --silent); then
        log "FAILED: server install for ${new:0:7}. Server not restarted"
        return 1
      fi
    fi
    start_or_restart
  fi

  if grep -q '\.env\.example$\|ens\.env\.example$' <<<"$changed"; then
    log "NOTE: an env example changed. Check whether server/.env needs new values"
  fi
  log "live on ${new:0:7}"
}

main() {
  cd "$REPO" || exit 1
  local failed="" deployed remote paused=""
  deployed="$(git rev-parse HEAD)"

  log "watching origin/$BRANCH every ${INTERVAL}s"
  server_running || start_or_restart

  while true; do
    if [[ -e "$PAUSE_FILE" ]]; then
      [[ -n "$paused" ]] || log "paused: remove $PAUSE_FILE to resume"
      paused=1
    else
      [[ -z "$paused" ]] || log "resumed"
      paused=""
      if git fetch -q origin "$BRANCH"; then
        remote="$(git rev-parse "origin/$BRANCH")"
        if [[ "$deployed" != "$remote" && "$remote" != "$failed" ]]; then
          log "new commit ${remote:0:7}: $(git log -1 --format=%s "$remote")"
          # Diff from the last good deploy, so a later commit rebuilds what a failed one skipped.
          if deploy "$deployed" "$remote"; then
            # Pick up any change to this script.
            exec "$REPO/scripts/autodeploy.sh"
          else
            failed="$remote"
          fi
        fi
      else
        log "git fetch failed, trying again next check"
      fi
    fi
    sleep "$INTERVAL"
  done
}

main "$@"
