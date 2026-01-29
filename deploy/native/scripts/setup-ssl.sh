#!/bin/bash
#
# GameTaverns SSL Setup Script
# Configures Let's Encrypt certificates using Nginx plugin
#
# Usage: 
#   ./setup-ssl.sh                    # Interactive mode
#   ./setup-ssl.sh gametaverns.com    # Specify domain
#

set -e

INSTALL_DIR="/opt/gametaverns"
CREDENTIALS_FILE="/root/gametaverns-credentials.txt"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo ""
echo "╔═══════════════════════════════════════════════════════════════════╗"
echo "║          GameTaverns - SSL Certificate Setup                      ║"
echo "╚═══════════════════════════════════════════════════════════════════╝"
echo ""

# Get domain
if [[ -n "$1" ]]; then
    DOMAIN="$1"
elif [[ -f "$CREDENTIALS_FILE" ]]; then
    source "$CREDENTIALS_FILE"
fi

if [[ -z "$DOMAIN" ]]; then
    read -p "Enter your domain (e.g., gametaverns.com): " DOMAIN
fi

if [[ -z "$DOMAIN" ]]; then
    echo -e "${RED}[ERROR]${NC} Domain is required"
    exit 1
fi

echo "Domain: ${DOMAIN}"
echo ""

# Check if certbot is installed
if ! command -v certbot &>/dev/null; then
    echo -e "${YELLOW}[INFO]${NC} Installing certbot..."
    apt-get update -qq
    apt-get install -y certbot python3-certbot-nginx -qq
fi

# Check if nginx is running
if ! systemctl is-active --quiet nginx; then
    echo -e "${RED}[ERROR]${NC} Nginx is not running. Start it first:"
    echo "  sudo systemctl start nginx"
    exit 1
fi

# Prompt for email
read -p "Email for Let's Encrypt notifications: " EMAIL

if [[ -z "$EMAIL" ]]; then
    echo -e "${RED}[ERROR]${NC} Email is required"
    exit 1
fi

echo ""
echo -e "${YELLOW}[INFO]${NC} Obtaining certificates..."
echo ""

# Try the simpler nginx plugin first (works for non-wildcard)
# This is the easiest method and works with Cloudflare proxy too
if certbot --nginx \
    --non-interactive \
    --agree-tos \
    --email "${EMAIL}" \
    --redirect \
    -d "${DOMAIN}" \
    -d "www.${DOMAIN}" 2>/dev/null; then
    
    echo ""
    echo -e "${GREEN}[OK]${NC} SSL certificates installed!"
    
else
    echo -e "${YELLOW}[INFO]${NC} Standard method failed, trying alternate..."
    
    # Try without www
    if certbot --nginx \
        --non-interactive \
        --agree-tos \
        --email "${EMAIL}" \
        --redirect \
        -d "${DOMAIN}" 2>/dev/null; then
        
        echo ""
        echo -e "${GREEN}[OK]${NC} SSL certificate installed for ${DOMAIN}"
    else
        echo ""
        echo -e "${RED}[ERROR]${NC} Automatic certificate generation failed."
        echo ""
        echo "Common issues:"
        echo "  1. Domain doesn't point to this server yet"
        echo "  2. Ports 80/443 blocked by firewall"
        echo "  3. Using Cloudflare proxy (set to DNS-only temporarily)"
        echo ""
        echo "Manual command:"
        echo "  sudo certbot --nginx -d ${DOMAIN}"
        echo ""
        exit 1
    fi
fi

# Also try to get cert for mail subdomain
echo ""
echo -e "${YELLOW}[INFO]${NC} Attempting mail subdomain certificate..."
certbot --nginx \
    --non-interactive \
    --agree-tos \
    --email "${EMAIL}" \
    -d "mail.${DOMAIN}" 2>/dev/null || echo -e "${YELLOW}[WARN]${NC} Mail cert skipped (may not be needed)"

# Verify auto-renewal is set up
echo ""
echo -e "${YELLOW}[INFO]${NC} Enabling auto-renewal..."
systemctl enable certbot.timer 2>/dev/null || true
systemctl start certbot.timer 2>/dev/null || true

# Test renewal
echo -e "${YELLOW}[INFO]${NC} Testing renewal..."
certbot renew --dry-run 2>/dev/null && echo -e "${GREEN}[OK]${NC} Auto-renewal working" || echo -e "${YELLOW}[WARN]${NC} Renewal test failed"

echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║          SSL Setup Complete!                                      ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "Your site is now available at:"
echo -e "  ${GREEN}https://${DOMAIN}${NC}"
echo ""
echo "Certificates will auto-renew every 60-90 days."
echo ""
