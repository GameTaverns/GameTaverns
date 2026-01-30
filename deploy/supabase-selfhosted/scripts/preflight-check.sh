#!/bin/bash
# =============================================================================
# GameTaverns - Pre-flight Check Script
# Validates system requirements before installation
# =============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ERRORS=0
WARNINGS=0

echo "=============================================="
echo "  GameTaverns Pre-flight Check"
echo "=============================================="
echo ""

# ===========================================
# Check OS
# ===========================================
echo -n "Checking OS... "
if [ -f /etc/os-release ]; then
    . /etc/os-release
    if [[ "$ID" == "ubuntu" ]]; then
        if [[ "$VERSION_ID" == "22.04" || "$VERSION_ID" == "24.04" ]]; then
            echo -e "${GREEN}✓ Ubuntu $VERSION_ID${NC}"
        else
            echo -e "${YELLOW}⚠ Ubuntu $VERSION_ID (22.04 or 24.04 recommended)${NC}"
            ((WARNINGS++))
        fi
    else
        echo -e "${YELLOW}⚠ $PRETTY_NAME (Ubuntu recommended)${NC}"
        ((WARNINGS++))
    fi
else
    echo -e "${RED}✗ Cannot detect OS${NC}"
    ((ERRORS++))
fi

# ===========================================
# Check RAM
# ===========================================
echo -n "Checking RAM... "
TOTAL_RAM=$(free -m | awk '/^Mem:/{print $2}')
if [ "$TOTAL_RAM" -ge 4000 ]; then
    echo -e "${GREEN}✓ ${TOTAL_RAM}MB (4GB+ recommended)${NC}"
elif [ "$TOTAL_RAM" -ge 2000 ]; then
    echo -e "${YELLOW}⚠ ${TOTAL_RAM}MB (4GB recommended, may work with 2GB)${NC}"
    ((WARNINGS++))
else
    echo -e "${RED}✗ ${TOTAL_RAM}MB (minimum 2GB required)${NC}"
    ((ERRORS++))
fi

# ===========================================
# Check Disk Space
# ===========================================
echo -n "Checking disk space... "
FREE_DISK=$(df -BG / | awk 'NR==2 {print $4}' | tr -d 'G')
if [ "$FREE_DISK" -ge 50 ]; then
    echo -e "${GREEN}✓ ${FREE_DISK}GB free${NC}"
elif [ "$FREE_DISK" -ge 20 ]; then
    echo -e "${YELLOW}⚠ ${FREE_DISK}GB free (50GB recommended)${NC}"
    ((WARNINGS++))
else
    echo -e "${RED}✗ ${FREE_DISK}GB free (minimum 20GB required)${NC}"
    ((ERRORS++))
fi

# ===========================================
# Check Docker
# ===========================================
echo -n "Checking Docker... "
if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version | awk '{print $3}' | tr -d ',')
    echo -e "${GREEN}✓ Docker $DOCKER_VERSION${NC}"
    
    # Check Docker is running
    echo -n "Checking Docker daemon... "
    if docker info &> /dev/null; then
        echo -e "${GREEN}✓ Running${NC}"
    else
        echo -e "${RED}✗ Not running (try: sudo systemctl start docker)${NC}"
        ((ERRORS++))
    fi
else
    echo -e "${YELLOW}⚠ Not installed (will be installed)${NC}"
    ((WARNINGS++))
fi

# ===========================================
# Check Docker Compose
# ===========================================
echo -n "Checking Docker Compose... "
if command -v docker &> /dev/null && docker compose version &> /dev/null; then
    COMPOSE_VERSION=$(docker compose version --short 2>/dev/null || echo "unknown")
    echo -e "${GREEN}✓ Docker Compose $COMPOSE_VERSION${NC}"
elif command -v docker-compose &> /dev/null; then
    COMPOSE_VERSION=$(docker-compose --version | awk '{print $4}' | tr -d ',')
    echo -e "${YELLOW}⚠ Legacy docker-compose $COMPOSE_VERSION (upgrade recommended)${NC}"
    ((WARNINGS++))
else
    echo -e "${YELLOW}⚠ Not installed (will be installed with Docker)${NC}"
    ((WARNINGS++))
fi

# ===========================================
# Check Port Availability
# ===========================================
echo ""
echo "Checking port availability..."

check_port() {
    local port=$1
    local service=$2
    echo -n "  Port $port ($service)... "
    if ss -tuln | grep -q ":$port "; then
        PROCESS=$(ss -tuln | grep ":$port " | head -1)
        echo -e "${RED}✗ In use${NC}"
        echo "    $PROCESS"
        ((ERRORS++))
    else
        echo -e "${GREEN}✓ Available${NC}"
    fi
}

check_port 80 "HTTP"
check_port 443 "HTTPS"
check_port 3000 "Frontend"
check_port 3001 "Studio"
check_port 5432 "PostgreSQL"
check_port 8000 "Kong API"
check_port 25 "SMTP"
check_port 587 "SMTP Submission"
check_port 993 "IMAPS"

# ===========================================
# Check DNS
# ===========================================
echo ""
echo -n "Checking DNS resolution... "
if host google.com &> /dev/null; then
    echo -e "${GREEN}✓ Working${NC}"
else
    echo -e "${RED}✗ DNS resolution failed${NC}"
    ((ERRORS++))
fi

# ===========================================
# Check Internet Connectivity
# ===========================================
echo -n "Checking internet connectivity... "
if curl -s --connect-timeout 5 https://hub.docker.com > /dev/null; then
    echo -e "${GREEN}✓ Can reach Docker Hub${NC}"
else
    echo -e "${RED}✗ Cannot reach Docker Hub${NC}"
    ((ERRORS++))
fi

# ===========================================
# Check for Previous Installation
# ===========================================
echo ""
echo -n "Checking for existing installation... "
if [ -d "/opt/gametaverns" ]; then
    echo -e "${YELLOW}⚠ Found /opt/gametaverns (will be preserved)${NC}"
    ((WARNINGS++))
else
    echo -e "${GREEN}✓ Clean install${NC}"
fi

# ===========================================
# Summary
# ===========================================
echo ""
echo "=============================================="
echo "  Summary"
echo "=============================================="

if [ $ERRORS -gt 0 ]; then
    echo -e "${RED}✗ $ERRORS error(s) found - fix before proceeding${NC}"
    exit 1
elif [ $WARNINGS -gt 0 ]; then
    echo -e "${YELLOW}⚠ $WARNINGS warning(s) - installation may proceed${NC}"
    exit 0
else
    echo -e "${GREEN}✓ All checks passed - ready to install${NC}"
    exit 0
fi
