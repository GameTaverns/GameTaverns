#!/bin/bash
# =============================================================================
# GameTaverns - Server Bootstrap Script
# Run this FIRST on a fresh Ubuntu server BEFORE cloning the repo
# 
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/GameTaverns/GameTaverns/main/deploy/supabase-selfhosted/bootstrap.sh | sudo bash
#
# Or download and run:
#   wget https://raw.githubusercontent.com/GameTaverns/GameTaverns/main/deploy/supabase-selfhosted/bootstrap.sh
#   chmod +x bootstrap.sh
#   sudo ./bootstrap.sh
#
# Version: 2.2.0
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
echo -e "${CYAN}╔═══════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║         GameTaverns Server Bootstrap                              ║${NC}"
echo -e "${CYAN}║         Preparing Ubuntu for Self-Hosted Deployment               ║${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# ===========================================
# Pre-flight Checks
# ===========================================

# Check root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}ERROR: Please run as root: sudo ./bootstrap.sh${NC}"
    exit 1
fi

# Check Ubuntu
if [ ! -f /etc/os-release ]; then
    echo -e "${RED}ERROR: Could not detect OS. This script requires Ubuntu 22.04 or 24.04.${NC}"
    exit 1
fi

source /etc/os-release
if [ "$ID" != "ubuntu" ]; then
    echo -e "${YELLOW}WARNING: This script is designed for Ubuntu. Detected: $ID${NC}"
    read -p "Continue anyway? (y/N): " CONTINUE
    if [[ ! "$CONTINUE" =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo -e "${BLUE}Detected: $PRETTY_NAME${NC}"

# Check minimum requirements
TOTAL_RAM_KB=$(grep MemTotal /proc/meminfo | awk '{print $2}')
TOTAL_RAM_GB=$((TOTAL_RAM_KB / 1024 / 1024))
FREE_DISK_GB=$(df / | tail -1 | awk '{print int($4/1024/1024)}')
CPU_CORES=$(nproc)

echo ""
echo -e "${BLUE}System Resources:${NC}"
echo "  RAM:  ${TOTAL_RAM_GB}GB"
echo "  Disk: ${FREE_DISK_GB}GB free"
echo "  CPU:  ${CPU_CORES} cores"
echo ""

if [ "$TOTAL_RAM_GB" -lt 2 ]; then
    echo -e "${YELLOW}WARNING: Less than 2GB RAM. Recommended: 4GB+ for production.${NC}"
fi

if [ "$FREE_DISK_GB" -lt 15 ]; then
    echo -e "${YELLOW}WARNING: Less than 15GB free disk space. Recommended: 20GB+${NC}"
fi

# ===========================================
# System Update & Upgrade
# ===========================================
echo ""
echo -e "${BLUE}[1/5] Updating system packages...${NC}"

export DEBIAN_FRONTEND=noninteractive

apt-get update -qq
apt-get upgrade -y -qq

echo -e "${GREEN}✓ System updated${NC}"

# ===========================================
# Install All Required Packages
# ===========================================
echo ""
echo -e "${BLUE}[2/5] Installing required packages...${NC}"

# Core utilities
apt-get install -y -qq \
    apt-transport-https \
    ca-certificates \
    curl \
    wget \
    gnupg \
    lsb-release \
    software-properties-common \
    unzip \
    jq \
    htop \
    git \
    nano \
    vim \
    tree

# Build tools (for native npm modules)
apt-get install -y -qq \
    build-essential \
    python3 \
    python3-pip

# SSL/TLS tools
apt-get install -y -qq \
    certbot \
    python3-certbot-nginx \
    openssl

# Networking tools
apt-get install -y -qq \
    net-tools \
    dnsutils \
    iputils-ping

# Nginx (for reverse proxy)
apt-get install -y -qq nginx

# Fail2ban (security)
apt-get install -y -qq fail2ban

# UFW firewall
apt-get install -y -qq ufw

echo -e "${GREEN}✓ Core packages installed${NC}"

# ===========================================
# Install Docker
# ===========================================
echo ""
echo -e "${BLUE}[3/5] Installing Docker...${NC}"

if command -v docker &> /dev/null; then
    echo -e "${GREEN}✓ Docker already installed: $(docker --version)${NC}"
else
    # Remove old Docker versions
    apt-get remove -y docker docker-engine docker.io containerd runc 2>/dev/null || true

    # Add Docker GPG key
    mkdir -p /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg

    # Add Docker repository
    echo \
        "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
        $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

    # Install Docker
    apt-get update -qq
    apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

    # Start and enable Docker
    systemctl enable docker
    systemctl start docker

    echo -e "${GREEN}✓ Docker installed: $(docker --version)${NC}"
fi

# Verify Docker Compose
if docker compose version &> /dev/null; then
    echo -e "${GREEN}✓ Docker Compose: $(docker compose version --short)${NC}"
else
    echo -e "${RED}ERROR: Docker Compose plugin not found${NC}"
    exit 1
fi

# ===========================================
# Configure Firewall
# ===========================================
echo ""
echo -e "${BLUE}[4/5] Configuring firewall...${NC}"

# Reset UFW to default (deny incoming, allow outgoing)
ufw --force reset > /dev/null 2>&1

# Allow SSH (important - do this first!)
ufw allow 22/tcp comment 'SSH'

# Allow HTTP/HTTPS
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'

# Allow mail ports (optional but included for full setup)
ufw allow 25/tcp comment 'SMTP'
ufw allow 587/tcp comment 'SMTP Submission'
ufw allow 993/tcp comment 'IMAPS'

# Enable UFW
ufw --force enable > /dev/null 2>&1

echo -e "${GREEN}✓ Firewall configured (SSH, HTTP, HTTPS, Mail ports open)${NC}"

# ===========================================
# Configure Fail2ban
# ===========================================
echo ""
echo -e "${BLUE}[5/5] Configuring Fail2ban...${NC}"

# Create jail.local with sensible defaults
cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime = 1h
findtime = 10m
maxretry = 5

[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 24h

[nginx-http-auth]
enabled = true
filter = nginx-http-auth
port = http,https
logpath = /var/log/nginx/error.log

[nginx-limit-req]
enabled = true
filter = nginx-limit-req
port = http,https
logpath = /var/log/nginx/error.log
EOF

systemctl enable fail2ban
systemctl restart fail2ban

echo -e "${GREEN}✓ Fail2ban configured${NC}"

# ===========================================
# Create Installation Directory
# ===========================================
echo ""
echo -e "${BLUE}Creating installation directory...${NC}"

mkdir -p /opt/gametaverns
mkdir -p /opt/gametaverns/backups
mkdir -p /opt/gametaverns/logs

echo -e "${GREEN}✓ /opt/gametaverns created${NC}"

# ===========================================
# Summary
# ===========================================
echo ""
echo -e "${CYAN}╔═══════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║         Bootstrap Complete!                                       ║${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}Your server is ready for GameTaverns installation.${NC}"
echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo ""
echo "  1. Clone the repository:"
echo -e "     ${YELLOW}git clone https://github.com/GameTaverns/GameTaverns.git /opt/gametaverns${NC}"
echo ""
echo "  2. Run the installer:"
echo -e "     ${YELLOW}cd /opt/gametaverns/deploy/supabase-selfhosted${NC}"
echo -e "     ${YELLOW}sudo ./install.sh${NC}"
echo ""
echo "  The installer will handle everything else:"
echo "    • Database setup & migrations"
echo "    • Frontend & backend build"
echo "    • Mail server configuration"
echo "    • SSL certificate setup"
echo "    • Admin user creation"
echo "    • API key configuration"
echo ""
echo -e "${BLUE}Installed Components:${NC}"
echo "  ✓ Docker $(docker --version | cut -d' ' -f3 | tr -d ',')"
echo "  ✓ Docker Compose $(docker compose version --short)"
echo "  ✓ Nginx $(nginx -v 2>&1 | cut -d'/' -f2)"
echo "  ✓ Certbot (for SSL)"
echo "  ✓ UFW Firewall (enabled)"
echo "  ✓ Fail2ban (enabled)"
echo "  ✓ Git, curl, jq, htop, and utilities"
echo ""
echo -e "${GREEN}Happy gaming! 🎲${NC}"
echo ""
