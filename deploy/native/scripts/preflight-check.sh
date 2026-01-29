#!/bin/bash
#
# Pre-flight check for GameTaverns installation
# Run BEFORE install.sh to verify your server is ready
#
# Usage: ./preflight-check.sh
#

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
    echo -e "${GREEN}✓${NC} $1"
}

check_warn() {
    echo -e "${YELLOW}!${NC} $1"
    ((WARNINGS++))
}

check_fail() {
    echo -e "${RED}✗${NC} $1"
    ((ERRORS++))
}

# ═══════════════════════════════════════════════════════════════════
# System Checks
# ═══════════════════════════════════════════════════════════════════

echo -e "${BOLD}System:${NC}"
echo ""

# Check root
if [[ $EUID -eq 0 ]]; then
    check_pass "Running as root"
else
    check_fail "Must run as root (use: sudo ./preflight-check.sh)"
fi

# Check Ubuntu version
if grep -q "Ubuntu 24" /etc/os-release 2>/dev/null; then
    check_pass "Ubuntu 24.04 LTS"
elif grep -q "Ubuntu 22" /etc/os-release 2>/dev/null; then
    check_warn "Ubuntu 22.04 (24.04 recommended)"
elif grep -q "Ubuntu" /etc/os-release 2>/dev/null; then
    check_fail "Unsupported Ubuntu version (need 24.04)"
else
    check_fail "Not Ubuntu (need Ubuntu 24.04 LTS)"
fi

# Check RAM
TOTAL_RAM=$(free -m | awk '/^Mem:/{print $2}')
if [[ $TOTAL_RAM -ge 4000 ]]; then
    check_pass "RAM: ${TOTAL_RAM} MB (4+ GB)"
elif [[ $TOTAL_RAM -ge 2000 ]]; then
    check_warn "RAM: ${TOTAL_RAM} MB (4 GB recommended)"
else
    check_fail "RAM: ${TOTAL_RAM} MB (need 2+ GB)"
fi

# Check disk space
DISK_FREE=$(df -m / | awk 'NR==2 {print $4}')
if [[ $DISK_FREE -ge 20000 ]]; then
    check_pass "Disk: $((DISK_FREE/1024)) GB free"
elif [[ $DISK_FREE -ge 10000 ]]; then
    check_warn "Disk: $((DISK_FREE/1024)) GB free (20 GB recommended)"
else
    check_fail "Disk: $((DISK_FREE/1024)) GB free (need 10+ GB)"
fi

# Check CPU cores
CPU_CORES=$(nproc)
if [[ $CPU_CORES -ge 2 ]]; then
    check_pass "CPU: ${CPU_CORES} cores"
else
    check_warn "CPU: ${CPU_CORES} core (2+ recommended)"
fi

# ═══════════════════════════════════════════════════════════════════
# Network Checks
# ═══════════════════════════════════════════════════════════════════

echo ""
echo -e "${BOLD}Network:${NC}"
echo ""

# Check internet
if ping -c 1 -W 3 8.8.8.8 &>/dev/null; then
    check_pass "Internet connection"
elif ping -c 1 -W 3 1.1.1.1 &>/dev/null; then
    check_pass "Internet connection"
else
    check_fail "No internet connection"
fi

# Check DNS
if ping -c 1 -W 3 google.com &>/dev/null; then
    check_pass "DNS resolution"
else
    check_warn "DNS may not be working"
fi

# Check ports
check_port() {
    local port=$1
    local name=$2
    if ss -tlnp 2>/dev/null | grep -q ":${port} "; then
        check_warn "Port ${port} (${name}) in use"
    else
        check_pass "Port ${port} (${name}) available"
    fi
}

check_port 80 "HTTP"
check_port 443 "HTTPS"
check_port 3001 "API"
check_port 5432 "PostgreSQL"

# Get public IP
PUBLIC_IP=$(curl -s --max-time 5 ifconfig.me 2>/dev/null || curl -s --max-time 5 icanhazip.com 2>/dev/null || echo "unknown")
if [[ "$PUBLIC_IP" != "unknown" && "$PUBLIC_IP" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    check_pass "Public IP: ${PUBLIC_IP}"
else
    check_warn "Could not detect public IP"
fi

# ═══════════════════════════════════════════════════════════════════
# Existing Software
# ═══════════════════════════════════════════════════════════════════

echo ""
echo -e "${BOLD}Existing Software:${NC}"
echo ""

if [[ -d "/opt/gametaverns" ]]; then
    check_warn "Previous installation found (will be updated)"
else
    check_pass "Clean installation directory"
fi

if command -v psql &>/dev/null; then
    PG_VERSION=$(psql --version 2>/dev/null | grep -oP '\d+' | head -1 || echo "?")
    check_warn "PostgreSQL ${PG_VERSION} found (will use existing or upgrade)"
else
    check_pass "PostgreSQL will be installed"
fi

if command -v node &>/dev/null; then
    NODE_VER=$(node --version 2>/dev/null || echo "?")
    check_warn "Node.js ${NODE_VER} found (will use v22)"
else
    check_pass "Node.js will be installed"
fi

if command -v nginx &>/dev/null; then
    check_warn "Nginx found (config will be updated)"
else
    check_pass "Nginx will be installed"
fi

# ═══════════════════════════════════════════════════════════════════
# Summary
# ═══════════════════════════════════════════════════════════════════

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo ""

if [[ $ERRORS -eq 0 ]]; then
    if [[ $WARNINGS -eq 0 ]]; then
        echo -e "${GREEN}✓ All checks passed!${NC} Ready to install."
    else
        echo -e "${YELLOW}! ${WARNINGS} warning(s)${NC} but OK to proceed."
    fi
    echo ""
    echo "Next step:"
    echo -e "  ${BOLD}sudo ./install.sh${NC}"
    echo ""
else
    echo -e "${RED}✗ ${ERRORS} error(s) found.${NC} Fix before installing."
    echo ""
    exit 1
fi
