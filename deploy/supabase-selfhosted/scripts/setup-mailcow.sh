#!/bin/bash
# =============================================================================
# Mailcow Automated Installation Script for GameTaverns
# Domain: gametaverns.com (hardcoded)
# Version: 1.0.0
# 
# This script automates the Mailcow installation with correct configuration:
#   ✓ Clones Mailcow repository
#   ✓ Generates config with correct hostname
#   ✓ Configures non-conflicting ports (8080/8443)
#   ✓ Sets dedicated Docker subnet to avoid overlap
#   ✓ Starts Mailcow stack
#
# Prerequisites:
#   - clean-install.sh or nuclear-reset.sh has been run
#   - Docker and Docker Compose installed
#   - DNS configured for mail.gametaverns.com
# =============================================================================

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration
DOMAIN="gametaverns.com"
MAIL_HOSTNAME="mail.$DOMAIN"
MAILCOW_DIR="/opt/mailcow"
MAILCOW_HTTP_PORT="8080"
MAILCOW_HTTPS_PORT="8443"
MAILCOW_SUBNET="172.29.0.0/16"

echo ""
echo -e "${CYAN}╔═══════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║         Mailcow Automated Installation                            ║${NC}"
echo -e "${CYAN}║         Domain: $MAIL_HOSTNAME                            ║${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Please run as root: sudo ./setup-mailcow.sh${NC}"
    exit 1
fi

# Check Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Docker not installed. Run bootstrap.sh first.${NC}"
    exit 1
fi

# ===========================================
# Step 1: Pre-flight checks
# ===========================================
echo -e "${BLUE}[1/6] Pre-flight checks...${NC}"

# Check if Mailcow already installed
if [ -d "$MAILCOW_DIR" ]; then
    echo -e "${YELLOW}Mailcow directory already exists at $MAILCOW_DIR${NC}"
    read -p "Remove and reinstall? (y/N): " REINSTALL
    if [[ "$REINSTALL" =~ ^[Yy]$ ]]; then
        cd "$MAILCOW_DIR" && docker compose down --volumes 2>/dev/null || true
        rm -rf "$MAILCOW_DIR"
    else
        echo "Skipping Mailcow installation. Directory preserved."
        exit 0
    fi
fi

# Check for port conflicts
PORTS_TO_CHECK="25 587 993 995 4190"
for port in $PORTS_TO_CHECK; do
    if lsof -i :$port > /dev/null 2>&1; then
        PROCESS=$(lsof -i :$port -t | head -1)
        PNAME=$(ps -p $PROCESS -o comm= 2>/dev/null || echo "unknown")
        echo -e "${RED}Port $port is in use by $PNAME (PID: $PROCESS)${NC}"
        echo "Run clean-install.sh or nuclear-reset.sh first."
        exit 1
    fi
done

echo -e "${GREEN}✓ All mail ports available${NC}"

# Check DNS
echo -e "${BLUE}[2/6] Checking DNS...${NC}"
if command -v host &>/dev/null; then
    if host "$MAIL_HOSTNAME" > /dev/null 2>&1; then
        RESOLVED_IP=$(host "$MAIL_HOSTNAME" | grep -oP '\d+\.\d+\.\d+\.\d+' | head -1)
        echo -e "${GREEN}✓ $MAIL_HOSTNAME resolves to $RESOLVED_IP${NC}"
    else
        echo -e "${YELLOW}⚠ $MAIL_HOSTNAME does not resolve yet${NC}"
        echo "Mailcow will work locally but SSL may fail."
        read -p "Continue anyway? (y/N): " CONTINUE
        [[ ! "$CONTINUE" =~ ^[Yy]$ ]] && exit 1
    fi
fi

# ===========================================
# Step 2: Clone Mailcow
# ===========================================
echo -e "${BLUE}[3/6] Cloning Mailcow...${NC}"

cd /opt
git clone https://github.com/mailcow/mailcow-dockerized "$MAILCOW_DIR"
cd "$MAILCOW_DIR"

echo -e "${GREEN}✓ Mailcow cloned${NC}"

# ===========================================
# Step 3: Generate Configuration
# ===========================================
echo -e "${BLUE}[4/6] Generating Mailcow configuration...${NC}"

# Get timezone
TIMEZONE=$(cat /etc/timezone 2>/dev/null || echo "UTC")

# Generate config non-interactively
export MAILCOW_HOSTNAME="$MAIL_HOSTNAME"
export MAILCOW_TZ="$TIMEZONE"

