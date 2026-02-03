#!/bin/bash
# =============================================================================
# GameTaverns - NUCLEAR RESET SCRIPT
# THIS WILL DELETE EVERYTHING - USE WITH EXTREME CAUTION
#
# What this script does:
#   ✓ Stops ALL Docker containers
#   ✓ Removes ALL GameTaverns and Mailcow containers
#   ✓ Removes ALL Docker volumes (DATABASE DATA WILL BE LOST)
#   ✓ Removes ALL Docker networks
#   ✓ Cleans /opt/gametaverns and /opt/mailcow directories
#   ✓ Disables and stops host-level mail services
#   ✓ Removes Nginx site configurations
#   ✓ Removes SSL certificates
#   ✓ Prunes Docker completely
#   ✓ Leaves you with a CLEAN SLATE
#
# After running this, you can do a fresh install with:
#   git clone https://github.com/GameTaverns/GameTaverns.git /opt/gametaverns
#   cd /opt/gametaverns/deploy/supabase-selfhosted
#   sudo ./install.sh
#
# =============================================================================

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo ""
echo -e "${RED}╔═══════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${RED}║         ⚠️  NUCLEAR RESET - COMPLETE SYSTEM WIPE  ⚠️              ║${NC}"
echo -e "${RED}╚═══════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Please run as root: sudo ./nuclear-reset.sh${NC}"
    exit 1
fi

echo -e "${RED}This script will PERMANENTLY DELETE:${NC}"
echo "  • All GameTaverns containers and data"
echo "  • All Mailcow containers and data"
echo "  • All PostgreSQL database data"
echo "  • All uploaded files and storage"
echo "  • All mail data"
echo "  • SSL certificates"
echo "  • All Docker volumes and networks"
echo ""
echo -e "${YELLOW}THIS CANNOT BE UNDONE!${NC}"
echo ""
read -p "Type 'DESTROY EVERYTHING' to continue: " CONFIRM

if [ "$CONFIRM" != "DESTROY EVERYTHING" ]; then
    echo "Aborted. Nothing was changed."
    exit 0
fi

echo ""
echo -e "${BLUE}Starting nuclear reset...${NC}"
echo ""

# ===========================================
# Step 1: Stop and remove GameTaverns
# ===========================================
echo -e "${CYAN}[1/10] Stopping GameTaverns stack...${NC}"
if [ -d /opt/gametaverns ]; then
    cd /opt/gametaverns
    docker compose down --remove-orphans --volumes 2>/dev/null || true
    echo -e "${GREEN}✓ GameTaverns stopped${NC}"
else
    echo -e "${YELLOW}GameTaverns directory not found${NC}"
fi

# ===========================================
# Step 2: Stop and remove Mailcow
# ===========================================
echo -e "${CYAN}[2/10] Stopping Mailcow stack...${NC}"
if [ -d /opt/mailcow ]; then
    cd /opt/mailcow
    docker compose down --remove-orphans --volumes 2>/dev/null || true
    echo -e "${GREEN}✓ Mailcow stopped${NC}"
else
    echo -e "${YELLOW}Mailcow directory not found${NC}"
fi

# ===========================================
# Step 3: Kill any remaining containers
# ===========================================
echo -e "${CYAN}[3/10] Removing all GameTaverns/Mailcow containers...${NC}"
CONTAINERS=$(docker ps -a --format '{{.Names}}' | grep -E "^(gametaverns-|mailcow)" || true)
if [ -n "$CONTAINERS" ]; then
    echo "$CONTAINERS" | xargs docker stop 2>/dev/null || true
    echo "$CONTAINERS" | xargs docker rm -f 2>/dev/null || true
    echo -e "${GREEN}✓ Containers removed${NC}"
else
    echo -e "${YELLOW}No matching containers found${NC}"
fi

# Remove old mail containers by any name
for container in gametaverns-mail gametaverns-roundcube; do
    if docker ps -a --format '{{.Names}}' | grep -q "^${container}$"; then
        docker stop "$container" 2>/dev/null || true
        docker rm "$container" 2>/dev/null || true
    fi
done

# ===========================================
# Step 4: Remove Docker volumes
# ===========================================
echo -e "${CYAN}[4/10] Removing Docker volumes...${NC}"
VOLUMES=$(docker volume ls -q | grep -E "^(gametaverns|mailcow)" || true)
if [ -n "$VOLUMES" ]; then
    echo "$VOLUMES" | xargs docker volume rm -f 2>/dev/null || true
    echo -e "${GREEN}✓ Named volumes removed${NC}"
else
    echo -e "${YELLOW}No matching volumes found${NC}"
fi

# Also remove any orphan volumes
docker volume prune -f 2>/dev/null || true

# ===========================================
# Step 5: Remove Docker networks
# ===========================================
echo -e "${CYAN}[5/10] Cleaning Docker networks...${NC}"
docker network prune -f 2>/dev/null || true
echo -e "${GREEN}✓ Networks cleaned${NC}"

