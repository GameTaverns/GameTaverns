#!/bin/bash
# =============================================================================
# GameTaverns - NUCLEAR RESET SCRIPT v2.0
# THIS WILL DELETE EVERYTHING - REVERTS SERVER TO FRESH UBUNTU STATE
#
# What this script does:
#   ✓ Stops and removes ALL Docker containers, images, volumes, networks
#   ✓ Removes ALL project directories (/opt/gametaverns, /opt/mailcow)
#   ✓ Removes ALL credentials and backup files
#   ✓ Removes ALL Nginx configurations and SSL certificates
#   ✓ Removes project-related cron jobs
#   ✓ Disables and removes systemd services
#   ✓ Cleans up firewall rules (UFW)
#   ✓ Removes log files
#   ✓ Optionally removes Docker entirely
#   ✓ Leaves you with a CLEAN UBUNTU SERVER
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
BOLD='\033[1m'
NC='\033[0m'

# Parse arguments
PRESERVE_MAILCOW=false
for arg in "$@"; do
    case $arg in
        --preserve-mailcow)
            PRESERVE_MAILCOW=true
            shift
            ;;
    esac
done

# Track what was cleaned
CLEANED_ITEMS=()

log_cleaned() {
    CLEANED_ITEMS+=("$1")
}

echo ""
echo -e "${RED}╔═══════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${RED}║     ⚠️  NUCLEAR RESET v2.0 - COMPLETE SERVER WIPE  ⚠️                 ║${NC}"
echo -e "${RED}║                                                                       ║${NC}"
echo -e "${RED}║  This will revert your server to a FRESH UBUNTU state.               ║${NC}"
echo -e "${RED}║  ALL DATA WILL BE PERMANENTLY DESTROYED.                             ║${NC}"
echo -e "${RED}╚═══════════════════════════════════════════════════════════════════════╝${NC}"
echo ""

if [ "$PRESERVE_MAILCOW" = true ]; then
    echo -e "${GREEN}🐄 --preserve-mailcow flag detected: Mailcow will NOT be touched${NC}"
    echo ""
fi

# Check root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Please run as root: sudo ./nuclear-reset.sh${NC}"
    exit 1
fi

echo -e "${RED}${BOLD}This script will PERMANENTLY DELETE:${NC}"
echo ""
echo "  📦 Docker Environment:"
echo "     • All containers (GameTaverns, Mailcow, any others)"
echo "     • All Docker images"
echo "     • All Docker volumes (DATABASE DATA WILL BE LOST)"
echo "     • All Docker networks"
echo ""
echo "  📁 Project Files:"
echo "     • /opt/gametaverns (entire directory)"
echo "     • /opt/mailcow (entire directory)"
echo "     • All backup files in /root and /var/backups"
echo ""
echo "  🔐 Credentials & Secrets:"
echo "     • /root/gametaverns-credentials.txt"
echo "     • /root/mailcow-credentials.txt"
echo "     • All .env files"
echo "     • All API keys and tokens"
echo ""
echo "  🌐 Web Server:"
echo "     • All Nginx site configurations"
echo "     • SSL certificates (Let's Encrypt)"
echo "     • /etc/hosts modifications"
echo ""
echo "  ⚙️  System Configuration:"
echo "     • Cron jobs for backups/maintenance"
echo "     • Systemd service overrides"
echo "     • UFW firewall rules for project ports"
echo "     • Log files in /var/log"
echo ""
echo -e "${YELLOW}${BOLD}THIS CANNOT BE UNDONE!${NC}"
echo ""

# Triple confirmation for safety
read -p "Type 'DESTROY EVERYTHING' to continue: " CONFIRM1
if [ "$CONFIRM1" != "DESTROY EVERYTHING" ]; then
    echo "Aborted. Nothing was changed."
    exit 0
fi

echo ""
read -p "Are you ABSOLUTELY SURE? Type 'YES I AM SURE' to confirm: " CONFIRM2
if [ "$CONFIRM2" != "YES I AM SURE" ]; then
    echo "Aborted. Nothing was changed."
    exit 0
fi

echo ""
echo -e "${BLUE}Starting nuclear reset in 5 seconds... Press Ctrl+C to abort${NC}"
sleep 5