# Run generate_config.sh with answers piped in
# Prompts in order:
#   1. Mail server hostname (mail.gametaverns.com)
#   2. Timezone (from /etc/timezone)
#   3. Branch selection (1 = master, default)
#   4. Docker daemon.json creation (y = yes)
./generate_config.sh << EOF
$MAIL_HOSTNAME
$TIMEZONE
1
y
EOF

# Modify mailcow.conf for non-conflicting ports
# Use more robust sed patterns that handle comments and spaces
echo -e "${BLUE}Configuring ports to avoid conflicts with host nginx...${NC}"

# Remove any existing port/bind settings (commented or not) and append correct ones
sed -i '/^#*\s*HTTP_PORT=/d' mailcow.conf
sed -i '/^#*\s*HTTPS_PORT=/d' mailcow.conf
sed -i '/^#*\s*HTTP_BIND=/d' mailcow.conf
sed -i '/^#*\s*HTTPS_BIND=/d' mailcow.conf

# Append the correct settings
cat >> mailcow.conf << PORTCONF

# GameTaverns: Use non-standard ports to avoid conflict with host nginx
HTTP_PORT=$MAILCOW_HTTP_PORT
HTTPS_PORT=$MAILCOW_HTTPS_PORT
HTTP_BIND=127.0.0.1
HTTPS_BIND=127.0.0.1
PORTCONF

echo -e "${GREEN}✓ Ports configured: HTTP=$MAILCOW_HTTP_PORT, HTTPS=$MAILCOW_HTTPS_PORT${NC}"

# ===========================================
# Step 4: Fix Docker Network Overlap
# ===========================================
echo -e "${BLUE}[5/6] Configuring dedicated Docker network...${NC}"

cat > docker-compose.override.yml << EOF
# Custom network to avoid subnet conflicts with GameTaverns
# Using dedicated subnet: $MAILCOW_SUBNET
networks:
  mailcow-network:
    driver: bridge
    driver_opts:
      com.docker.network.bridge.name: br-mailcow
    ipam:
      driver: default
      config:
        - subnet: $MAILCOW_SUBNET
EOF

echo -e "${GREEN}✓ Docker network configured with subnet $MAILCOW_SUBNET${NC}"

# ===========================================
# Step 5: Start Mailcow
# ===========================================
echo -e "${BLUE}[6/6] Starting Mailcow stack...${NC}"

docker compose pull
docker compose up -d

echo ""
echo -e "${YELLOW}Waiting for Mailcow to initialize (this takes 2-3 minutes)...${NC}"

# Wait for containers to start
sleep 30

# Check container count
RUNNING_CONTAINERS=$(docker compose ps --format "{{.State}}" | grep -c "running" || echo "0")
TOTAL_CONTAINERS=$(docker compose ps --format "{{.Name}}" | wc -l)

echo "Containers running: $RUNNING_CONTAINERS / $TOTAL_CONTAINERS"

if [ "$RUNNING_CONTAINERS" -lt 10 ]; then
    echo -e "${YELLOW}Some containers may still be starting. Waiting longer...${NC}"
    sleep 60
fi

# Final status
docker compose ps

echo ""
echo -e "${CYAN}╔═══════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║         Mailcow Installation Complete!                            ║${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}Mailcow is now running!${NC}"
echo ""
echo -e "${BLUE}Access Points:${NC}"
echo "  Admin UI:   https://$MAIL_HOSTNAME (proxied through host nginx)"
echo "  Direct:     https://localhost:$MAILCOW_HTTPS_PORT"
echo ""
echo -e "${BLUE}Default Login:${NC}"
echo "  Username: admin"
echo "  Password: moohoo"
echo ""
echo -e "${RED}⚠ CHANGE THE ADMIN PASSWORD IMMEDIATELY!${NC}"
echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo "  1. Configure host nginx to proxy mail.$DOMAIN → localhost:$MAILCOW_HTTPS_PORT"
echo "  2. Get SSL certificates (setup-ssl.sh)"
echo "  3. Login to Mailcow admin and change password"
echo "  4. Add domain: $DOMAIN"
echo "  5. Create mailbox: noreply@$DOMAIN"
echo "  6. Add DKIM TXT record to DNS"
echo ""
echo -e "${BLUE}SMTP Settings for GameTaverns:${NC}"
echo "  Host: $MAIL_HOSTNAME"
echo "  Port: 587"
echo "  User: noreply@$DOMAIN"
echo "  Pass: (set in Mailcow admin)"
echo ""