# ===========================================
# Step 6: Stop host-level mail services
# ===========================================
echo -e "${CYAN}[6/10] Stopping host mail services...${NC}"
systemctl stop postfix 2>/dev/null || true
systemctl disable postfix 2>/dev/null || true
systemctl stop dovecot 2>/dev/null || true
systemctl disable dovecot 2>/dev/null || true
echo -e "${GREEN}✓ Host mail services stopped${NC}"

# ===========================================
# Step 7: Remove directories
# ===========================================
echo -e "${CYAN}[7/10] Removing installation directories...${NC}"

# Backup credentials first
if [ -f /root/gametaverns-credentials.txt ]; then
    cp /root/gametaverns-credentials.txt /root/gametaverns-credentials-backup-$(date +%Y%m%d-%H%M%S).txt
    echo -e "${YELLOW}Credentials backed up to /root/${NC}"
fi

rm -rf /opt/gametaverns 2>/dev/null || true
rm -rf /opt/mailcow 2>/dev/null || true
rm -f /root/gametaverns-credentials.txt 2>/dev/null || true
rm -f /var/log/gametaverns-install.log 2>/dev/null || true
echo -e "${GREEN}✓ Directories removed${NC}"

# ===========================================
# Step 8: Remove Nginx configurations
# ===========================================
echo -e "${CYAN}[8/10] Removing Nginx configurations...${NC}"
rm -f /etc/nginx/sites-enabled/gametaverns 2>/dev/null || true
rm -f /etc/nginx/sites-available/gametaverns 2>/dev/null || true
rm -f /etc/nginx/sites-enabled/mailcow 2>/dev/null || true
rm -f /etc/nginx/sites-available/mailcow 2>/dev/null || true

# Restore default site if it exists
if [ -f /etc/nginx/sites-available/default ] && [ ! -f /etc/nginx/sites-enabled/default ]; then
    ln -sf /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default
fi

# Test and reload nginx
nginx -t 2>/dev/null && systemctl reload nginx 2>/dev/null || true
echo -e "${GREEN}✓ Nginx configurations removed${NC}"

# ===========================================
# Step 9: Remove SSL certificates (optional)
# ===========================================
echo -e "${CYAN}[9/10] Removing SSL certificates...${NC}"
read -p "Remove Let's Encrypt certificates? (y/N): " REMOVE_SSL
if [[ "$REMOVE_SSL" =~ ^[Yy]$ ]]; then
    rm -rf /etc/letsencrypt/live/gametaverns.com 2>/dev/null || true
    rm -rf /etc/letsencrypt/archive/gametaverns.com 2>/dev/null || true
    rm -f /etc/letsencrypt/renewal/gametaverns.com.conf 2>/dev/null || true
    echo -e "${GREEN}✓ SSL certificates removed${NC}"
else
    echo -e "${YELLOW}SSL certificates preserved${NC}"
fi

# ===========================================
# Step 10: Full Docker cleanup
# ===========================================
echo -e "${CYAN}[10/10] Final Docker cleanup...${NC}"
docker system prune -af 2>/dev/null || true
echo -e "${GREEN}✓ Docker cleaned${NC}"

# ===========================================
# Summary
# ===========================================
echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║         NUCLEAR RESET COMPLETE                                    ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Verify ports are free
echo -e "${BLUE}Port availability check:${NC}"
PORTS_TO_CHECK="25 80 443 587 993 3000 5432 8000"
ALL_CLEAR=true

for port in $PORTS_TO_CHECK; do
    if lsof -i :$port > /dev/null 2>&1; then
        PROCESS=$(lsof -i :$port -t | head -1)
        PNAME=$(ps -p $PROCESS -o comm= 2>/dev/null || echo "unknown")
        echo -e "  ${YELLOW}Port $port: IN USE by $PNAME (PID: $PROCESS)${NC}"
        ALL_CLEAR=false
    else
        echo -e "  ${GREEN}Port $port: FREE${NC}"
    fi
done

echo ""
if [ "$ALL_CLEAR" = true ]; then
    echo -e "${GREEN}✓ All ports are free!${NC}"
else
    echo -e "${YELLOW}Some ports still in use. You may need to reboot or kill processes.${NC}"
fi

echo ""
echo -e "${CYAN}Server is ready for fresh installation!${NC}"
echo ""
echo "Next steps:"
echo ""
echo "  1. Clone the repository:"
echo -e "     ${YELLOW}git clone https://github.com/GameTaverns/GameTaverns.git /opt/gametaverns${NC}"
echo ""
echo "  2. Install Mailcow FIRST (if using):"
echo -e "     ${YELLOW}cd /opt && git clone https://github.com/mailcow/mailcow-dockerized mailcow${NC}"
echo -e "     ${YELLOW}cd mailcow && ./generate_config.sh${NC}"
echo -e "     ${YELLOW}# Edit mailcow.conf: HTTP_PORT=8080, HTTPS_PORT=8443${NC}"
echo -e "     ${YELLOW}docker compose up -d${NC}"
echo ""
echo "  3. Install GameTaverns:"
echo -e "     ${YELLOW}cd /opt/gametaverns/deploy/supabase-selfhosted${NC}"
echo -e "     ${YELLOW}sudo ./install.sh${NC}"
echo ""
echo "  4. Follow the FRESH_INSTALL.md guide for complete instructions."
echo ""