echo ""
echo -e "${CYAN}════════════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}                    BEGINNING NUCLEAR RESET                          ${NC}"
echo -e "${CYAN}════════════════════════════════════════════════════════════════════${NC}"
echo ""

# ===========================================
# Step 1: Stop Docker Compose stacks
# ===========================================
echo -e "${CYAN}[1/14] Stopping Docker Compose stacks...${NC}"

if [ -d /opt/gametaverns ]; then
    cd /opt/gametaverns
    # Try multiple possible compose file locations
    for compose_dir in "." "deploy/supabase-selfhosted" "deploy/native" "deploy/multitenant"; do
        if [ -f "$compose_dir/docker-compose.yml" ]; then
            docker compose -f "$compose_dir/docker-compose.yml" down --remove-orphans --volumes 2>/dev/null || true
        fi
    done
    log_cleaned "GameTaverns Docker stack"
fi

if [ "$PRESERVE_MAILCOW" = false ]; then
    if [ -d /opt/mailcow-dockerized ]; then
        cd /opt/mailcow-dockerized
        docker compose down --remove-orphans --volumes 2>/dev/null || true
        log_cleaned "Mailcow Docker stack"
    fi

    if [ -d /opt/mailcow ]; then
        cd /opt/mailcow
        docker compose down --remove-orphans --volumes 2>/dev/null || true
        log_cleaned "Mailcow Docker stack (alt location)"
    fi
else
    echo -e "${YELLOW}  Skipping Mailcow stacks (--preserve-mailcow)${NC}"
fi

echo -e "${GREEN}✓ Docker stacks stopped${NC}"

# ===========================================
# Step 2: Kill ALL Docker containers
# ===========================================
echo -e "${CYAN}[2/14] Stopping all Docker containers...${NC}"

RUNNING_CONTAINERS=$(docker ps -q 2>/dev/null || true)
if [ -n "$RUNNING_CONTAINERS" ]; then
    docker stop $RUNNING_CONTAINERS 2>/dev/null || true
    log_cleaned "All running containers"
fi

ALL_CONTAINERS=$(docker ps -aq 2>/dev/null || true)
if [ -n "$ALL_CONTAINERS" ]; then
    docker rm -f $ALL_CONTAINERS 2>/dev/null || true
    log_cleaned "All container instances"
fi

echo -e "${GREEN}✓ All containers removed${NC}"

# ===========================================
# Step 3: Remove Docker volumes
# ===========================================
echo -e "${CYAN}[3/14] Removing all Docker volumes...${NC}"

ALL_VOLUMES=$(docker volume ls -q 2>/dev/null || true)
if [ -n "$ALL_VOLUMES" ]; then
    docker volume rm -f $ALL_VOLUMES 2>/dev/null || true
    log_cleaned "All Docker volumes (including databases)"
fi

echo -e "${GREEN}✓ All volumes removed${NC}"

# ===========================================
# Step 4: Remove Docker networks
# ===========================================
echo -e "${CYAN}[4/14] Removing Docker networks...${NC}"

# Remove custom networks (keep default bridge, host, none)
CUSTOM_NETWORKS=$(docker network ls --format '{{.Name}}' | grep -vE '^(bridge|host|none)$' || true)
if [ -n "$CUSTOM_NETWORKS" ]; then
    echo "$CUSTOM_NETWORKS" | xargs -r docker network rm 2>/dev/null || true
    log_cleaned "Custom Docker networks"
fi

docker network prune -f 2>/dev/null || true
echo -e "${GREEN}✓ Networks cleaned${NC}"

# ===========================================
# Step 5: Remove Docker images
# ===========================================
echo -e "${CYAN}[5/14] Removing all Docker images...${NC}"

ALL_IMAGES=$(docker images -q 2>/dev/null || true)
if [ -n "$ALL_IMAGES" ]; then
    docker rmi -f $ALL_IMAGES 2>/dev/null || true
    log_cleaned "All Docker images"
fi

# Clean build cache
docker builder prune -af 2>/dev/null || true
echo -e "${GREEN}✓ All images removed${NC}"

# ===========================================
# Step 6: Stop host-level services
# ===========================================
echo -e "${CYAN}[6/14] Stopping host-level services...${NC}"

