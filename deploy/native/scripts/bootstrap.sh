#!/bin/bash
#
# GameTaverns Bootstrap Installer
# Prepares a fresh Ubuntu server for GameTaverns installation
#
# Version: 2.3.0
#
# This script MUST be run BEFORE install.sh on a fresh Ubuntu 24.04 server.
# It installs all system prerequisites and performs pre-flight checks.
#
# Usage: 
#   curl -fsSL https://raw.githubusercontent.com/GameTaverns/GameTaverns/main/deploy/native/scripts/bootstrap.sh | sudo bash
#
# Or:
#   wget -O bootstrap.sh https://raw.githubusercontent.com/GameTaverns/GameTaverns/main/deploy/native/scripts/bootstrap.sh
#   chmod +x bootstrap.sh
#   sudo ./bootstrap.sh
#

set -e

# ═══════════════════════════════════════════════════════════════════
# Colors
# ═══════════════════════════════════════════════════════════════════
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# ═══════════════════════════════════════════════════════════════════
# Configuration
# ═══════════════════════════════════════════════════════════════════
INSTALL_DIR="/opt/gametaverns"
MIN_RAM_MB=2048
MIN_DISK_GB=10
REQUIRED_PORTS=(80 443 3001 5432)
REPO_URL="https://github.com/GameTaverns/GameTaverns.git"

# ═══════════════════════════════════════════════════════════════════
# Banner
# ═══════════════════════════════════════════════════════════════════
clear
echo ""
echo -e "${BOLD}${CYAN}╔═══════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${CYAN}║         GameTaverns Bootstrap Installer                           ║${NC}"
echo -e "${BOLD}${CYAN}║         Prepares Ubuntu 24.04 for Installation                    ║${NC}"
echo -e "${BOLD}${CYAN}╚═══════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# ═══════════════════════════════════════════════════════════════════
# Helper Functions
# ═══════════════════════════════════════════════════════════════════

check_pass() {
    echo -e "${GREEN}✓${NC} $1"
}

check_warn() {
    echo -e "${YELLOW}!${NC} $1"
}

check_fail() {
    echo -e "${RED}✗${NC} $1"
    ERRORS=$((ERRORS + 1))
}

step() {
    echo ""
    echo -e "${BOLD}${BLUE}══► $1${NC}"
}

# ═══════════════════════════════════════════════════════════════════
# Pre-flight Checks
# ═══════════════════════════════════════════════════════════════════

step "Running Pre-flight Checks"
echo ""

ERRORS=0
WARNINGS=0

# Check root
if [[ $EUID -eq 0 ]]; then
    check_pass "Running as root"
else
    check_fail "Must run as root (use: sudo ./bootstrap.sh)"
fi

# Check Ubuntu version
if grep -q "Ubuntu 24" /etc/os-release 2>/dev/null; then
    check_pass "Ubuntu 24.04 LTS detected"
elif grep -q "Ubuntu 22" /etc/os-release 2>/dev/null; then
    check_warn "Ubuntu 22.04 detected (24.04 recommended)"
    WARNINGS=$((WARNINGS + 1))
elif grep -q "Ubuntu" /etc/os-release 2>/dev/null; then
    check_fail "Unsupported Ubuntu version (need 24.04 LTS)"
else
    check_fail "Not Ubuntu (need Ubuntu 24.04 LTS)"
fi

# Check RAM
TOTAL_RAM=$(free -m | awk '/^Mem:/{print $2}')
if [[ $TOTAL_RAM -ge 4000 ]]; then
    check_pass "RAM: ${TOTAL_RAM} MB (4+ GB - Excellent)"
elif [[ $TOTAL_RAM -ge $MIN_RAM_MB ]]; then
    check_warn "RAM: ${TOTAL_RAM} MB (4 GB recommended)"
    WARNINGS=$((WARNINGS + 1))
else
    check_fail "RAM: ${TOTAL_RAM} MB (minimum ${MIN_RAM_MB} MB required)"
fi

