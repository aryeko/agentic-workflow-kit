#!/usr/bin/env bash

CODEX_CLOUD_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$CODEX_CLOUD_DIR/.." && pwd)"
REPO_PARENT="$(cd "$REPO_ROOT/.." && pwd)"

CLOUD_HOME="${CLOUD_HOME:-$HOME}"
SHELL_RC="${SHELL_RC:-$CLOUD_HOME/.bashrc}"
NVM_DIR="${NVM_DIR:-$REPO_PARENT/.nvm}"
NODE_MAJOR="${NODE_MAJOR:-24}"
NVM_BOOTSTRAP="export NVM_DIR=\"$NVM_DIR\"; [ -s \"\$NVM_DIR/nvm.sh\" ] && . \"\$NVM_DIR/nvm.sh\"; nvm use $NODE_MAJOR >/dev/null"

export NVM_DIR

install_node_runtime() {
  if [[ ! -s "$NVM_DIR/nvm.sh" ]]; then
    curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
  fi

  # shellcheck source=/dev/null
  . "$NVM_DIR/nvm.sh"
  nvm install "$NODE_MAJOR"
  nvm alias default "$NODE_MAJOR"
  nvm use "$NODE_MAJOR"
}

install_package_manager() {
  cd "$REPO_ROOT"
  deactivate_nvm_for_package_manager
  corepack enable
  corepack install
}

persist_node_runtime() {
  grep -qxF "$NVM_BOOTSTRAP" "$SHELL_RC" 2>/dev/null || echo "$NVM_BOOTSTRAP" >> "$SHELL_RC"
}

load_node_runtime() {
  # shellcheck source=/dev/null
  . "$NVM_DIR/nvm.sh"
  nvm use "$NODE_MAJOR"
}

deactivate_nvm_for_package_manager() {
  if [[ -n "${NVM_BIN:-}" && -s "$NVM_DIR/nvm.sh" ]]; then
    # shellcheck source=/dev/null
    . "$NVM_DIR/nvm.sh"
    nvm deactivate >/dev/null 2>&1 || true
  fi
}
