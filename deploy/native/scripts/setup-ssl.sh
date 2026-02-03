#!/bin/bash
#
# GameTaverns SSL Setup Script
# Configures SSL certificates using Let's Encrypt or Cloudflare Origin Certificates
#
# Usage: 
#   ./setup-ssl.sh                    # Interactive setup (choose method)
#   ./setup-ssl.sh --letsencrypt      # Use Let's Encrypt (default)
#   ./setup-ssl.sh --cloudflare       # Use Cloudflare Origin Certificate
#   ./setup-ssl.sh --skip-wildcard    # Let's Encrypt: Only root + www
#   ./setup-ssl.sh --verify           # Verify current SSL setup
#

set -e

INSTALL_DIR="/opt/gametaverns"
CREDENTIALS_FILE="/root/gametaverns-credentials.txt"
CLOUDFLARE_CREDS="/root/.cloudflare.ini"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# Parse arguments
SKIP_WILDCARD=false
USE_CLOUDFLARE_ORIGIN=false
VERIFY_ONLY=false
DOMAIN=""

for arg in "$@"; do
    case $arg in
        --skip-wildcard)
            SKIP_WILDCARD=true
            ;;
        --cloudflare|--cloudflare-origin|--origin)
            USE_CLOUDFLARE_ORIGIN=true
            ;;
        --letsencrypt|--le)
            USE_CLOUDFLARE_ORIGIN=false
            ;;
        --verify)
            VERIFY_ONLY=true
            ;;
        *)
            DOMAIN="$arg"
            ;;
    esac
done

echo ""
echo "╔═══════════════════════════════════════════════════════════════════╗"
echo "║          GameTaverns - SSL Certificate Setup                      ║"
echo "╚═══════════════════════════════════════════════════════════════════╝"
echo ""

# Handle verify-only mode
if [[ "$VERIFY_ONLY" == "true" ]]; then
    if [[ -x "${INSTALL_DIR}/scripts/verify-ssl.sh" ]]; then
        exec "${INSTALL_DIR}/scripts/verify-ssl.sh" "$DOMAIN"
    else
        echo -e "${RED}[ERROR]${NC} Verification script not found. Run SSL setup first."
        exit 1
    fi
fi

# Redirect to Cloudflare Origin script if requested
if [[ "$USE_CLOUDFLARE_ORIGIN" == "true" ]]; then
    if [[ -x "${SCRIPT_DIR}/setup-ssl-cloudflare-origin.sh" ]]; then
        exec "${SCRIPT_DIR}/setup-ssl-cloudflare-origin.sh" "$DOMAIN"
    else
        echo -e "${RED}[ERROR]${NC} Cloudflare origin script not found."
        exit 1
    fi
fi

# Interactive method selection if no flag provided
if [[ "$USE_CLOUDFLARE_ORIGIN" == "false" ]] && [[ "$SKIP_WILDCARD" == "false" ]]; then
    echo "Choose SSL certificate method:"
    echo ""
    echo "  1) Let's Encrypt (ACME)"
    echo "     - Free, auto-renewing certificates"
    echo "     - Rate limit: 5 certs per domain per week"
    echo "     - Requires Cloudflare API token for DNS validation"
    echo ""
    echo "  2) Cloudflare Origin Certificate"
    echo "     - No rate limits (bypasses Let's Encrypt)"
    echo "     - Valid up to 15 years"
    echo "     - Requires Cloudflare Proxy (Orange Cloud) enabled"
    echo ""
    read -p "Select method [1/2]: " SSL_METHOD
    
    case "$SSL_METHOD" in
        2)
            if [[ -x "${SCRIPT_DIR}/setup-ssl-cloudflare-origin.sh" ]]; then
                exec "${SCRIPT_DIR}/setup-ssl-cloudflare-origin.sh" "$DOMAIN"
            else
                echo -e "${RED}[ERROR]${NC} Cloudflare origin script not found."
                exit 1
            fi
            ;;
        *)
            echo ""
            echo -e "${CYAN}Using Let's Encrypt...${NC}"
            echo ""
            ;;
    esac
fi

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
        
        CERT_PATH="/etc/letsencrypt/live/${DOMAIN}"
        
        # Create proper HTTPS nginx configuration
        echo -e "${YELLOW}[INFO]${NC} Creating HTTPS nginx configuration..."
        
        # Get PHP version for Roundcube
        PHP_VERSION=$(php -v 2>/dev/null | head -n1 | cut -d' ' -f2 | cut -d'.' -f1,2 || echo "8.3")
        
        # Backup existing configs
        cp /etc/nginx/sites-available/gametaverns /etc/nginx/sites-available/gametaverns.http-backup 2>/dev/null || true
        cp /etc/nginx/sites-available/roundcube /etc/nginx/sites-available/roundcube.http-backup 2>/dev/null || true
        
        # Create main gametaverns HTTPS config
        cat > /etc/nginx/sites-available/gametaverns << NGINX_EOF
# ════════════════════════════════════════════════════════════════
# GameTaverns - Nginx HTTPS Configuration
# Handles multi-tenant subdomain routing with SSL
# Generated: $(date)
# ════════════════════════════════════════════════════════════════