# Mail services
for service in postfix dovecot opendkim opendmarc; do
    if systemctl is-active --quiet $service 2>/dev/null; then
        systemctl stop $service 2>/dev/null || true
        systemctl disable $service 2>/dev/null || true
        log_cleaned "$service service"
    fi
done

echo -e "${GREEN}✓ Host services stopped${NC}"

# ===========================================
# Step 7: Remove cron jobs
# ===========================================
echo -e "${CYAN}[7/14] Removing cron jobs...${NC}"

# Remove project-related cron entries
CRON_BACKUP=$(mktemp)
crontab -l 2>/dev/null > "$CRON_BACKUP" || true

if [ -s "$CRON_BACKUP" ]; then
    grep -v -E "(gametaverns|mailcow|backup\.sh|certbot)" "$CRON_BACKUP" > "${CRON_BACKUP}.new" 2>/dev/null || true
    if [ -s "${CRON_BACKUP}.new" ]; then
        crontab "${CRON_BACKUP}.new"
    else
        crontab -r 2>/dev/null || true
    fi
    log_cleaned "Project cron jobs"
fi

rm -f "$CRON_BACKUP" "${CRON_BACKUP}.new" 2>/dev/null || true

# Remove cron.d entries
rm -f /etc/cron.d/gametaverns* 2>/dev/null || true
rm -f /etc/cron.d/mailcow* 2>/dev/null || true
rm -f /etc/cron.d/certbot-renew 2>/dev/null || true

echo -e "${GREEN}✓ Cron jobs removed${NC}"

# ===========================================
# Step 8: Remove Nginx configurations
# ===========================================
echo -e "${CYAN}[8/14] Removing Nginx configurations...${NC}"

# Remove site configs
rm -f /etc/nginx/sites-enabled/gametaverns* 2>/dev/null || true
rm -f /etc/nginx/sites-available/gametaverns* 2>/dev/null || true

if [ "$PRESERVE_MAILCOW" = false ]; then
    rm -f /etc/nginx/sites-enabled/mailcow* 2>/dev/null || true
    rm -f /etc/nginx/sites-available/mailcow* 2>/dev/null || true
    rm -f /etc/nginx/sites-enabled/mail.* 2>/dev/null || true
    rm -f /etc/nginx/sites-available/mail.* 2>/dev/null || true
    rm -f /etc/nginx/conf.d/mailcow* 2>/dev/null || true
else
    echo -e "${YELLOW}  Skipping Mailcow Nginx configs (--preserve-mailcow)${NC}"
fi

# Remove any custom conf.d entries
rm -f /etc/nginx/conf.d/gametaverns* 2>/dev/null || true

# Restore default site
if [ -f /etc/nginx/sites-available/default ] && [ ! -f /etc/nginx/sites-enabled/default ]; then
    ln -sf /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default 2>/dev/null || true
fi

# Test and reload nginx
if command -v nginx &> /dev/null; then
    nginx -t 2>/dev/null && systemctl reload nginx 2>/dev/null || systemctl restart nginx 2>/dev/null || true
fi

log_cleaned "Nginx configurations"
echo -e "${GREEN}✓ Nginx configurations removed${NC}"

# ===========================================
# Step 9: Remove SSL certificates
# ===========================================
echo -e "${CYAN}[9/14] Removing SSL certificates...${NC}"

# Find and remove project-related certificates
if [ "$PRESERVE_MAILCOW" = false ]; then
    CERT_DOMAINS=$(ls /etc/letsencrypt/live/ 2>/dev/null | grep -E "(gametaverns|mailcow)" || true)
else
    CERT_DOMAINS=$(ls /etc/letsencrypt/live/ 2>/dev/null | grep -E "gametaverns" || true)
    echo -e "${YELLOW}  Skipping Mailcow SSL certs (--preserve-mailcow)${NC}"
fi

for domain in $CERT_DOMAINS; do
    certbot delete --cert-name "$domain" --non-interactive 2>/dev/null || true
    rm -rf "/etc/letsencrypt/live/$domain" 2>/dev/null || true
    rm -rf "/etc/letsencrypt/archive/$domain" 2>/dev/null || true
    rm -f "/etc/letsencrypt/renewal/$domain.conf" 2>/dev/null || true
    log_cleaned "SSL cert: $domain"
