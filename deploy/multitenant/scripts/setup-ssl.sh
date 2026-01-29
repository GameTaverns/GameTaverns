#!/bin/bash

# ============================================
# Setup Let's Encrypt SSL
# ============================================
# Obtains SSL certificates for main domain and wildcard

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Load config
if [ ! -f ".env" ]; then
    echo -e "${RED}✗ .env file not found. Run install.sh first.${NC}"
    exit 1
fi

source .env

echo -e "${BLUE}=== Setting up Let's Encrypt SSL ===${NC}"
echo ""
echo "Domain: ${DOMAIN}"
echo "Email: ${ADMIN_EMAIL}"
echo ""

# Check if certbot is running
if docker compose ps certbot 2>/dev/null | grep -q "Up"; then
    echo -e "${GREEN}✓ Certbot container is running${NC}"
else
    echo -e "${YELLOW}Starting certbot container...${NC}"
    docker compose --profile production up -d certbot
fi

# Request certificate
echo ""
echo -e "${BLUE}Requesting SSL certificate...${NC}"
echo ""

docker compose run --rm certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email "${ADMIN_EMAIL}" \
    --agree-tos \
    --no-eff-email \
    -d "${DOMAIN}" \
    -d "www.${DOMAIN}"

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✓ SSL certificate obtained for ${DOMAIN}${NC}"
    echo ""
    echo -e "${YELLOW}Note: For wildcard certificates (*.${DOMAIN}), you need DNS validation.${NC}"
    echo "Consider using Cloudflare for automatic wildcard SSL."
    echo ""
    
    # Reload nginx
    echo "Reloading nginx..."
    docker compose exec proxy nginx -s reload
    
    echo -e "${GREEN}✓ SSL setup complete!${NC}"
else
    echo -e "${RED}✗ Failed to obtain SSL certificate${NC}"
    echo ""
    echo "Common issues:"
    echo "  1. Port 80 is not open to the internet"
    echo "  2. DNS is not pointing to this server"
    echo "  3. Domain is behind Cloudflare proxy (use Cloudflare SSL instead)"
    exit 1
fi
