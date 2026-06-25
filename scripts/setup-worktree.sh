#!/usr/bin/env bash
# setup-worktree.sh — initialise a git worktree for local development.
#
# Usage: setup-worktree.sh [--warn-as-error]
#
# Steps
#   1. validate environment  (package.json present, Node ≥ 24)
#   2. enable corepack
#   3. seed .turbo cache     (copy from primary checkout if source exists and
#                             local .turbo is absent; turbo creates one on first run)
#   4. install dependencies  (pnpm install --frozen-lockfile --prefer-offline)
#
# Options
#   --warn-as-error   exit 1 when a non-fatal warning is issued
#
# Run once per worktree. Re-running is safe: each step is a no-op when its
# pre-conditions are already met, but the .turbo step will warn if the
# directory already exists (and exit 1 with --warn-as-error).
set -euo pipefail

# ---------------------------------------------------------------------------
# Globals
# ---------------------------------------------------------------------------

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/.." && pwd)"
WARN_AS_ERROR=false

for arg in "$@"; do
  case "$arg" in
    --warn-as-error) WARN_AS_ERROR=true ;;
    *) echo "setup-worktree: unknown option: $arg" >&2; exit 1 ;;
  esac
done

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

log()  { echo "setup-worktree: $*"; }
warn() { echo "setup-worktree: warning: $*" >&2; [[ "$WARN_AS_ERROR" == true ]] && exit 1 || true; }
die()  { echo "setup-worktree: error: $*" >&2; exit 1; }

# ---------------------------------------------------------------------------
# Steps
# ---------------------------------------------------------------------------

validate_env() {
  cd "$repo_root"

  [[ -f package.json ]] || die "package.json not found at $repo_root"

  local node_major
  node_major="$(node -p "process.versions.node.split('.')[0]" 2>/dev/null || true)"
  [[ -n "$node_major" && "$node_major" -ge 24 ]] || die "Node.js 24+ is required for pnpm 11"
}

enable_corepack() {
  command -v corepack >/dev/null 2>&1 && corepack enable || true
}

# Returns the path of the worktree tracking refs/heads/v-next, excluding the
# current one. Falls back to the first other worktree if v-next isn't found.
find_primary_checkout() {
  command -v git >/dev/null 2>&1 || return 0
  git rev-parse --is-inside-work-tree >/dev/null 2>&1 || return 0

  local current_root
  current_root="$(pwd -P)"

  git worktree list --porcelain | awk -v current="$current_root" '
    /^worktree / { path = substr($0, 10); next }
    /^branch refs\/heads\/v-next$/ && path != current { print path; found = 1; exit }
    /^$/ { if (path != "" && path != current && fallback == "") fallback = path; path = "" }
    END { if (!found && fallback != "") print fallback }
  '
}

# Seeds .turbo from the primary checkout so each worktree gets an isolated
# turbo cache and log files (concurrent runs clobber shared logs).
# Skipped when the source does not exist yet; turbo will create it on first use.
seed_turbo_cache() {
  local primary="$1"

  if [[ -e ".turbo" ]]; then
    warn ".turbo already exists in this worktree — skipping seed (remove it to re-seed)"
    return
  fi

  [[ -n "$primary" && -d "$primary" ]] || return 0

  local source="$primary/.turbo"
  if [[ ! -e "$source" ]]; then
    log ".turbo not present in primary checkout — skipping seed (turbo will create on first run)"
    return
  fi

  cp -r "$source" .turbo
  log "seeded .turbo from $source"
}

install_deps() {
  pnpm install --frozen-lockfile --prefer-offline
  log "pnpm store: $(pnpm store path)"
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

validate_env
enable_corepack
seed_turbo_cache "$(find_primary_checkout)"
install_deps