done

# Also check for wildcard certs (avoid bash syntax errors when globs don't match)
shopt -s nullglob
for cert_dir in /etc/letsencrypt/live/*gametaverns* /etc/letsencrypt/archive/*gametaverns*; do
    rm -rf "$cert_dir" 2>/dev/null || true
done
shopt -u nullglob

echo -e "${GREEN}✓ SSL certificates removed${NC}"

# ===========================================
# Step 10: Remove project directories
# ===========================================
echo -e "${CYAN}[10/14] Removing project directories...${NC}"

# Main project directories
rm -rf /opt/gametaverns 2>/dev/null && log_cleaned "/opt/gametaverns" || true

if [ "$PRESERVE_MAILCOW" = false ]; then
    rm -rf /opt/mailcow 2>/dev/null && log_cleaned "/opt/mailcow" || true
    rm -rf /opt/mailcow-dockerized 2>/dev/null && log_cleaned "/opt/mailcow-dockerized" || true
    rm -rf /var/lib/mailcow 2>/dev/null && log_cleaned "/var/lib/mailcow" || true
else
    echo -e "${YELLOW}  Skipping Mailcow directories (--preserve-mailcow)${NC}"
fi

# Data directories that might exist outside /opt
rm -rf /var/lib/gametaverns 2>/dev/null && log_cleaned "/var/lib/gametaverns" || true
echo -e "${GREEN}✓ Project directories removed${NC}"

# ===========================================
# Step 11: Remove credentials and configs
# ===========================================
echo -e "${CYAN}[11/14] Removing credentials and configuration files...${NC}"

# Root directory credentials
rm -f /root/gametaverns-credentials.txt 2>/dev/null && log_cleaned "GameTaverns credentials" || true
rm -f /root/gametaverns-credentials-backup-*.txt 2>/dev/null || true

if [ "$PRESERVE_MAILCOW" = false ]; then
    rm -f /root/mailcow-credentials.txt 2>/dev/null && log_cleaned "Mailcow credentials" || true
else
    echo -e "${YELLOW}  Skipping Mailcow credentials (--preserve-mailcow)${NC}"
fi

rm -f /root/.gametaverns* 2>/dev/null || true
rm -f /root/.gametaverns* 2>/dev/null || true

# Backup files
rm -rf /var/backups/gametaverns* 2>/dev/null && log_cleaned "Backup files" || true
rm -rf /root/backups/gametaverns* 2>/dev/null || true

# Any stray .env files
find /root -name ".env*" -path "*gametaverns*" -delete 2>/dev/null || true
find /home -name ".env*" -path "*gametaverns*" -delete 2>/dev/null || true

echo -e "${GREEN}✓ Credentials removed${NC}"

# ===========================================
# Step 12: Clean up log files
# ===========================================
echo -e "${CYAN}[12/14] Cleaning up log files...${NC}"

rm -f /var/log/gametaverns*.log 2>/dev/null && log_cleaned "GameTaverns logs" || true
rm -rf /var/log/gametaverns/ 2>/dev/null || true

if [ "$PRESERVE_MAILCOW" = false ]; then
    rm -f /var/log/mailcow*.log 2>/dev/null || true
    rm -rf /var/log/mailcow/ 2>/dev/null || true
fi

# Rotate remaining logs to free space
logrotate -f /etc/logrotate.conf 2>/dev/null || true

echo -e "${GREEN}✓ Log files cleaned${NC}"

# ===========================================
# Step 13: Clean UFW firewall rules
# ===========================================
echo -e "${CYAN}[13/14] Resetting firewall rules...${NC}"

if command -v ufw &> /dev/null; then
    # Remove project-specific port rules
    for port in 3000 3001 5432 8000 8443 9000 9001 25 587 993 995 4190; do
        ufw delete allow $port 2>/dev/null || true
        ufw delete allow ${port}/tcp 2>/dev/null || true
    done
    
    # Keep basic SSH, HTTP, HTTPS
    ufw --force reset 2>/dev/null || true
    ufw default deny incoming 2>/dev/null || true
    ufw default allow outgoing 2>/dev/null || true
    ufw allow ssh 2>/dev/null || true
    ufw allow http 2>/dev/null || true
    ufw allow https 2>/dev/null || true
    ufw --force enable 2>/dev/null || true
    
    log_cleaned "UFW firewall rules"
fi

echo -e "${GREEN}✓ Firewall reset to defaults${NC}"

# ===========================================
# Step 14: Final Docker cleanup
# ===========================================
echo -e "${CYAN}[14/14] Final Docker system cleanup...${NC}"

docker system prune -af --volumes 2>/dev/null || true
log_cleaned "Docker system cache"

echo -e "${GREEN}✓ Docker fully cleaned${NC}"

# ===========================================
# Optional: Remove Docker entirely
# ===========================================
echo ""
read -p "Do you also want to UNINSTALL Docker completely? (y/N): " REMOVE_DOCKER
if [[ "$REMOVE_DOCKER" =~ ^[Yy]$ ]]; then
    echo -e "${CYAN}Removing Docker...${NC}"
    
    systemctl stop docker 2>/dev/null || true
    systemctl stop docker.socket 2>/dev/null || true
    
    apt-get purge -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin 2>/dev/null || true
    apt-get autoremove -y 2>/dev/null || true
    
    rm -rf /var/lib/docker 2>/dev/null || true
    rm -rf /var/lib/containerd 2>/dev/null || true
    rm -rf /etc/docker 2>/dev/null || true
    rm -f /etc/apt/sources.list.d/docker.list 2>/dev/null || true
    rm -f /etc/apt/keyrings/docker.gpg 2>/dev/null || true
    
    log_cleaned "Docker installation"
    echo -e "${GREEN}✓ Docker uninstalled${NC}"
fi

# ===========================================
# Summary
# ===========================================
echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║              NUCLEAR RESET COMPLETE - SERVER IS CLEAN                 ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════════════╝${NC}"
echo ""

echo -e "${BLUE}Items cleaned:${NC}"
for item in "${CLEANED_ITEMS[@]}"; do
    echo -e "  ${GREEN}✓${NC} $item"
done

echo ""

# Verify ports are free
echo -e "${BLUE}Port availability check:${NC}"
PORTS_TO_CHECK="22 25 80 443 587 993 3000 5432 8000"
ALL_CLEAR=true

for port in $PORTS_TO_CHECK; do
    if ss -tlnp | grep -q ":$port " 2>/dev/null; then
        PROCESS=$(ss -tlnp | grep ":$port " | awk '{print $NF}' | head -1)
        echo -e "  ${YELLOW}Port $port: IN USE by $PROCESS${NC}"
        ALL_CLEAR=false
    else
        echo -e "  ${GREEN}Port $port: FREE${NC}"
    fi
done

echo ""
if [ "$ALL_CLEAR" = true ]; then
    echo -e "${GREEN}✓ All project ports are free!${NC}"
else
    echo -e "${YELLOW}Some ports still in use. A reboot may be required.${NC}"
fi

# Disk space recovered
echo ""
echo -e "${BLUE}Disk space status:${NC}"
df -h / | tail -1 | awk '{print "  Root partition: " $4 " available (" $5 " used)"}'

echo ""
echo -e "${GREEN}${BOLD}Server has been reset to a clean state!${NC}"
echo ""
echo -e "${CYAN}To perform a fresh installation:${NC}"
echo ""
echo "  1. Install Docker (if removed):"
echo -e "     ${YELLOW}curl -fsSL https://get.docker.com | sh${NC}"
echo ""
echo "  2. Clone and install GameTaverns:"
echo -e "     ${YELLOW}git clone https://github.com/GameTaverns/GameTaverns.git /opt/gametaverns${NC}"
echo -e "     ${YELLOW}cd /opt/gametaverns/deploy/supabase-selfhosted${NC}"
echo -e "     ${YELLOW}sudo ./install.sh${NC}"
echo ""
echo "  3. Follow the FRESH_INSTALL.md guide for complete setup."
echo ""

# Recommend reboot
echo -e "${YELLOW}${BOLD}RECOMMENDED: Reboot the server to ensure all changes take effect:${NC}"
echo -e "     ${YELLOW}sudo reboot${NC}"
echo ""
