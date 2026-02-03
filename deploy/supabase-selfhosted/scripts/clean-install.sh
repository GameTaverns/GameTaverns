#!/bin/bash
# =============================================================================
# GameTaverns - Clean Installation Prep Script
# Run this BEFORE install.sh if you have a messy environment
#
# This script:
#   ✓ Stops all conflicting containers
#   ✓ Removes old mail containers
#   ✓ Cleans up Docker networks
#   ✓ Prepares for fresh Mailcow + GameTaverns installation
#
# Usage: sudo ./clean-install.sh
# =============================================================================

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo ""
echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║         GameTaverns Clean Installation Prep                       ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Please run as root: sudo ./clean-install.sh${NC}"
    exit 1
fi

echo -e "${YELLOW}This will stop and remove conflicting containers.${NC}"
echo -e "${YELLOW}GameTaverns data volumes will be PRESERVED.${NC}"
echo ""
read -p "Continue? (y/N): " CONFIRM
if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 0
fi

# ===========================================
# Step 1: Stop conflicting services
# ===========================================
echo ""
echo -e "${BLUE}[1/5] Stopping host-level mail services...${NC}"

systemctl stop postfix 2>/dev/null || true
systemctl disable postfix 2>/dev/null || true
systemctl stop dovecot 2>/dev/null || true
systemctl disable dovecot 2>/dev/null || true

echo -e "${GREEN}✓ Host mail services stopped${NC}"

# ===========================================
# Step 2: Stop old GameTaverns stack
# ===========================================
echo ""
echo -e "${BLUE}[2/5] Stopping old GameTaverns containers...${NC}"

cd /opt/gametaverns 2>/dev/null && docker compose down --remove-orphans 2>/dev/null || true

# Remove specifically named old mail containers
MAIL_CONTAINERS="gametaverns-mail gametaverns-roundcube"
for container in $MAIL_CONTAINERS; do
    if docker ps -a --format '{{.Names}}' | grep -q "^${container}$"; then
        echo "  Removing $container..."
        docker stop "$container" 2>/dev/null || true
        docker rm "$container" 2>/dev/null || true
    fi
done

echo -e "${GREEN}✓ Old GameTaverns containers cleaned${NC}"

# ===========================================
# Step 3: Stop Mailcow if exists
# ===========================================
echo ""
echo -e "${BLUE}[3/5] Stopping Mailcow stack (if exists)...${NC}"

if [ -d /opt/mailcow ]; then
    cd /opt/mailcow && docker compose down --remove-orphans 2>/dev/null || true
    echo -e "${GREEN}✓ Mailcow stopped${NC}"
else
    echo -e "${YELLOW}Mailcow not found at /opt/mailcow${NC}"
fi

# ===========================================
# Step 4: Clean Docker networks
# ===========================================
echo ""
echo -e "${BLUE}[4/5] Cleaning Docker networks...${NC}"

# List networks before cleanup
echo "Current networks:"
docker network ls --format "  {{.Name}}: {{.Driver}}"

# Prune unused networks
docker network prune -f

echo -e "${GREEN}✓ Unused networks removed${NC}"

# ===========================================
# Step 5: Check port availability
# ===========================================
echo ""
echo -e "${BLUE}[5/5] Checking port availability...${NC}"

PORTS_TO_CHECK="25 80 443 587 993 3000 5432 8000"
BLOCKED_PORTS=""

for port in $PORTS_TO_CHECK; do
    if lsof -i :$port > /dev/null 2>&1; then
        PROCESS=$(lsof -i :$port -t | head -1)
        PNAME=$(ps -p $PROCESS -o comm= 2>/dev/null || echo "unknown")
        echo -e "  ${YELLOW}Port $port: IN USE by $PNAME (PID: $PROCESS)${NC}"
        BLOCKED_PORTS="$BLOCKED_PORTS $port"
    else
        echo -e "  ${GREEN}Port $port: Available${NC}"
    fi
done

# ===========================================
# Summary
# ===========================================
echo ""
echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║         Cleanup Complete                                          ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════════╝${NC}"
echo ""

if [ -n "$BLOCKED_PORTS" ]; then
    echo -e "${YELLOW}⚠ Some ports are still in use:$BLOCKED_PORTS${NC}"
    echo ""
    echo "To identify and stop these processes:"
    for port in $BLOCKED_PORTS; do
        echo "  sudo lsof -i :$port"
    done
    echo ""
fi

echo -e "${GREEN}Ready for fresh installation!${NC}"
echo ""
echo "Next steps:"
echo ""
echo "  1. Install Mailcow first (if not already done):"
echo -e "     ${YELLOW}cd /opt && git clone https://github.com/mailcow/mailcow-dockerized mailcow${NC}"
echo -e "     ${YELLOW}cd mailcow && ./generate_config.sh${NC}"
echo -e "     ${YELLOW}# Edit mailcow.conf: HTTP_PORT=8080, HTTPS_PORT=8443${NC}"
echo -e "     ${YELLOW}docker compose up -d${NC}"
echo ""
echo "  2. Then install GameTaverns:"
echo -e "     ${YELLOW}cd /opt/gametaverns/deploy/supabase-selfhosted${NC}"
echo -e "     ${YELLOW}sudo ./install.sh${NC}"
echo ""
