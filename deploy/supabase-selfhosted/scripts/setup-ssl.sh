#!/bin/bash
# =============================================================================
# SSL Setup with Certbot for GameTaverns
# Domain: gametaverns.com (hardcoded)
# Includes wildcard certificate for *.gametaverns.com (tenant libraries)
# Version: 2.2.0
# =============================================================================

set -e

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "Please run as root: sudo ./setup-ssl.sh"
    exit 1
fi

INSTALL_DIR="/opt/gametaverns"
DOMAIN="gametaverns.com"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

if [ ! -f "$INSTALL_DIR/.env" ]; then
    echo -e "${RED}Error: .env file not found. Run install.sh first.${NC}"
    exit 1
fi

# Source env file safely
set -a
source "$INSTALL_DIR/.env"
set +a

echo ""
echo "=============================================="
echo "  SSL Certificate Setup"
echo "  Domain: $DOMAIN"
echo "  Includes: *.${DOMAIN} (tenant subdomains)"
echo "=============================================="
echo ""

# Pre-flight DNS check
echo -e "${BLUE}Checking DNS resolution...${NC}"
if command -v host &>/dev/null; then
    if ! host "$DOMAIN" > /dev/null 2>&1; then
        echo -e "${YELLOW}Warning: $DOMAIN does not resolve. DNS may not be configured.${NC}"
    else
        echo -e "${GREEN}✓ $DOMAIN resolves correctly${NC}"
    fi
fi

# Install Certbot if needed
if ! command -v certbot &> /dev/null; then
    echo -e "${BLUE}Installing Certbot...${NC}"
    apt-get update
    apt-get install -y certbot python3-certbot-nginx python3-certbot-dns-cloudflare
    echo -e "${GREEN}✓ Certbot installed${NC}"
fi

# Install Nginx if needed
if ! command -v nginx &> /dev/null; then
    echo -e "${BLUE}Installing Nginx...${NC}"
    apt-get install -y nginx
    echo -e "${GREEN}✓ Nginx installed${NC}"
fi

# ===========================================
# Wildcard Certificate Setup
# ===========================================
echo ""
echo -e "\033[1;33mWildcard certificates (*.gametaverns.com) require DNS validation.\033[0m"
echo "This is needed so tenant libraries like tzolak.gametaverns.com work with HTTPS."
echo ""
echo "Options:"
echo "  1. Cloudflare DNS (recommended - automatic renewal)"
echo "  2. Manual DNS (requires manual renewal every 90 days)"
echo ""
read -p "Select option [1/2]: " DNS_OPTION

if [ "$DNS_OPTION" = "1" ]; then
    # Cloudflare automated DNS validation
    echo ""
    echo "Enter your Cloudflare API token (needs Zone:DNS:Edit permission):"
    read -s CF_API_TOKEN
    
    mkdir -p /etc/letsencrypt
    cat > /etc/letsencrypt/cloudflare.ini << EOF
dns_cloudflare_api_token = $CF_API_TOKEN
EOF
    chmod 600 /etc/letsencrypt/cloudflare.ini
    
    echo ""
    echo "Obtaining wildcard certificate via Cloudflare DNS..."
    certbot certonly \
        --dns-cloudflare \
        --dns-cloudflare-credentials /etc/letsencrypt/cloudflare.ini \
        -d "$DOMAIN" \
        -d "*.$DOMAIN" \
        --non-interactive \
        --agree-tos \
        --email "${SMTP_ADMIN_EMAIL:-admin@$DOMAIN}"
else
    # Manual DNS validation
    echo ""
    echo "Obtaining wildcard certificate via manual DNS..."
    echo -e "\033[1;33mYou will need to add a TXT record to your DNS.\033[0m"
    echo ""
    certbot certonly \
        --manual \
        --preferred-challenges dns \
        -d "$DOMAIN" \
        -d "*.$DOMAIN" \
        --agree-tos \
        --email "${SMTP_ADMIN_EMAIL:-admin@$DOMAIN}"
fi

# ===========================================
# Create Nginx Configuration
# ===========================================

# Create wildcard subdomain handler for tenant libraries
cat > /etc/nginx/sites-available/gametaverns << 'NGINX_EOF'
# ===========================================
# GameTaverns - Main Site & API
# Domain: gametaverns.com
# ===========================================

# Main site (HTTPS)
server {
    listen 443 ssl http2;
    server_name gametaverns.com www.gametaverns.com;
    
    ssl_certificate /etc/letsencrypt/live/gametaverns.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/gametaverns.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# API Subdomain (HTTPS)
server {
    listen 443 ssl http2;
    server_name api.gametaverns.com;
    
    ssl_certificate /etc/letsencrypt/live/gametaverns.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/gametaverns.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
}

# Roundcube Webmail (HTTPS)
server {
    listen 443 ssl http2;
    server_name mail.gametaverns.com;
    
    ssl_certificate /etc/letsencrypt/live/gametaverns.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/gametaverns.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    
    location / {
        proxy_pass http://127.0.0.1:9001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Studio - Database Admin (HTTPS)
server {
    listen 443 ssl http2;
    server_name studio.gametaverns.com;
    
    ssl_certificate /etc/letsencrypt/live/gametaverns.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/gametaverns.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    
    # Optional: Basic auth for studio access
    # auth_basic "Studio Access";
    # auth_basic_user_file /etc/nginx/.htpasswd;
    
    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# ===========================================
# Wildcard: Tenant Library Subdomains
# Matches: *.gametaverns.com (except reserved)
# Examples: tzolak.gametaverns.com, mycollection.gametaverns.com
# ===========================================
server {
    listen 443 ssl http2;
    server_name ~^(?<tenant>[a-z0-9-]+)\.gametaverns\.com$;
    
    # Skip reserved subdomains (handled above)
    if ($tenant ~* ^(www|api|mail|studio|admin|dashboard)$) {
        return 404;
    }
    
    ssl_certificate /etc/letsencrypt/live/gametaverns.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/gametaverns.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    
    # Pass tenant slug to frontend via header
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Tenant-Slug $tenant;
        proxy_cache_bypass $http_upgrade;
    }
}

# ===========================================
# HTTP to HTTPS Redirects
# ===========================================
server {
    listen 80;
    server_name gametaverns.com www.gametaverns.com api.gametaverns.com mail.gametaverns.com studio.gametaverns.com *.gametaverns.com;
    return 301 https://$host$request_uri;
}
NGINX_EOF

ln -sf /etc/nginx/sites-available/gametaverns /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true

nginx -t && systemctl reload nginx

echo ""
echo "=============================================="
echo "  SSL Setup Complete!"
echo "=============================================="
echo ""
echo "Your site is now available at:"
echo "  - https://gametaverns.com (main site)"
echo "  - https://api.gametaverns.com (API)"
echo "  - https://mail.gametaverns.com (webmail)"
echo "  - https://studio.gametaverns.com (database admin)"
echo ""
echo "Tenant libraries will be accessible at:"
echo "  - https://{slug}.gametaverns.com"
echo "  - Example: https://tzolak.gametaverns.com"
echo ""
echo "SSL certificates will auto-renew via Certbot."
echo ""
