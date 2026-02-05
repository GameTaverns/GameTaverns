#!/bin/bash
# =============================================================================
# Mailcow One-Command Setup Script for GameTaverns
# Domain: gametaverns.com
# Version: 2.0.0
#
# IDEMPOTENT: Safe to run multiple times. Handles:
#   ✓ Fresh install (clone + configure + start)
#   ✓ Reconfigure existing install (update config + restart)
#   ✓ External SSL certs (Cloudflare Origin mounted from host)
#   ✓ Loopback binding (127.0.0.1:8080/8443) for host nginx proxy
#
# Usage:
#   ./setup-mailcow.sh                # Interactive first-time setup
#   ./setup-mailcow.sh --apply        # Non-interactive reconfigure + restart
#   ./setup-mailcow.sh --status       # Just show status, no changes
#   ./setup-mailcow.sh --nuke         # Remove Mailcow completely (keeps volumes)
#   ./setup-mailcow.sh --nuke-all     # Remove Mailcow completely INCLUDING volumes
#
# =============================================================================

set -euo pipefail

# Shared helpers (kept separate so this script can stay readable)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/mailcow/_lib.sh"

# ─────────────────────────────────────────────────────────────────────────────
# Configuration (edit these if needed)
# ─────────────────────────────────────────────────────────────────────────────
DOMAIN="gametaverns.com"
MAIL_HOSTNAME="mail.$DOMAIN"
MAILCOW_DIR="/opt/mailcow"
HTTP_PORT="18880"
HTTPS_PORT="18443"
TIMEZONE="${TZ:-America/New_York}"

# Strict port policy: fail if these ports are busy (no auto-pick)
STRICT_PORTS="true"

# External SSL certificate paths (Cloudflare Origin or Let's Encrypt)
# Prefer domain-named certs if present (common with Cloudflare Origin cert installs).
SSL_CERT_DIR="/etc/ssl/cloudflare"
SSL_CERT_FILE_DEFAULT="$SSL_CERT_DIR/origin.pem"
SSL_KEY_FILE_DEFAULT="$SSL_CERT_DIR/origin.key"

# Your server currently uses these names:
#   /etc/ssl/cloudflare/gametaverns.com.pem
#   /etc/ssl/cloudflare/gametaverns.com.key
SSL_CERT_FILE_DOMAIN="$SSL_CERT_DIR/${DOMAIN}.pem"
SSL_KEY_FILE_DOMAIN="$SSL_CERT_DIR/${DOMAIN}.key"

SSL_CERT_FILE="$SSL_CERT_FILE_DEFAULT"
SSL_KEY_FILE="$SSL_KEY_FILE_DEFAULT"

if [[ -f "$SSL_CERT_FILE_DOMAIN" && -f "$SSL_KEY_FILE_DOMAIN" ]]; then
    SSL_CERT_FILE="$SSL_CERT_FILE_DOMAIN"
    SSL_KEY_FILE="$SSL_KEY_FILE_DOMAIN"
fi

# ─────────────────────────────────────────────────────────────────────────────
# Colors & helpers are sourced from mailcow/_lib.sh
info()  { mc_info "$@"; }
ok()    { mc_ok "$@"; }
warn()  { mc_warn "$@"; }
err()   { mc_err "$@"; }
die()   { mc_die "$@"; }

# ─────────────────────────────────────────────────────────────────────────────
# Root check
# ─────────────────────────────────────────────────────────────────────────────
[[ "$EUID" -eq 0 ]] || die "Run as root: sudo $0"