# Rate limiting zones
limit_req_zone \$binary_remote_addr zone=api_limit:10m rate=10r/s;
limit_req_zone \$binary_remote_addr zone=login_limit:10m rate=5r/m;
limit_req_zone \$binary_remote_addr zone=general:10m rate=30r/s;
limit_conn_zone \$binary_remote_addr zone=conn_limit:10m;

# Upstream for API
upstream gametaverns_api {
    server 127.0.0.1:3001;
    keepalive 64;
}

# HTTP → HTTPS redirect (all domains except mail)
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN} *.${DOMAIN};
    
    # Exclude mail subdomain (handled separately)
    if (\$host = mail.${DOMAIN}) {
        return 444;
    }
    
    return 301 https://\$host\$request_uri;
}

# Main HTTPS server (handles root and all tenant subdomains)
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${DOMAIN} *.${DOMAIN};
    
    # Exclude mail subdomain (handled in roundcube config)
    if (\$host = mail.${DOMAIN}) {
        return 444;
    }

    # SSL Configuration
    ssl_certificate ${CERT_PATH}/fullchain.pem;
    ssl_certificate_key ${CERT_PATH}/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;
    ssl_session_tickets off;

    # Connection limits
    limit_conn conn_limit 20;

    # Logging
    access_log /var/log/nginx/gametaverns-access.log;
    error_log /var/log/nginx/gametaverns-error.log;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml application/json application/javascript application/xml+rss application/atom+xml image/svg+xml;

    # API routes
    location /api/ {
        limit_req zone=api_limit burst=20 nodelay;
        
        proxy_pass http://gametaverns_api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
        
        proxy_buffer_size 128k;
        proxy_buffers 4 256k;
        proxy_busy_buffers_size 256k;
    }

    # Rate-limited auth endpoints
    location /api/auth/login {
        limit_req zone=login_limit burst=3 nodelay;
        
        proxy_pass http://gametaverns_api;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /api/auth/signup {
        limit_req zone=login_limit burst=3 nodelay;
        
        proxy_pass http://gametaverns_api;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Health check
    location /health {
        proxy_pass http://gametaverns_api/health;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
    }

    # User uploads
    location /uploads/ {
        alias /opt/gametaverns/uploads/;
        expires 30d;
        add_header Cache-Control "public, immutable";
        try_files \$uri =404;
    }

    # Static frontend files
    location / {
        limit_req zone=general burst=50 nodelay;
        
        root /opt/gametaverns/app;
        index index.html;
        try_files \$uri \$uri/ /index.html;
        
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)\$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }

        location ~* \.html\$ {
            expires -1;
            add_header Cache-Control "no-store, no-cache, must-revalidate";
        }
    }
}
NGINX_EOF

        # Create Roundcube HTTPS config (separate server block for mail subdomain)
        cat > /etc/nginx/sites-available/roundcube << NGINX_EOF
# Roundcube Webmail - HTTPS
# HTTP redirect
server {
    listen 80;
    listen [::]:80;
    server_name mail.${DOMAIN};
    return 301 https://\$host\$request_uri;
}

# HTTPS server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name mail.${DOMAIN};

    ssl_certificate ${CERT_PATH}/fullchain.pem;
    ssl_certificate_key ${CERT_PATH}/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;

    root /var/lib/roundcube/public_html;
    index index.php;

    access_log /var/log/nginx/roundcube-access.log;
    error_log /var/log/nginx/roundcube-error.log;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000" always;

    location / {
        try_files \$uri \$uri/ /index.php?\$query_string;
    }

    location ~ \.php\$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/var/run/php/php${PHP_VERSION}-fpm.sock;
        fastcgi_param SCRIPT_FILENAME \$document_root\$fastcgi_script_name;
        include fastcgi_params;
    }

    location ~ /\. { deny all; }
    location ~ ^/(README|INSTALL|LICENSE|CHANGELOG|UPGRADING)\$ { deny all; }
    location ~ ^/(bin|SQL|config|temp|logs)/ { deny all; }
}
NGINX_EOF

        # Ensure symlinks exist
        ln -sf /etc/nginx/sites-available/gametaverns /etc/nginx/sites-enabled/
        ln -sf /etc/nginx/sites-available/roundcube /etc/nginx/sites-enabled/
        rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true

        # Test and reload nginx
        if nginx -t; then
            systemctl reload nginx
            echo -e "${GREEN}[OK]${NC} Nginx configured with HTTPS"
        else
            echo -e "${RED}[ERROR]${NC} Nginx configuration test failed"
            echo "Restoring backup..."
            cp /etc/nginx/sites-available/gametaverns.http-backup /etc/nginx/sites-available/gametaverns 2>/dev/null || true
            cp /etc/nginx/sites-available/roundcube.http-backup /etc/nginx/sites-available/roundcube 2>/dev/null || true
            nginx -t && systemctl reload nginx
            exit 1
        fi
        
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

# ============================================================================
# NOTE: Mail subdomain is ALREADY covered by the wildcard certificate *.${DOMAIN}
# Do NOT request a separate certificate - it causes nginx config overwrites
# ============================================================================
echo ""
echo -e "${GREEN}[OK]${NC} Mail subdomain is covered by wildcard certificate (*.${DOMAIN})"
echo -e "${YELLOW}[INFO]${NC} No separate mail certificate needed."

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