# Check disk space
DISK_FREE=$(df -m / | awk 'NR==2 {print $4}')
DISK_FREE_GB=$((DISK_FREE / 1024))
if [[ $DISK_FREE_GB -ge 20 ]]; then
    check_pass "Disk: ${DISK_FREE_GB} GB free (Excellent)"
elif [[ $DISK_FREE_GB -ge $MIN_DISK_GB ]]; then
    check_warn "Disk: ${DISK_FREE_GB} GB free (20 GB recommended)"
    WARNINGS=$((WARNINGS + 1))
else
    check_fail "Disk: ${DISK_FREE_GB} GB free (minimum ${MIN_DISK_GB} GB required)"
fi

# Check CPU cores
CPU_CORES=$(nproc)
if [[ $CPU_CORES -ge 2 ]]; then
    check_pass "CPU: ${CPU_CORES} cores"
else
    check_warn "CPU: ${CPU_CORES} core (2+ recommended)"
    WARNINGS=$((WARNINGS + 1))
fi

# Check internet connectivity
if ping -c 1 -W 3 8.8.8.8 &>/dev/null || ping -c 1 -W 3 1.1.1.1 &>/dev/null; then
    check_pass "Internet connection available"
else
    check_fail "No internet connection"
fi

# Check DNS resolution
if ping -c 1 -W 3 google.com &>/dev/null; then
    check_pass "DNS resolution working"
else
    check_warn "DNS may have issues"
    WARNINGS=$((WARNINGS + 1))
fi

