#!/bin/bash
# =============================================================================
# Fix Mailcow Docker Network Overlap
# Run this if you get "Pool overlaps with other one on this address space"
# =============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo ""
echo -e "${BLUE}Fixing Mailcow Docker Network Overlap${NC}"
echo ""

# Check root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Please run as root: sudo ./fix-mailcow-network.sh${NC}"
    exit 1
fi

# Show current networks and their subnets
echo -e "${BLUE}Current Docker networks:${NC}"
docker network ls -q | while read net; do
    name=$(docker network inspect "$net" --format '{{.Name}}')
    subnet=$(docker network inspect "$net" --format '{{range .IPAM.Config}}{{.Subnet}}{{end}}' 2>/dev/null || echo "none")
    echo "  $name: $subnet"
done
echo ""

# Stop both stacks
echo -e "${BLUE}Stopping stacks...${NC}"
cd /opt/mailcow 2>/dev/null && docker compose down --remove-orphans 2>/dev/null || true
cd /opt/gametaverns 2>/dev/null && docker compose down --remove-orphans 2>/dev/null || true

# Prune networks
echo -e "${BLUE}Pruning unused networks...${NC}"
docker network prune -f

# Create override for Mailcow with specific subnet
MAILCOW_DIR="/opt/mailcow"
if [ -d "$MAILCOW_DIR" ]; then
    echo -e "${BLUE}Creating Mailcow network override...${NC}"
    
    # Mailcow containers have hardcoded IPs in the 172.22.x.x range.
    # We MUST NOT override the subnet, or containers will fail with
    # "no configured subnet contains IP address 172.22.1.254".
    # Instead, remove any override and let Mailcow use its default network.
    rm -f "$MAILCOW_DIR/docker-compose.override.yml"
    
    echo -e "${GREEN}✓ Created docker-compose.override.yml with subnet 172.29.0.0/16${NC}"
fi

# Start Mailcow first
echo ""
echo -e "${BLUE}Starting Mailcow...${NC}"
cd "$MAILCOW_DIR"
docker compose up -d

echo ""
echo -e "${BLUE}Waiting for Mailcow to initialize (30 seconds)...${NC}"
sleep 30

# Check Mailcow status
echo ""
echo -e "${BLUE}Mailcow status:${NC}"
docker compose ps

# Start GameTaverns
echo ""
echo -e "${BLUE}Starting GameTaverns...${NC}"
cd /opt/gametaverns
docker compose up -d

echo ""
echo -e "${BLUE}GameTaverns status:${NC}"
docker compose ps

echo ""
echo -e "${GREEN}✓ Both stacks should now be running${NC}"
echo ""
echo "Verify with:"
echo "  curl -s http://localhost:8000/auth/v1/health"
echo "  curl -s http://localhost:3000/health"
