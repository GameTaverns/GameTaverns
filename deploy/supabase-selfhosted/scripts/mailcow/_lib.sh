# Ensure Docker default-address-pools avoid common collision ranges.
mc_configure_docker_address_pools() {
  local daemon_json="/etc/docker/daemon.json"
  mc_info "Configuring Docker default-address-pools in $daemon_json..."

  if [[ ! -f "$daemon_json" ]]; then
    # No file yet — create minimal one
    cat > "$daemon_json" <<'ENDJSON'
{
  "default-address-pools": [
    { "base": "172.24.0.0/13", "size": 24 }
  ]
}
ENDJSON
    mc_ok "Created $daemon_json with safe address pool"
    return 0
  fi

  # File exists — check if default-address-pools already present
  if grep -q '"default-address-pools"' "$daemon_json"; then
    mc_info "default-address-pools already configured in $daemon_json"
    return 0
  fi

  # Insert before the last closing brace
  mc_backup_file "$daemon_json"
  sed -i 's/}$/,\n  "default-address-pools": [\n    { "base": "172.24.0.0\/13", "size": 24 }\n  ]\n}/' "$daemon_json"
  mc_ok "Appended default-address-pools to $daemon_json"
}

# Remove a specific Docker network (and any stale containers using it).
mc_remove_network() {
  local net="$1"
  if docker network ls --format '{{.Name}}' | grep -q "^${net}$"; then
    mc_info "Removing Docker network: $net"
    # Disconnect any containers still attached
    for cid in $(docker network inspect "$net" --format '{{range .Containers}}{{.Name}} {{end}}' 2>/dev/null); do
      docker network disconnect -f "$net" "$cid" 2>/dev/null || true
    done
    docker network rm "$net" 2>/dev/null || true
    mc_ok "Removed network: $net"
  fi
}

# Pin Mailcow to an explicit subnet in mailcow.conf.
mc_pin_subnet() {
  local conf="$1"
  local ipv4_net="$2"   # e.g. 172.29.0.0/24
  local base="${ipv4_net%/*}" # 172.29.0.0

  # Mailcow expects IPV4_NETWORK as a /24 "prefix" without the last octet.
  # It will append ".0/24" internally. If we set 172.29.0.0, it becomes 172.29.0.0.0/24 (invalid).
  # Therefore: 172.29.0.0/24 -> IPV4_NETWORK=172.29.0
  local prefix3
  prefix3="$(echo "$base" | awk -F. '{print $1"."$2"."$3}')"

  mc_set_config "$conf" "IPV4_NETWORK" "$prefix3"
  mc_ok "Pinned Mailcow IPv4 subnet to ${prefix3}.0/24 via IPV4_NETWORK=${prefix3}"
}

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
