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
#   ./setup-mailcow.sh              # Interactive first-time setup
#   ./setup-mailcow.sh --apply      # Non-interactive reconfigure + restart
#   ./setup-mailcow.sh --status     # Just show status, no changes
#   ./setup-mailcow.sh --nuke       # Remove Mailcow completely
#
# =============================================================================

set -euo pipefail

# ─────────────────────────────────────────────────────────────────────────────
# Configuration (edit these if needed)
# ─────────────────────────────────────────────────────────────────────────────
DOMAIN="gametaverns.com"
MAIL_HOSTNAME="mail.$DOMAIN"
MAILCOW_DIR="/opt/mailcow"
HTTP_PORT="8080"
HTTPS_PORT="8443"
TIMEZONE="${TZ:-America/New_York}"

# External SSL certificate paths (Cloudflare Origin or Let's Encrypt)
SSL_CERT_DIR="/etc/ssl/cloudflare"
SSL_CERT_FILE="$SSL_CERT_DIR/origin.pem"
SSL_KEY_FILE="$SSL_CERT_DIR/origin.key"

# ─────────────────────────────────────────────────────────────────────────────
# Colors & helpers
# ─────────────────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; NC='\033[0m'

info()  { echo -e "${BLUE}[INFO]${NC} $*"; }
ok()    { echo -e "${GREEN}[OK]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
err()   { echo -e "${RED}[ERROR]${NC} $*"; }
die()   { err "$*"; exit 1; }

# ─────────────────────────────────────────────────────────────────────────────
# Root check
# ─────────────────────────────────────────────────────────────────────────────
[[ "$EUID" -eq 0 ]] || die "Run as root: sudo $0"

# ─────────────────────────────────────────────────────────────────────────────
# Parse arguments
# ─────────────────────────────────────────────────────────────────────────────
MODE="interactive"
while [[ $# -gt 0 ]]; do
    case "$1" in
        --apply)  MODE="apply"; shift ;;
        --status) MODE="status"; shift ;;
        --nuke)   MODE="nuke"; shift ;;
        -h|--help)
            echo "Usage: $0 [--apply|--status|--nuke]"
            echo "  (no args)  Interactive first-time setup"
            echo "  --apply    Non-interactive reconfigure + restart"
            echo "  --status   Show current status only"
            echo "  --nuke     Remove Mailcow completely"
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
# Nuke mode
# ─────────────────────────────────────────────────────────────────────────────
if [[ "$MODE" == "nuke" ]]; then
    warn "This will COMPLETELY REMOVE Mailcow and all its data!"
    read -p "Type 'DELETE' to confirm: " CONFIRM
    [[ "$CONFIRM" == "DELETE" ]] || die "Aborted"

    if [[ -d "$MAILCOW_DIR" ]]; then
        cd "$MAILCOW_DIR"
        docker compose down --volumes --remove-orphans 2>/dev/null || true
        cd /
        rm -rf "$MAILCOW_DIR"
        ok "Mailcow removed"
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
    ok "External SSL certs found at $SSL_CERT_DIR"
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
if [[ "$FRESH_INSTALL" == true ]] || [[ ! -f mailcow.conf ]]; then
    info "Generating initial Mailcow config..."

    # Mailcow's generate_config.sh is interactive. We pipe answers.
    # Order: hostname, timezone, branch (1=master), docker daemon.json (y)
    {
        echo "$MAIL_HOSTNAME"
        echo "$TIMEZONE"
        echo "1"
        echo "y"
    } | ./generate_config.sh || true

    ok "Initial config generated"
fi

# ─────────────────────────────────────────────────────────────────────────────
# Apply idempotent configuration
# ─────────────────────────────────────────────────────────────────────────────
info "Applying configuration..."

# Function to set a config value idempotently
set_config() {
    local key="$1"
    local value="$2"
    # Remove ALL existing lines for this key (commented or not)
    sed -i "/^#*${key}=/d" mailcow.conf
    # Append the new value
    echo "${key}=${value}" >> mailcow.conf
}

# Core settings
set_config "MAILCOW_HOSTNAME" "$MAIL_HOSTNAME"
set_config "TZ" "$TIMEZONE"

# Port bindings (loopback for nginx proxy)
set_config "HTTP_PORT" "$HTTP_PORT"
set_config "HTTPS_PORT" "$HTTPS_PORT"
set_config "HTTP_BIND" "127.0.0.1"
set_config "HTTPS_BIND" "127.0.0.1"

# Disable Mailcow's internal ACME - we use external certs
set_config "SKIP_LETS_ENCRYPT" "y"
set_config "SKIP_SOGO" "n"
set_config "SKIP_CLAMD" "n"

# Secure the config file
chmod 600 mailcow.conf

ok "Config applied:"
grep -E "^(MAILCOW_HOSTNAME|TZ|HTTP_PORT|HTTPS_PORT|HTTP_BIND|HTTPS_BIND|SKIP_LETS_ENCRYPT)=" mailcow.conf | sed 's/^/  /'

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
# Remove any docker-compose.override.yml (causes subnet issues)
# ─────────────────────────────────────────────────────────────────────────────
rm -f docker-compose.override.yml

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