# Get public IP
PUBLIC_IP=$(curl -s --max-time 5 ifconfig.me 2>/dev/null || curl -s --max-time 5 icanhazip.com 2>/dev/null || echo "unknown")
if [[ "$PUBLIC_IP" != "unknown" && "$PUBLIC_IP" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    check_pass "Public IP: ${PUBLIC_IP}"
else
    check_warn "Could not detect public IP"
    WARNINGS=$((WARNINGS + 1))
fi

# Check ports
echo ""
echo "Checking required ports..."
for port in "${REQUIRED_PORTS[@]}"; do
    if ss -tlnp 2>/dev/null | grep -q ":${port} "; then
        check_warn "Port ${port} is already in use"
        WARNINGS=$((WARNINGS + 1))
    else
        check_pass "Port ${port} is available"
    fi
done

echo ""

# Exit if critical errors
if [[ $ERRORS -gt 0 ]]; then
    echo -e "${RED}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${RED}Pre-flight check failed with $ERRORS error(s).${NC}"
    echo -e "${RED}Please fix the issues above and run again.${NC}"
    echo -e "${RED}═══════════════════════════════════════════════════════════════${NC}"
    exit 1
fi

if [[ $WARNINGS -gt 0 ]]; then
    echo -e "${YELLOW}Pre-flight completed with $WARNINGS warning(s).${NC}"
    echo ""
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Cancelled."
        exit 1
    fi
else
    echo -e "${GREEN}All pre-flight checks passed!${NC}"
fi

# ═══════════════════════════════════════════════════════════════════
# System Update
# ═══════════════════════════════════════════════════════════════════

step "Updating System Packages"

echo "Updating package lists..."
apt-get update -qq

echo "Upgrading installed packages..."
DEBIAN_FRONTEND=noninteractive apt-get upgrade -y -qq

# ═══════════════════════════════════════════════════════════════════
# Install Prerequisites
# ═══════════════════════════════════════════════════════════════════

step "Installing Prerequisites"

echo "Installing essential packages..."
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
    curl \
    wget \
    git \
    build-essential \
    software-properties-common \
    gnupg \
    lsb-release \
    ca-certificates \
    ufw \
    fail2ban \
    unzip \
    htop \
    openssl \
    certbot \
    python3-certbot-nginx \
    python3-certbot-dns-cloudflare \
    sudo \
    nano \
    vim \
    net-tools \
    dnsutils \
    jq

check_pass "Essential packages installed"

# ═══════════════════════════════════════════════════════════════════
# PostgreSQL Repository
# ═══════════════════════════════════════════════════════════════════

step "Adding PostgreSQL 16 Repository"

if [[ ! -f /etc/apt/sources.list.d/pgdg.list ]]; then
    echo "Adding PostgreSQL APT repository..."
    sh -c 'echo "deb https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
    wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | apt-key add -
    apt-get update -qq
    check_pass "PostgreSQL repository added"
else
    check_pass "PostgreSQL repository already configured"
fi

# ═══════════════════════════════════════════════════════════════════
# Node.js Repository
# ═══════════════════════════════════════════════════════════════════

step "Adding Node.js 22 Repository"

if [[ ! -f /etc/apt/sources.list.d/nodesource.list ]]; then
    echo "Adding NodeSource repository..."
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null 2>&1
    check_pass "Node.js repository added"
else
    check_pass "Node.js repository already configured"
fi

# ═══════════════════════════════════════════════════════════════════
# Clone Repository
# ═══════════════════════════════════════════════════════════════════

step "Cloning GameTaverns Repository"

if [[ -d "${INSTALL_DIR}/.git" ]]; then
    echo "Repository already exists, pulling latest..."
    cd "${INSTALL_DIR}"
    git config --global --add safe.directory "${INSTALL_DIR}" 2>/dev/null || true
    git fetch origin
    git reset --hard origin/main
    check_pass "Repository updated"
else
    echo "Cloning repository to ${INSTALL_DIR}..."
    git clone "${REPO_URL}" "${INSTALL_DIR}"
    check_pass "Repository cloned"
fi

# Make scripts executable
chmod +x ${INSTALL_DIR}/deploy/native/*.sh 2>/dev/null || true
chmod +x ${INSTALL_DIR}/deploy/native/scripts/*.sh 2>/dev/null || true

# ═══════════════════════════════════════════════════════════════════
# Configure Firewall
# ═══════════════════════════════════════════════════════════════════

step "Configuring Firewall"

if ufw status | grep -q "inactive"; then
    echo "Enabling UFW firewall with default rules..."
    
    # Reset UFW to defaults
    ufw --force reset >/dev/null 2>&1
    
    # Default policies
    ufw default deny incoming
    ufw default allow outgoing
    
    # Essential ports
    ufw allow 22/tcp comment "SSH"
    ufw allow 80/tcp comment "HTTP"
    ufw allow 443/tcp comment "HTTPS"
    
    # Enable UFW
    ufw --force enable
    
    check_pass "Firewall enabled with basic rules"
else
    check_pass "Firewall already configured"
fi

# ═══════════════════════════════════════════════════════════════════
# Summary
# ═══════════════════════════════════════════════════════════════════

echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║              Bootstrap Complete!                                  ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "Your server is now ready for GameTaverns installation."
echo ""
echo -e "${BOLD}Server Information:${NC}"
echo "  Public IP:    ${PUBLIC_IP}"
echo "  RAM:          ${TOTAL_RAM} MB"
echo "  Disk Free:    ${DISK_FREE_GB} GB"
echo "  CPU Cores:    ${CPU_CORES}"
echo ""
echo -e "${BOLD}${CYAN}Next Step:${NC}"
echo ""
echo "  Run the main installer:"
echo ""
echo -e "    ${YELLOW}cd ${INSTALL_DIR}/deploy/native${NC}"
echo -e "    ${YELLOW}sudo ./install.sh${NC}"
echo ""
echo -e "${BOLD}What the installer will set up:${NC}"
echo "  • PostgreSQL 16 database"
echo "  • Node.js 22 + PM2 process manager"  
echo "  • Nginx reverse proxy"
echo "  • Postfix + Dovecot mail server"
echo "  • Roundcube webmail"
echo "  • Cockpit web console (server GUI)"
echo "  • GameTaverns application"
echo ""
echo -e "${BOLD}Estimated time:${NC} 15-25 minutes"
echo ""
echo -e "${GREEN}Happy gaming! 🎲${NC}"
echo ""
