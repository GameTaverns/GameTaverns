#!/bin/bash
set -euo pipefail

# Shared helpers for Mailcow scripts.

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; NC='\033[0m'

mc_info()  { echo -e "${BLUE}[INFO]${NC} $*"; }
mc_ok()    { echo -e "${GREEN}[OK]${NC} $*"; }
mc_warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
mc_err()   { echo -e "${RED}[ERROR]${NC} $*"; }
mc_die()   { mc_err "$*"; exit 1; }

mc_backup_file() {
  local file="$1"
  if [[ -f "$file" ]]; then
    local ts
    ts="$(date +%Y%m%d-%H%M%S)"
    cp -a "$file" "${file}.bak.${ts}"
  fi
}

# Set KEY=value idempotently (remove any existing KEY= or #KEY= lines).
mc_set_config() {
  local conf="$1"
  local key="$2"
  local value="$3"
  sed -i "/^#*${key}=/d" "$conf"
  echo "${key}=${value}" >> "$conf"
}

# Like mc_set_config, but does NOT overwrite if the key already exists.
mc_set_config_if_missing() {
  local conf="$1"
  local key="$2"
  local value="$3"
  if grep -Eq "^${key}=" "$conf" 2>/dev/null; then
    return 0
  fi
  echo "${key}=${value}" >> "$conf"
}

# Create a docker-compose.override.yml that forces loopback port bindings for nginx-mailcow.
# This prevents generate_config.sh / updates from reverting bindings.
mc_write_loopback_override() {
  local dir="$1"
  local http_port="$2"
  local https_port="$3"

  cat > "${dir}/docker-compose.override.yml" <<EOF
services:
  nginx-mailcow:
    ports:
      - "127.0.0.1:${http_port}:80"
      - "127.0.0.1:${https_port}:443"
EOF
}