# ─────────────────────────────────────────────────────────────────────────────
# Parse arguments
# ─────────────────────────────────────────────────────────────────────────────
MODE="interactive"
REGEN_CONFIG="false"
while [[ $# -gt 0 ]]; do
    case "$1" in
        --apply)  MODE="apply"; shift ;;
        --status) MODE="status"; shift ;;
        --nuke)   MODE="nuke"; shift ;;
        --nuke-all) MODE="nuke-all"; shift ;;
        --regen-config) REGEN_CONFIG="true"; shift ;;
        -h|--help)
            echo "Usage: $0 [--apply|--status|--nuke|--nuke-all]"
            echo "  (no args)  Interactive first-time setup"
            echo "  --apply    Non-interactive reconfigure + restart"
            echo "  --status   Show current status only"
            echo "  --nuke     Remove Mailcow containers (keeps volumes)"
            echo "  --nuke-all Remove Mailcow completely INCLUDING volumes"
            echo "  --regen-config  Force running ./generate_config.sh even if mailcow.conf exists"
            exit 0 ;;
        *) die "Unknown option: $1" ;;
    esac
done

# ─────────────────────────────────────────────────────────────────────────────
# Status mode
# ─────────────────────────────────────────────────────────────────────────────
show_status() {
    echo ""
    echo -e "${CYAN}═══════════════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}  Mailcow Status: $MAIL_HOSTNAME${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════════════════${NC}"
    echo ""

    if [[ ! -d "$MAILCOW_DIR" ]]; then
        warn "Mailcow not installed at $MAILCOW_DIR"
        return 1
    fi

    cd "$MAILCOW_DIR"

    # Config summary
    info "Configuration:"
    grep -E "^(MAILCOW_HOSTNAME|TZ|HTTP_PORT|HTTPS_PORT|HTTP_BIND|HTTPS_BIND|SKIP_LETS_ENCRYPT)=" mailcow.conf 2>/dev/null | sed 's/^/  /'

    echo ""
    info "Containers:"
    docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null | head -20

    echo ""
    info "Port bindings:"
    docker compose ps --format "{{.Ports}}" 2>/dev/null | tr ',' '\n' | grep -E "^\d|^127" | sort -u | head -10

    echo ""
    info "SSL certificate status:"
    if [[ -f "$SSL_CERT_FILE" ]]; then
        EXPIRY=$(openssl x509 -enddate -noout -in "$SSL_CERT_FILE" 2>/dev/null | cut -d= -f2)
        ok "External cert: $SSL_CERT_FILE (expires: $EXPIRY)"
    else
        warn "No external cert at $SSL_CERT_FILE"
    fi

    # Check if Mailcow's internal cert exists
    if [[ -f "$MAILCOW_DIR/data/assets/ssl/cert.pem" ]]; then
        INTERNAL_EXPIRY=$(openssl x509 -enddate -noout -in "$MAILCOW_DIR/data/assets/ssl/cert.pem" 2>/dev/null | cut -d= -f2)
        info "Internal cert: $MAILCOW_DIR/data/assets/ssl/cert.pem (expires: $INTERNAL_EXPIRY)"
    fi

    echo ""
    return 0
}

if [[ "$MODE" == "status" ]]; then
    show_status
    exit $?
fi

# ─────────────────────────────────────────────────────────────────────────────
# Nuke mode (containers only, keeps volumes)
# ─────────────────────────────────────────────────────────────────────────────
if [[ "$MODE" == "nuke" ]]; then
    warn "This will remove Mailcow containers and config but KEEP volumes (mail data)."
    read -p "Type 'REMOVE' to confirm: " CONFIRM
    [[ "$CONFIRM" == "REMOVE" ]] || die "Aborted"

    if [[ -d "$MAILCOW_DIR" ]]; then
        cd "$MAILCOW_DIR"
        docker compose down --remove-orphans 2>/dev/null || true
        cd /
        rm -rf "$MAILCOW_DIR"
        ok "Mailcow containers removed (volumes preserved)"
    else
        info "Mailcow not installed"
    fi
    exit 0
fi

