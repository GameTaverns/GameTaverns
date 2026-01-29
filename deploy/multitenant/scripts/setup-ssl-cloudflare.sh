#!/bin/bash

# ============================================
# Setup Cloudflare DNS SSL (Wildcard)
# ============================================
# Uses Cloudflare DNS challenge for wildcard certificates

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

if [ -z "$CLOUDFLARE_API_TOKEN" ]; then
    echo -e "${RED}✗ CLOUDFLARE_API_TOKEN not set in .env${NC}"
    echo "Get your API token from: https://dash.cloudflare.com/profile/api-tokens"
    echo "Required permissions: Zone:DNS:Edit"
    exit 1
fi

echo -e "${BLUE}=== Setting up Cloudflare Wildcard SSL ===${NC}"
echo ""
echo "Domain: ${DOMAIN}"
echo "Wildcard: *.${DOMAIN}"
echo ""

# Create Cloudflare credentials file
cat > nginx/ssl/cloudflare.ini << EOF
dns_cloudflare_api_token = ${CLOUDFLARE_API_TOKEN}
EOF
chmod 600 nginx/ssl/cloudflare.ini

# Request wildcard certificate using certbot with cloudflare plugin
echo -e "${BLUE}Requesting wildcard SSL certificate...${NC}"
echo ""

docker run --rm \
    -v "$(pwd)/nginx/ssl:/etc/letsencrypt" \
    -v "$(pwd)/nginx/ssl/cloudflare.ini:/etc/cloudflare.ini:ro" \
    certbot/dns-cloudflare certonly \
    --dns-cloudflare \
    --dns-cloudflare-credentials /etc/cloudflare.ini \
    --email "${ADMIN_EMAIL}" \
    --agree-tos \
    --no-eff-email \
    -d "${DOMAIN}" \
    -d "*.${DOMAIN}"

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✓ Wildcard SSL certificate obtained!${NC}"
    echo ""
    
    # Copy certificates to the expected location
    CERT_PATH="nginx/ssl/live/${DOMAIN}"
    if [ -d "$CERT_PATH" ]; then
        cp "${CERT_PATH}/fullchain.pem" nginx/ssl/
        cp "${CERT_PATH}/privkey.pem" nginx/ssl/
        echo -e "${GREEN}✓ Certificates copied to nginx/ssl/${NC}"
    fi
    
    # Update nginx config to use the new certs
    echo ""
    echo -e "${BLUE}Restarting proxy with new certificates...${NC}"
    docker compose --profile production restart proxy
    
    echo ""
    echo -e "${GREEN}╔═══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║              Wildcard SSL Setup Complete!                  ║${NC}"
    echo -e "${GREEN}╚═══════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo "Your site is now accessible at:"
    echo -e "  Main:      ${BLUE}https://${DOMAIN}${NC}"
    echo -e "  Libraries: ${BLUE}https://*.${DOMAIN}${NC}"
    echo ""
else
    echo -e "${RED}✗ Failed to obtain SSL certificate${NC}"
    echo ""
    echo "Common issues:"
    echo "  1. Cloudflare API token is invalid or expired"
    echo "  2. Token doesn't have DNS:Edit permission for ${DOMAIN}"
    echo "  3. Domain is not managed by Cloudflare"
    exit 1
fi
