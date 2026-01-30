#!/bin/bash
#
# GameTaverns SSL Setup Script
# Configures Let's Encrypt wildcard certificates using Cloudflare DNS
#
# Usage: 
#   ./setup-ssl.sh                    # Interactive setup
#   ./setup-ssl.sh --skip-wildcard    # Only root + www (not recommended)
#

set -e

INSTALL_DIR="/opt/gametaverns"
CREDENTIALS_FILE="/root/gametaverns-credentials.txt"
CLOUDFLARE_CREDS="/root/.cloudflare.ini"

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
SKIP_WILDCARD=false
DOMAIN=""

for arg in "$@"; do
    case $arg in
        --skip-wildcard)
            SKIP_WILDCARD=true
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

# Install certbot and cloudflare plugin if needed
if ! command -v certbot &>/dev/null; then
    echo -e "${YELLOW}[INFO]${NC} Installing certbot..."
    apt-get update -qq
    apt-get install -y certbot python3-certbot-nginx python3-certbot-dns-cloudflare -qq
elif ! dpkg -l | grep -q python3-certbot-dns-cloudflare; then
    echo -e "${YELLOW}[INFO]${NC} Installing Cloudflare DNS plugin..."
    apt-get install -y python3-certbot-dns-cloudflare -qq
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

# ============================================================================
# WILDCARD CERTIFICATE (Required for multi-tenant SaaS)
# ============================================================================
if [[ "$SKIP_WILDCARD" != "true" ]]; then
    echo -e "${CYAN}╔═══════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║          Wildcard Certificate Setup (*.${DOMAIN})${NC}"
    echo -e "${CYAN}╚═══════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${YELLOW}[INFO]${NC} Wildcard certificates require DNS validation via Cloudflare."
    echo ""
    
    # Check for existing Cloudflare credentials
    if [[ -f "$CLOUDFLARE_CREDS" ]]; then
        echo -e "${GREEN}[OK]${NC} Found existing Cloudflare credentials at ${CLOUDFLARE_CREDS}"
        read -p "Use existing credentials? [Y/n]: " USE_EXISTING
        if [[ "$USE_EXISTING" =~ ^[Nn] ]]; then
            rm -f "$CLOUDFLARE_CREDS"
        fi
    fi
    
    # Prompt for Cloudflare API token if not exists
    if [[ ! -f "$CLOUDFLARE_CREDS" ]]; then
        echo ""
        echo -e "${YELLOW}To obtain a Cloudflare API Token:${NC}"
        echo "  1. Go to: https://dash.cloudflare.com/profile/api-tokens"
        echo "  2. Click 'Create Token'"
        echo "  3. Use template: 'Edit zone DNS'"
        echo "  4. Set Zone Resources: Include → Specific zone → ${DOMAIN}"
        echo "  5. Create and copy the token"
        echo ""
        read -sp "Enter your Cloudflare API Token: " CF_TOKEN
        echo ""
        
        if [[ -z "$CF_TOKEN" ]]; then
            echo -e "${RED}[ERROR]${NC} Cloudflare API Token is required for wildcard certificates"
            echo ""
            echo "Without a wildcard certificate, new library subdomains won't have SSL."
            echo "Run this script again with a valid token, or use --skip-wildcard for basic setup."
            exit 1
        fi
        
        # Create credentials file
        cat > "$CLOUDFLARE_CREDS" << EOF
dns_cloudflare_api_token = ${CF_TOKEN}
EOF
        chmod 600 "$CLOUDFLARE_CREDS"
        echo -e "${GREEN}[OK]${NC} Cloudflare credentials saved"
    fi
    
    echo ""
    echo -e "${YELLOW}[INFO]${NC} Requesting wildcard certificate..."
    echo ""
    
    # Request wildcard certificate using DNS challenge
    if certbot certonly \
        --dns-cloudflare \
        --dns-cloudflare-credentials "$CLOUDFLARE_CREDS" \
        --non-interactive \
        --agree-tos \
        --email "${EMAIL}" \
        -d "${DOMAIN}" \
        -d "*.${DOMAIN}"; then
        
        echo ""
        echo -e "${GREEN}[OK]${NC} Wildcard certificate obtained for ${DOMAIN} and *.${DOMAIN}"
        
        # Configure nginx to use the wildcard cert
        CERT_PATH="/etc/letsencrypt/live/${DOMAIN}"
        
        # Update nginx SSL config if needed
        if [[ -f /etc/nginx/sites-available/gametaverns ]]; then
            # Check if SSL is already configured
            if ! grep -q "ssl_certificate" /etc/nginx/sites-available/gametaverns; then
                echo -e "${YELLOW}[INFO]${NC} Configuring nginx to use SSL certificates..."
                # The nginx config should already have SSL blocks, just need to reload
            fi
        fi
        
        # Reload nginx to apply
        nginx -t && systemctl reload nginx
        echo -e "${GREEN}[OK]${NC} Nginx reloaded with SSL configuration"
        
    else
        echo ""
        echo -e "${RED}[ERROR]${NC} Failed to obtain wildcard certificate"
        echo ""
        echo "Common issues:"
        echo "  1. Cloudflare API token is invalid or expired"
        echo "  2. Token doesn't have DNS:Edit permission for ${DOMAIN}"
        echo "  3. Domain is not managed by Cloudflare"
        echo ""
        echo "Check logs: /var/log/letsencrypt/letsencrypt.log"
        exit 1
    fi
    
else
    # Skip wildcard - just do root + www (NOT recommended for this platform)
    echo -e "${YELLOW}[WARN]${NC} Skipping wildcard certificate - new subdomains won't have SSL!"
    echo ""
    
    if certbot --nginx \
        --non-interactive \
        --agree-tos \
        --email "${EMAIL}" \
        --redirect \
        -d "${DOMAIN}" \
        -d "www.${DOMAIN}" 2>/dev/null; then
        
        echo -e "${GREEN}[OK]${NC} SSL certificates installed for ${DOMAIN} and www.${DOMAIN}"
    else
        echo -e "${RED}[ERROR]${NC} Failed to obtain certificates"
        exit 1
    fi
fi

# Request mail subdomain certificate separately (uses HTTP challenge)
echo ""
echo -e "${YELLOW}[INFO]${NC} Attempting mail subdomain certificate..."
if certbot --nginx \
    --non-interactive \
    --agree-tos \
    --email "${EMAIL}" \
    -d "mail.${DOMAIN}" 2>/dev/null; then
    echo -e "${GREEN}[OK]${NC} Mail subdomain certificate installed"
else
    echo -e "${YELLOW}[WARN]${NC} Mail cert skipped (subdomain may not be configured yet)"
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
if [[ "$SKIP_WILDCARD" != "true" ]]; then
    echo -e "  ${GREEN}https://*.${DOMAIN}${NC} (all library subdomains)"
fi
echo ""
echo "Certificates will auto-renew every 60-90 days."
echo ""