# ─────────────────────────────────────────────────────────────────────────────
# Nuke-all mode (containers + volumes)
# ─────────────────────────────────────────────────────────────────────────────
if [[ "$MODE" == "nuke-all" ]]; then
    warn "This will COMPLETELY REMOVE Mailcow containers AND volumes (all mail data)!"
    read -p "Type 'DELETE' to confirm: " CONFIRM
    [[ "$CONFIRM" == "DELETE" ]] || die "Aborted"

    if [[ -d "$MAILCOW_DIR" ]]; then
        cd "$MAILCOW_DIR"
        docker compose down --volumes --remove-orphans 2>/dev/null || true
        # Also remove any orphaned networks
        docker network rm mailcowdockerized_mailcow-network 2>/dev/null || true
        cd /
        rm -rf "$MAILCOW_DIR"
        ok "Mailcow completely removed (containers + volumes)"
    else
        info "Mailcow not installed"
    fi
    exit 0
fi

# ─────────────────────────────────────────────────────────────────────────────
# Pre-flight checks
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  Mailcow Setup: $MAIL_HOSTNAME${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════════${NC}"
echo ""

command -v docker &>/dev/null || die "Docker not installed. Run bootstrap.sh first."
command -v git &>/dev/null || die "Git not installed."

# ─────────────────────────────────────────────────────────────────────────────
# STRICT PORT CHECK: Fail immediately if ports are busy
# ─────────────────────────────────────────────────────────────────────────────
if [[ "$STRICT_PORTS" == "true" ]]; then
    info "Checking if fixed ports $HTTP_PORT and $HTTPS_PORT are available on 127.0.0.1..."
    
    PORT_CONFLICT=false
    for port in $HTTP_PORT $HTTPS_PORT; do
        # ss output formatting varies; match by word boundary instead of a trailing space.
        if ss -tlnp | grep -Eq "127\.0\.0\.1:${port}\\b"; then
            OWNER=$(ss -tlnp | grep -E "127\.0\.0\.1:${port}\\b" | head -1 | awk '{print $NF}')
            if [[ "$OWNER" != *"nginx-mailcow"* ]]; then
                err "Port 127.0.0.1:$port is already in use by: ${OWNER:-unknown}"
                err "Find the owning process with: ss -tlnp | grep -E '127\\.0\\.0\\.1:${port}\\b'"
                PORT_CONFLICT=true
            fi
        fi
    done
    
    if [[ "$PORT_CONFLICT" == "true" ]]; then
        echo ""
        err "Cannot proceed: fixed loopback ports are busy."
        echo ""
        echo "Options:"
        echo "  1. Free the ports by stopping the conflicting service"
        echo "  2. Edit HTTP_PORT/HTTPS_PORT in this script to use different ports"
        echo ""
        echo "To find what's using the ports:"
        echo "  ss -tlnp | grep -E '127\\.0\\.0\\.1:($HTTP_PORT|$HTTPS_PORT)\\b'"
        echo ""
        die "Port conflict detected. Fix manually before re-running."
    fi
    
    ok "Ports 127.0.0.1:$HTTP_PORT and 127.0.0.1:$HTTPS_PORT are available"
fi

# ─────────────────────────────────────────────────────────────────────────────
# FIX: Docker network overlap issue
# ─────────────────────────────────────────────────────────────────────────────
info "Fixing Docker network overlap issue..."

# 1. Configure Docker daemon with safe default address pools
mc_configure_docker_address_pools
systemctl restart docker 2>/dev/null || true
sleep 3

# 2. Remove the specific conflicting Mailcow network if it exists
mc_remove_network "mailcowdockerized_mailcow-network"

# Check mail ports (only if fresh install)
if [[ ! -d "$MAILCOW_DIR" ]]; then
    info "Checking mail ports..."
    for port in 25 587 993 995 4190; do
        if ss -tlnp | grep -q ":$port "; then
            die "Port $port already in use. Stop conflicting service first."
        fi
    done
    ok "All mail ports available"
fi

# Check external SSL certs
if [[ -f "$SSL_CERT_FILE" && -f "$SSL_KEY_FILE" ]]; then
    ok "External SSL certs found:"
    echo "  cert: $SSL_CERT_FILE"
    echo "  key:  $SSL_KEY_FILE"
    USE_EXTERNAL_SSL=true
else
    warn "No external SSL certs at $SSL_CERT_DIR - Mailcow will use snake-oil certs"
    USE_EXTERNAL_SSL=false
fi

# ─────────────────────────────────────────────────────────────────────────────
# Clone if needed
# ─────────────────────────────────────────────────────────────────────────────
if [[ ! -d "$MAILCOW_DIR" ]]; then
    info "Cloning Mailcow..."
    git clone https://github.com/mailcow/mailcow-dockerized "$MAILCOW_DIR"
    ok "Cloned to $MAILCOW_DIR"
    FRESH_INSTALL=true
else
    info "Mailcow already installed at $MAILCOW_DIR"
    FRESH_INSTALL=false
fi

cd "$MAILCOW_DIR"

# ─────────────────────────────────────────────────────────────────────────────
# Generate or update config
# ─────────────────────────────────────────────────────────────────────────────
if [[ ! -f mailcow.conf ]]; then
    info "mailcow.conf missing; generating initial Mailcow config..."
    {
        echo "$MAIL_HOSTNAME"
        echo "$TIMEZONE"
        echo "1"
        echo "y"
    } | ./generate_config.sh || true
    ok "Initial config generated"
elif [[ "$REGEN_CONFIG" == "true" ]]; then
    warn "Forcing config regeneration (--regen-config). This can overwrite tokens if you set them manually afterward."
    mc_backup_file "mailcow.conf"
    {
        echo "$MAIL_HOSTNAME"
        echo "$TIMEZONE"
        echo "1"
        echo "y"
    } | ./generate_config.sh || true
    ok "Config regenerated"
else
    info "mailcow.conf exists; skipping generate_config.sh to avoid wiping existing settings"
fi

# ─────────────────────────────────────────────────────────────────────────────
# Apply idempotent configuration
# ─────────────────────────────────────────────────────────────────────────────
info "Applying configuration..."

mc_backup_file "mailcow.conf"

# Core settings
mc_set_config "mailcow.conf" "MAILCOW_HOSTNAME" "$MAIL_HOSTNAME"
mc_set_config "mailcow.conf" "TZ" "$TIMEZONE"

# Port bindings (loopback for host nginx proxy)
mc_set_config "mailcow.conf" "HTTP_PORT" "$HTTP_PORT"
mc_set_config "mailcow.conf" "HTTPS_PORT" "$HTTPS_PORT"
mc_set_config "mailcow.conf" "HTTP_BIND" "127.0.0.1"
mc_set_config "mailcow.conf" "HTTPS_BIND" "127.0.0.1"

# SSL behavior
# If you have a Cloudflare Origin cert on the host, we keep Mailcow ACME disabled.
# IMPORTANT: We do NOT run generate_config.sh by default anymore, so these values won't be "reset".
mc_set_config "mailcow.conf" "SKIP_LETS_ENCRYPT" "y"

# Preserve existing Cloudflare token settings if you previously configured DNS-01 in Mailcow.
# We intentionally do NOT overwrite these to avoid the “rerun erased my token” loop.
mc_set_config_if_missing "mailcow.conf" "DNS_CHALLENGE" "cloudflare"
mc_set_config_if_missing "mailcow.conf" "CF_API_TOKEN" ""

mc_set_config "mailcow.conf" "SKIP_SOGO" "n"
mc_set_config "mailcow.conf" "SKIP_CLAMD" "n"

# Pin Mailcow to an explicit subnet to avoid future collisions
mc_pin_subnet "mailcow.conf" "172.29.0.0/24"

# Secure the config file
chmod 600 mailcow.conf

ok "Config applied:"
grep -E "^(MAILCOW_HOSTNAME|TZ|HTTP_PORT|HTTPS_PORT|HTTP_BIND|HTTPS_BIND|SKIP_LETS_ENCRYPT)=" mailcow.conf | sed 's/^/  /'

# Make loopback web bindings sticky even if Mailcow regenerates docker-compose.yml later.
info "Ensuring sticky loopback port bindings via docker-compose.override.yml..."
mc_write_loopback_override "$MAILCOW_DIR" "$HTTP_PORT" "$HTTPS_PORT"
ok "Override written: $MAILCOW_DIR/docker-compose.override.yml"

# ─────────────────────────────────────────────────────────────────────────────
# Mount external SSL certs
# ─────────────────────────────────────────────────────────────────────────────
if [[ "$USE_EXTERNAL_SSL" == true ]]; then
    info "Installing external SSL certificates..."

    mkdir -p "$MAILCOW_DIR/data/assets/ssl"

    # Copy (not symlink) to avoid Docker mount issues
    cp "$SSL_CERT_FILE" "$MAILCOW_DIR/data/assets/ssl/cert.pem"
    cp "$SSL_KEY_FILE" "$MAILCOW_DIR/data/assets/ssl/key.pem"
    chmod 600 "$MAILCOW_DIR/data/assets/ssl/key.pem"

    ok "SSL certs installed to $MAILCOW_DIR/data/assets/ssl/"
fi

# ─────────────────────────────────────────────────────────────────────────────
# Keep docker-compose.override.yml (we use it to enforce loopback web bindings)
# NOTE: We only write service ports in the override (no networks), so it won't create subnet overlap.

# ─────────────────────────────────────────────────────────────────────────────
# Stop, pull, start
# ─────────────────────────────────────────────────────────────────────────────
info "Stopping existing containers..."
docker compose down --remove-orphans 2>/dev/null || true

info "Pulling latest images..."
docker compose pull --quiet

info "Starting Mailcow..."
docker compose up -d

# ─────────────────────────────────────────────────────────────────────────────
# Wait and verify
# ─────────────────────────────────────────────────────────────────────────────
info "Waiting for services to start (30s)..."
sleep 30

echo ""
info "Container status:"
docker compose ps --format "table {{.Name}}\t{{.Status}}" | head -20

# Count healthy/running
RUNNING=$(docker compose ps --format "{{.State}}" 2>/dev/null | grep -c "running" || echo "0")
TOTAL=$(docker compose ps --format "{{.Name}}" 2>/dev/null | wc -l)

echo ""
if [[ "$RUNNING" -ge 15 ]]; then
    ok "Mailcow running: $RUNNING/$TOTAL containers"
else
    warn "Only $RUNNING/$TOTAL containers running. Some may still be starting."
    info "Check with: cd $MAILCOW_DIR && docker compose ps"
fi

# ─────────────────────────────────────────────────────────────────────────────
# Final summary
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  Mailcow Setup Complete!${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${GREEN}Access:${NC}"
echo "  Admin UI:  https://$MAIL_HOSTNAME  (via host nginx proxy)"
echo "  Direct:    https://127.0.0.1:$HTTPS_PORT  (from server only)"
echo ""
echo -e "${GREEN}Default Login:${NC}"
echo "  Username:  admin"
echo "  Password:  moohoo  ${RED}<- CHANGE THIS IMMEDIATELY${NC}"
echo ""
echo -e "${GREEN}SMTP Settings for GameTaverns:${NC}"
echo "  Host:      $MAIL_HOSTNAME (or smtp.$DOMAIN)"
echo "  Port:      587 (STARTTLS)"
echo "  User:      noreply@$DOMAIN"
echo "  Pass:      (create in Mailcow admin)"
echo ""
echo -e "${GREEN}Commands:${NC}"
echo "  Status:    $0 --status"
echo "  Reconfigure: $0 --apply"
echo "  Logs:      cd $MAILCOW_DIR && docker compose logs -f"
echo "  Remove:    $0 --nuke"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "  1. Ensure host nginx proxies mail.$DOMAIN -> 127.0.0.1:$HTTPS_PORT"
echo "  2. Login to Mailcow admin and change password"
echo "  3. Add domain: $DOMAIN"
echo "  4. Create mailbox: noreply@$DOMAIN"
echo "  5. Copy DKIM key to DNS"
echo ""