#!/bin/bash
#
# GameTaverns SSL Setup Script
# Configures Let's Encrypt certificates using Nginx plugin
#
# Usage: 
#   ./setup-ssl.sh                    # Interactive mode
#   ./setup-ssl.sh gametaverns.com    # Specify domain
#   ./setup-ssl.sh --wildcard         # Wildcard cert (requires DNS plugin)
#

set -e

INSTALL_DIR="/opt/gametaverns"
CREDENTIALS_FILE="/root/gametaverns-credentials.txt"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo ""
echo "╔═══════════════════════════════════════════════════════════════════╗"
echo "║          GameTaverns - SSL Certificate Setup                      ║"
echo "╚═══════════════════════════════════════════════════════════════════╝"
echo ""

# Parse arguments
WILDCARD_MODE=false
DOMAIN=""

for arg in "$@"; do
    case $arg in
        --wildcard)
            WILDCARD_MODE=true
            ;;
        *)
            DOMAIN="$arg"
            ;;
    esac
done

# Get domain from credentials if not provided
if [[ -z "$DOMAIN" ]] && [[ -f "$CREDENTIALS_FILE" ]]; then
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

# Handle wildcard certificate request
if [[ "$WILDCARD_MODE" == "true" ]]; then
    echo -e "${CYAN}╔═══════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║          Wildcard Certificate Setup                               ║${NC}"
    echo -e "${CYAN}╚═══════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${YELLOW}[INFO]${NC} Wildcard certificates (*.${DOMAIN}) require DNS-01 challenge."
    echo ""
    echo "The nginx plugin cannot be used for wildcards. You have two options:"
    echo ""
    echo -e "${GREEN}Option 1: Manual DNS Challenge${NC}"
    echo "  Run this command and add the TXT record when prompted:"
    echo -e "  ${CYAN}sudo certbot certonly --manual --preferred-challenges dns -d ${DOMAIN} -d '*.${DOMAIN}'${NC}"
    echo ""
    echo -e "${GREEN}Option 2: Cloudflare DNS Plugin (automated)${NC}"
    echo "  1. Install the plugin:"
    echo -e "     ${CYAN}apt install python3-certbot-dns-cloudflare${NC}"
    echo ""
    echo "  2. Create credentials file /root/.cloudflare.ini:"
    echo -e "     ${CYAN}dns_cloudflare_api_token = YOUR_API_TOKEN${NC}"
    echo -e "     ${CYAN}chmod 600 /root/.cloudflare.ini${NC}"
    echo ""
    echo "  3. Run certbot with DNS plugin:"
    echo -e "     ${CYAN}sudo certbot certonly --dns-cloudflare --dns-cloudflare-credentials /root/.cloudflare.ini -d ${DOMAIN} -d '*.${DOMAIN}'${NC}"
    echo ""
    echo "  4. After obtaining cert, run this script again WITHOUT --wildcard to configure nginx."
    echo ""
    echo -e "${YELLOW}[NOTE]${NC} For most setups, individual subdomain certs work fine."
    echo "       Only use wildcard if you have many dynamic subdomains."
    echo ""
    exit 0
fi

echo -e "${YELLOW}[INFO]${NC} Obtaining certificates for specific domains..."
echo ""

# Request certs for root domain and www first
if certbot --nginx \
    --non-interactive \
    --agree-tos \
    --email "${EMAIL}" \
    --redirect \
    -d "${DOMAIN}" \
    -d "www.${DOMAIN}" 2>/dev/null; then
    
    echo ""
    echo -e "${GREEN}[OK]${NC} SSL certificates installed for ${DOMAIN} and www.${DOMAIN}"
    
else
    echo -e "${YELLOW}[INFO]${NC} www subdomain failed, trying root domain only..."
    
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

# Request separate certs for subdomains (NOT combined with wildcard)
echo ""
echo -e "${YELLOW}[INFO]${NC} Attempting mail subdomain certificate..."
if certbot --nginx \
    --non-interactive \
    --agree-tos \
    --email "${EMAIL}" \
    -d "mail.${DOMAIN}" 2>/dev/null; then
    echo -e "${GREEN}[OK]${NC} Mail subdomain certificate installed"
else
    echo -e "${YELLOW}[WARN]${NC} Mail cert skipped (subdomain may not be configured)"
fi

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
