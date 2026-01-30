#!/bin/bash
# =============================================================================
# SSL Setup with Certbot for GameTaverns
# =============================================================================

set -e

INSTALL_DIR="/opt/gametaverns"

if [ ! -f "$INSTALL_DIR/.env" ]; then
    echo "Error: .env file not found"
    exit 1
fi

source "$INSTALL_DIR/.env"

# Extract domain from SITE_URL
DOMAIN=$(echo "$SITE_URL" | sed 's|https://||' | sed 's|http://||')

echo ""
echo "=============================================="
echo "  SSL Certificate Setup"
echo "=============================================="
echo ""
echo "Domain: $DOMAIN"
echo ""

# Install Certbot if needed
if ! command -v certbot &> /dev/null; then
    echo "Installing Certbot..."
    apt-get update
    apt-get install -y certbot python3-certbot-nginx
fi

# Install Nginx if needed
if ! command -v nginx &> /dev/null; then
    echo "Installing Nginx..."
    apt-get install -y nginx
fi

# Create Nginx config for domain
cat > /etc/nginx/sites-available/gametaverns << EOF
# GameTaverns - Main Site
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;
    
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }
    
    location / {
        return 301 https://\$server_name\$request_uri;
    }
}

# API Subdomain
server {
    listen 80;
    server_name api.$DOMAIN;
    
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }
    
    location / {
        return 301 https://\$server_name\$request_uri;
    }
}

# Mail Subdomain (Roundcube)
server {
    listen 80;
    server_name mail.$DOMAIN;
    
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }
    
    location / {
        return 301 https://\$server_name\$request_uri;
    }
}
EOF

ln -sf /etc/nginx/sites-available/gametaverns /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

echo ""
echo "Obtaining SSL certificates..."

certbot certonly --nginx \
    -d "$DOMAIN" \
    -d "www.$DOMAIN" \
    -d "api.$DOMAIN" \
    -d "mail.$DOMAIN" \
    --non-interactive \
    --agree-tos \
    --email "${SMTP_ADMIN_EMAIL:-admin@$DOMAIN}"

# Create full HTTPS config
cat > /etc/nginx/sites-available/gametaverns << EOF
# GameTaverns - Main Site (HTTPS)
server {
    listen 443 ssl http2;
    server_name $DOMAIN www.$DOMAIN;
    
    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    
    # Frontend
    location / {
        proxy_pass http://127.0.0.1:${APP_PORT:-3000};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}

# API Subdomain (HTTPS)
server {
    listen 443 ssl http2;
    server_name api.$DOMAIN;
    
    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    
    # Kong Gateway
    location / {
        proxy_pass http://127.0.0.1:${KONG_HTTP_PORT:-8000};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
}

# Roundcube Webmail (HTTPS)
server {
    listen 443 ssl http2;
    server_name mail.$DOMAIN;
    
    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    
    location / {
        proxy_pass http://127.0.0.1:${ROUNDCUBE_PORT:-9001};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}

# Studio (HTTPS) - optional, can be disabled in production
server {
    listen 443 ssl http2;
    server_name studio.$DOMAIN;
    
    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    
    # Basic auth for Studio access
    # auth_basic "Studio Access";
    # auth_basic_user_file /etc/nginx/.htpasswd;
    
    location / {
        proxy_pass http://127.0.0.1:${STUDIO_PORT:-3001};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}

# HTTP redirects
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN api.$DOMAIN mail.$DOMAIN studio.$DOMAIN;
    return 301 https://\$server_name\$request_uri;
}
EOF

nginx -t && systemctl reload nginx

echo ""
echo "=============================================="
echo "  SSL Setup Complete!"
echo "=============================================="
echo ""
echo "Your site is now available at:"
echo "  - https://$DOMAIN"
echo "  - https://api.$DOMAIN"
echo "  - https://mail.$DOMAIN"
echo "  - https://studio.$DOMAIN (database admin)"
echo ""
echo "SSL certificates will auto-renew via Certbot."
echo ""
