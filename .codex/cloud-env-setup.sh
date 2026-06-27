#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=.codex/cloud-env-common.sh
. "$SCRIPT_DIR/cloud-env-common.sh"

install_package_manager
install_node_runtime
persist_node_runtime

node --version
npm --version
