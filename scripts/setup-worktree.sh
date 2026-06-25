#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/.." && pwd)"

cd "$repo_root"

if [[ ! -f package.json ]]; then
  echo "setup-worktree: package.json not found at $repo_root" >&2
  exit 1
fi

node_major="$(node -p "process.versions.node.split('.')[0]" 2>/dev/null || true)"
if [[ -z "$node_major" || "$node_major" -lt 24 ]]; then
  echo "setup-worktree: Node.js 24+ is required for pnpm 11" >&2
  exit 1
fi

if command -v corepack >/dev/null 2>&1; then
  corepack enable
fi

# Find the worktree that tracks refs/heads/v-next, excluding the current one.
# Falls back to the first other worktree if no v-next worktree exists.
find_primary_checkout() {
  if ! command -v git >/dev/null 2>&1 || ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    return 0
  fi

  local current_root
  current_root="$(pwd -P)"

  git worktree list --porcelain | awk -v current="$current_root" '
    /^worktree / {
      path = substr($0, 10)
      next
    }
    /^branch refs\/heads\/v-next$/ && path != current {
      print path
      found = 1
      exit
    }
    /^$/ {
      if (path != "" && path != current && fallback == "") {
        fallback = path
      }
      path = ""
    }
    END {
      if (!found && fallback != "") {
        print fallback
      }
    }
  '
}

# Creates <primary>/.turbo if missing, then copies it into the current worktree
# so concurrent worktrees have isolated turbo caches and logs.
copy_shared_path() {
  local source_root="$1"
  local path_name="$2"
  local create_source="${3:-false}"
  local source_path="$source_root/$path_name"

  [[ -n "$source_root" && -d "$source_root" ]] || return 0

  if [[ "$create_source" == "true" && ! -e "$source_path" ]]; then
    mkdir -p "$source_path"
  fi

  if [[ -e "$source_path" && ! -e "$path_name" ]]; then
    cp -r "$source_path" "$path_name"
    echo "setup-worktree: copied $source_path -> $path_name"
  fi
}

primary_checkout="$(find_primary_checkout)"
if [[ -n "$primary_checkout" ]]; then
  copy_shared_path "$primary_checkout" ".turbo" true
fi

pnpm install --frozen-lockfile --prefer-offline

echo "pnpm store: $(pnpm store path)"
