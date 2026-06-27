#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=.codex/cloud-env-common.sh
. "$SCRIPT_DIR/cloud-env-common.sh"

cd "$REPO_ROOT"

load_node_runtime
pnpm install --frozen-lockfile --prefer-offline

node --version
pnpm --version
pnpm store path
