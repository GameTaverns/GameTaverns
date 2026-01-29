#!/bin/bash
#
# Pre-flight check for GameTaverns installation
# Run this BEFORE install.sh to verify your server meets requirements
#
# Usage: ./preflight-check.sh
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

echo ""
echo -e "${BOLD}${BLUE}╔═══════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${BLUE}║          GameTaverns - Pre-flight Check                           ║${NC}"
echo -e "${BOLD}${BLUE}╚═══════════════════════════════════════════════════════════════════╝${NC}"
echo ""

ERRORS=0
WARNINGS=0

check_pass() {
    echo -e "${GREEN}[✓]${NC} $1"
}

check_warn() {
    echo -e "${YELLOW}[!]${NC} $1"
    ((WARNINGS++))
}

check_fail() {
    echo -e "${RED}[✗]${NC} $1"
    ((ERRORS++))
}

# ═══════════════════════════════════════════════════════════════════
# System Checks
# ═══════════════════════════════════════════════════════════════════

echo -e "${BOLD}System Requirements:${NC}"
echo ""

# Check root
if [[ $EUID -eq 0 ]]; then
    check_pass "Running as root"
else
    check_fail "Must run as root (use sudo)"
fi

# Check Ubuntu version
if grep -q "Ubuntu 24" /etc/os-release 2>/dev/null; then
    check_pass "Ubuntu 24.04 LTS detected"
elif grep -q "Ubuntu 22" /etc/os-release 2>/dev/null; then
    check_warn "Ubuntu 22.04 detected (24.04 recommended)"
else
    check_fail "Ubuntu 24.04 LTS required"
fi

# Check RAM
TOTAL_RAM=$(free -m | awk '/^Mem:/{print $2}')
if [[ $TOTAL_RAM -ge 4000 ]]; then
    check_pass "RAM: ${TOTAL_RAM}MB (≥4GB required)"
elif [[ $TOTAL_RAM -ge 2000 ]]; then
    check_warn "RAM: ${TOTAL_RAM}MB (4GB recommended, 2GB minimum)"
else
    check_fail "RAM: ${TOTAL_RAM}MB (minimum 2GB required)"
fi

# Check disk space
DISK_FREE=$(df -m / | awk 'NR==2 {print $4}')
if [[ $DISK_FREE -ge 20000 ]]; then
    check_pass "Disk space: $((DISK_FREE/1024))GB free (≥20GB required)"
elif [[ $DISK_FREE -ge 10000 ]]; then
    check_warn "Disk space: $((DISK_FREE/1024))GB free (20GB recommended)"
else
    check_fail "Disk space: $((DISK_FREE/1024))GB free (minimum 10GB required)"
fi

# Check CPU cores
CPU_CORES=$(nproc)
if [[ $CPU_CORES -ge 2 ]]; then
    check_pass "CPU cores: ${CPU_CORES} (≥2 required)"
else
    check_warn "CPU cores: ${CPU_CORES} (2+ recommended)"
fi

# ═══════════════════════════════════════════════════════════════════
# Network Checks
# ═══════════════════════════════════════════════════════════════════

echo ""
echo -e "${BOLD}Network:${NC}"
echo ""

# Check internet connectivity
if ping -c 1 -W 3 google.com &>/dev/null; then
    check_pass "Internet connectivity OK"
else
    check_fail "No internet connection"
fi

# Check if ports are available
check_port() {
    local port=$1
    local name=$2
    if ss -tlnp | grep -q ":${port} "; then
        check_warn "Port ${port} (${name}) is already in use"
    else
        check_pass "Port ${port} (${name}) is available"
    fi
}

check_port 80 "HTTP"
check_port 443 "HTTPS"
check_port 3001 "API"
check_port 5432 "PostgreSQL"
check_port 25 "SMTP"

# ═══════════════════════════════════════════════════════════════════
# Existing Installation Check
# ═══════════════════════════════════════════════════════════════════

echo ""
echo -e "${BOLD}Existing Installation:${NC}"
echo ""

if [[ -d "/opt/gametaverns" ]]; then
    check_warn "/opt/gametaverns already exists (will be updated)"
else
    check_pass "/opt/gametaverns is clear"
fi

if command -v psql &>/dev/null; then
    PG_VERSION=$(psql --version 2>/dev/null | grep -oP '\d+' | head -1)
    if [[ "$PG_VERSION" -ge 16 ]]; then
        check_pass "PostgreSQL $PG_VERSION already installed"
    elif [[ -n "$PG_VERSION" ]]; then
        check_warn "PostgreSQL $PG_VERSION found (16 will be installed)"
    fi
else
    check_pass "PostgreSQL will be installed"
fi

if command -v node &>/dev/null; then
    NODE_VER=$(node --version 2>/dev/null)
    check_warn "Node.js $NODE_VER found (22 will be installed)"
else
    check_pass "Node.js will be installed"
fi

# ═══════════════════════════════════════════════════════════════════
# DNS Check (optional)
# ═══════════════════════════════════════════════════════════════════

echo ""
echo -e "${BOLD}DNS (Optional - configure after install):${NC}"
echo ""

PUBLIC_IP=$(curl -s ifconfig.me 2>/dev/null || echo "unknown")
if [[ "$PUBLIC_IP" != "unknown" ]]; then
    check_pass "Public IP: ${PUBLIC_IP}"
else
    check_warn "Could not detect public IP"
fi

# ═══════════════════════════════════════════════════════════════════
# Summary
# ═══════════════════════════════════════════════════════════════════

echo ""
echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"
echo ""

if [[ $ERRORS -eq 0 ]]; then
    if [[ $WARNINGS -eq 0 ]]; then
        echo -e "${GREEN}[✓] All checks passed! Ready to install.${NC}"
    else
        echo -e "${YELLOW}[!] ${WARNINGS} warning(s), but OK to proceed.${NC}"
    fi
    echo ""
    echo "Run the installer:"
    echo "  cd /opt/gametaverns/deploy/native"
    echo "  sudo ./install.sh"
    echo ""
else
    echo -e "${RED}[✗] ${ERRORS} error(s) found. Fix issues before installing.${NC}"
    echo ""
    exit 1
fi
