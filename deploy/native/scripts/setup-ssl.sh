#!/bin/bash
#
# GameTaverns SSL Setup Script
# Configures Let's Encrypt certificates for the domain
#
# Usage: ./setup-ssl.sh <domain>
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

if [[ -z "$1" ]]; then
    echo "Usage: $0 <domain>"
    echo ""
    echo "Example: $0 gametaverns.com"
    exit 1
fi

DOMAIN="$1"

echo ""
echo "╔═══════════════════════════════════════════════════════════════════╗"
echo "║          GameTaverns SSL Setup                                    ║"
echo "╚═══════════════════════════════════════════════════════════════════╝"
echo ""

# Check if certbot is installed
if ! command -v certbot &> /dev/null; then
    echo -e "${YELLOW}[INFO]${NC} Installing certbot..."
    apt-get update
    apt-get install -y certbot python3-certbot-nginx
fi

# Prompt for email
read -p "Enter your email for Let's Encrypt notifications: " EMAIL

echo ""
echo -e "${YELLOW}[INFO]${NC} Obtaining certificates for:"
echo "  - ${DOMAIN}"
echo "  - *.${DOMAIN} (wildcard)"
echo "  - mail.${DOMAIN}"
echo ""

# For wildcard certs, we need DNS challenge
echo -e "${YELLOW}NOTE:${NC} Wildcard certificates require DNS verification."
echo "You will need to add TXT records to your DNS configuration."
echo ""
read -p "Press Enter to continue..."

# Request certificates
certbot certonly \
    --manual \
    --preferred-challenges dns \
    --email "${EMAIL}" \
    --agree-tos \
    --no-eff-email \
    -d "${DOMAIN}" \
    -d "*.${DOMAIN}"

# Check if successful
if [[ -d "/etc/letsencrypt/live/${DOMAIN}" ]]; then
    echo -e "${GREEN}[OK]${NC} Certificates obtained!"
    
    # Update Nginx configuration
    echo -e "${YELLOW}[INFO]${NC} Updating Nginx configuration..."
    
    # Add SSL to main site
    sed -i "s|listen 80;|listen 80;\n    listen 443 ssl http2;\n    ssl_certificate /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;\n    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;\n    include /etc/letsencrypt/options-ssl-nginx.conf;\n    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;|g" /etc/nginx/sites-available/gametaverns
    
    # Add HTTPS redirect
    cat >> /etc/nginx/sites-available/gametaverns <<EOF

# HTTPS Redirect
server {
    listen 80;
    server_name ${DOMAIN} *.${DOMAIN};
    return 301 https://\$host\$request_uri;
}
EOF
    
    nginx -t && systemctl reload nginx
    
    echo -e "${GREEN}[OK]${NC} Nginx updated with SSL"
    
    # Setup auto-renewal
    echo -e "${YELLOW}[INFO]${NC} Setting up auto-renewal..."
    systemctl enable certbot.timer
    systemctl start certbot.timer
    
    echo ""
    echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║          SSL Setup Complete!                                      ║${NC}"
    echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo "Your site is now accessible via HTTPS:"
    echo "  https://${DOMAIN}"
    echo ""
    echo "Certificates will auto-renew via certbot timer."
    echo ""
else
    echo -e "${RED}[ERROR]${NC} Certificate generation failed"
    echo "Check the certbot output above for details."
    exit 1
fi
