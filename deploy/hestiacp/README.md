# GameTaverns - HestiaCP Deployment Guide

## Prerequisites

- HestiaCP installed and running
- Domain `gametaverns.com` pointed to your server
- Cloudflare account (for DNS and Turnstile)
- Node.js 20+ installed
- MariaDB running (HestiaCP default)

---

## Step 1: Cloudflare DNS Setup

### A. Add Domain to Cloudflare

1. Log into Cloudflare Dashboard
2. Add site: `gametaverns.com`
3. Update nameservers at your registrar to Cloudflare's

### B. Configure DNS Records

| Type | Name | Content | Proxy | TTL |
|------|------|---------|-------|-----|
| A | `@` | `YOUR_SERVER_IP` | Proxied (orange) | Auto |
| A | `www` | `YOUR_SERVER_IP` | Proxied (orange) | Auto |
| A | `*` | `YOUR_SERVER_IP` | **DNS only (gray)** | Auto |
| A | `api` | `YOUR_SERVER_IP` | Proxied (orange) | Auto |

> ⚠️ **Important**: The wildcard (`*`) record MUST be "DNS only" (gray cloud) because Cloudflare's free plan doesn't proxy wildcard subdomains. The SSL will be handled by your server.

### C. SSL/TLS Settings

1. Go to **SSL/TLS** → **Overview**
2. Set mode to **Full (strict)**
3. Go to **Edge Certificates**
4. Enable **Always Use HTTPS**
5. Enable **Automatic HTTPS Rewrites**

### D. Cloudflare Turnstile Setup

1. Go to **Turnstile** in sidebar
2. Click **Add Site**
3. Site name: `GameTaverns`
4. Domains: `gametaverns.com` (covers all subdomains)
5. Widget type: **Managed**
6. Copy **Site Key** and **Secret Key**

---

## Step 2: HestiaCP Domain Configuration

### A. Create Web Domain

```bash
# SSH into your server
ssh root@your-server-ip

# Add the main domain
v-add-web-domain admin gametaverns.com

# Enable SSL with Let's Encrypt
v-add-letsencrypt-domain admin gametaverns.com
```

### B. Wildcard SSL Certificate

HestiaCP doesn't support wildcard certs by default. We'll use certbot directly:

```bash
# Install certbot cloudflare plugin
apt install python3-certbot-dns-cloudflare

# Create Cloudflare credentials file
mkdir -p /root/.secrets
cat > /root/.secrets/cloudflare.ini << 'EOF'
dns_cloudflare_api_token = YOUR_CLOUDFLARE_API_TOKEN
EOF
chmod 600 /root/.secrets/cloudflare.ini

# Get wildcard certificate
certbot certonly \
  --dns-cloudflare \
  --dns-cloudflare-credentials /root/.secrets/cloudflare.ini \
  -d gametaverns.com \
  -d '*.gametaverns.com' \
  --preferred-challenges dns-01

# Link certificates to HestiaCP directory
ln -sf /etc/letsencrypt/live/gametaverns.com/fullchain.pem \
  /home/admin/conf/web/gametaverns.com/ssl/gametaverns.com.pem
ln -sf /etc/letsencrypt/live/gametaverns.com/privkey.pem \
  /home/admin/conf/web/gametaverns.com/ssl/gametaverns.com.key
```

### C. Auto-Renewal Setup

```bash
# Add to crontab
crontab -e

# Add this line:
0 3 * * * certbot renew --quiet && systemctl reload nginx
```

---

## Step 3: MariaDB Setup

### A. Create Database and User

```bash
# Login to MariaDB
mysql -u root -p

# Create database
CREATE DATABASE gametaverns CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

# Create user
CREATE USER 'gametaverns'@'localhost' IDENTIFIED BY 'SECURE_PASSWORD_HERE';
GRANT ALL PRIVILEGES ON gametaverns.* TO 'gametaverns'@'localhost';
GRANT ALL PRIVILEGES ON `tenant_%`.* TO 'gametaverns'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### B. Import Schema

```bash
# Import core schema
mysql -u gametaverns -p gametaverns < /path/to/deploy/mariadb/00-core-schema.sql
```

### C. Create First Tenant (Your Library)

```bash
# Replace 'tzolak' with your desired subdomain
export TENANT_SLUG="tzolak"
export TENANT_NAME="Tzolak's Game Library"
export OWNER_EMAIL="tzolak@tzolak.com"
export OWNER_PASSWORD="your-secure-password"

# Run tenant creation script
node /opt/gametaverns/server/dist/scripts/create-tenant.js \
  --slug "$TENANT_SLUG" \
  --name "$TENANT_NAME" \
  --email "$OWNER_EMAIL" \
  --password "$OWNER_PASSWORD"
```

---

## Step 4: Application Deployment

### A. Create Application Directory

```bash
# Create app directory
mkdir -p /opt/gametaverns
cd /opt/gametaverns

# Clone or upload your code
git clone https://github.com/YOUR_REPO/gametaverns.git .

# Or use rsync from your local machine:
# rsync -avz --exclude node_modules --exclude .git ./ root@server:/opt/gametaverns/
```

### B. Install Dependencies

```bash
# Install Node.js dependencies
cd /opt/gametaverns
npm install

# Build frontend
npm run build

# Build server
cd server
npm install
npm run build
```

### C. Create Environment File

```bash
cat > /opt/gametaverns/server/.env << 'EOF'
# Server
NODE_ENV=production
PORT=3001

# Database
DB_HOST=localhost
DB_USER=gametaverns
DB_PASSWORD=SECURE_PASSWORD_HERE
DB_NAME=gametaverns

# Security
JWT_SECRET=GENERATE_A_64_CHAR_RANDOM_STRING
SESSION_SECRET=GENERATE_ANOTHER_64_CHAR_STRING
PII_ENCRYPTION_KEY=32_BYTE_HEX_KEY

# Site
SITE_NAME=GameTaverns
SITE_URL=https://gametaverns.com
CORS_ORIGINS=https://gametaverns.com

# Cloudflare Turnstile
TURNSTILE_SITE_KEY=your-site-key
TURNSTILE_SECRET_KEY=your-secret-key

# Email (HestiaCP mail)
SMTP_HOST=localhost
SMTP_PORT=587
SMTP_USER=noreply@gametaverns.com
SMTP_PASS=email-password
SMTP_FROM=GameTaverns <noreply@gametaverns.com>

# AI (optional)
AI_PROVIDER=openai
AI_API_KEY=sk-your-key

# Features
FEATURE_PLAY_LOGS=true
FEATURE_WISHLIST=true
FEATURE_FOR_SALE=true
FEATURE_MESSAGING=true
FEATURE_RATINGS=true
EOF

chmod 600 /opt/gametaverns/server/.env
```

### D. Create Systemd Service

```bash
cat > /etc/systemd/system/gametaverns-api.service << 'EOF'
[Unit]
Description=GameTaverns API Server
After=network.target mariadb.service

[Service]
Type=simple
User=admin
WorkingDirectory=/opt/gametaverns/server
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

# Enable and start
systemctl daemon-reload
systemctl enable gametaverns-api
systemctl start gametaverns-api

# Check status
systemctl status gametaverns-api
journalctl -u gametaverns-api -f
```

---

## Step 5: Nginx Configuration

### A. Main Configuration

Create `/home/admin/conf/web/gametaverns.com/nginx.conf`:

```nginx
# Upstream to Node.js API
upstream gametaverns_api {
    server 127.0.0.1:3001;
    keepalive 64;
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name gametaverns.com *.gametaverns.com;
    return 301 https://$host$request_uri;
}

# Main HTTPS server (handles all subdomains)
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name gametaverns.com *.gametaverns.com;

    # SSL certificates (wildcard)
    ssl_certificate /etc/letsencrypt/live/gametaverns.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/gametaverns.com/privkey.pem;
    
    # SSL settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;
    ssl_stapling on;
    ssl_stapling_verify on;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/json application/xml;

    # Root for static files
    root /opt/gametaverns/dist;
    index index.html;

    # Health check
    location = /health {
        access_log off;
        return 200 '{"status":"healthy"}';
        add_header Content-Type application/json;
    }

    # API proxy
    location /api/ {
        proxy_pass http://gametaverns_api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 60s;
        proxy_send_timeout 60s;
    }

    # Static assets with long cache
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, max-age=31536000, immutable";
        access_log off;
    }

    # Favicon and other static files
    location ~* \.(ico|png|jpg|jpeg|gif|svg|webp|woff|woff2|ttf|eot)$ {
        expires 30d;
        add_header Cache-Control "public, max-age=2592000";
        access_log off;
    }

    # SPA fallback - all other routes
    location / {
        try_files $uri $uri/ /index.html;
        
        # Don't cache HTML
        location ~* \.html$ {
            expires -1;
            add_header Cache-Control "no-store, no-cache, must-revalidate";
        }
    }

    # Error pages
    error_page 404 /index.html;
    error_page 500 502 503 504 /50x.html;
    location = /50x.html {
        root /opt/gametaverns/dist;
    }
}
```

### B. Reload Nginx

```bash
# Test configuration
nginx -t

# Reload
systemctl reload nginx
```

---

## Step 6: HestiaCP Mail Setup

### A. Create Email Domain

```bash
# Add mail domain
v-add-mail-domain admin gametaverns.com

# Create noreply account
v-add-mail-account admin gametaverns.com noreply "secure-password"

# Create catch-all for tenant subdomains (optional)
# This requires custom configuration
```

### B. DNS Records for Email

Add these to Cloudflare:

| Type | Name | Content | TTL |
|------|------|---------|-----|
| MX | `@` | `mail.gametaverns.com` (priority 10) | Auto |
| A | `mail` | `YOUR_SERVER_IP` | Auto |
| TXT | `@` | `v=spf1 a mx ip4:YOUR_SERVER_IP ~all` | Auto |
| TXT | `_dmarc` | `v=DMARC1; p=quarantine; rua=mailto:admin@gametaverns.com` | Auto |

### C. DKIM Setup

```bash
# Generate DKIM key in HestiaCP
v-add-mail-domain-dkim admin gametaverns.com

# Get the DKIM record
cat /home/admin/conf/mail/gametaverns.com/dkim.pub

# Add as TXT record in Cloudflare:
# Name: mail._domainkey
# Content: (paste the key)
```

---

## Step 7: Verification Checklist

### DNS Propagation

```bash
# Check main domain
dig gametaverns.com +short

# Check wildcard
dig test.gametaverns.com +short

# Check MX records
dig gametaverns.com MX +short
```

### SSL Certificate

```bash
# Test SSL
curl -I https://gametaverns.com
curl -I https://tzolak.gametaverns.com
```

### API Health

```bash
# Check API
curl https://gametaverns.com/api
curl https://gametaverns.com/health
```

### Database Connection

```bash
# Test MariaDB
mysql -u gametaverns -p -e "SHOW DATABASES;"
```

---

## Troubleshooting

### Issue: Subdomain Not Resolving

```bash
# Check if DNS is correct
dig subdomain.gametaverns.com

# Check Nginx is listening
ss -tlnp | grep 443
```

### Issue: API 502 Bad Gateway

```bash
# Check if API is running
systemctl status gametaverns-api

# Check logs
journalctl -u gametaverns-api -n 50

# Check if port is in use
ss -tlnp | grep 3001
```

### Issue: SSL Certificate Error

```bash
# Check certificate
openssl s_client -connect gametaverns.com:443 -servername gametaverns.com

# Renew certificate
certbot renew --force-renewal
```

### Issue: Email Not Sending

```bash
# Check mail logs
tail -f /var/log/exim4/mainlog

# Test SMTP
telnet localhost 25
```

---

## Backup Strategy

### Database Backup

```bash
# Create backup script
cat > /opt/gametaverns/backup.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backup/gametaverns"
mkdir -p $BACKUP_DIR

# Backup all databases (core + tenant schemas)
mysqldump -u root -p'ROOT_PASSWORD' --all-databases > $BACKUP_DIR/full_$DATE.sql
gzip $BACKUP_DIR/full_$DATE.sql

# Keep last 30 days
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete
EOF

chmod +x /opt/gametaverns/backup.sh

# Add to crontab (daily at 2am)
echo "0 2 * * * /opt/gametaverns/backup.sh" | crontab -
```

### Application Backup

```bash
# Backup app files
tar -czvf /backup/gametaverns/app_$(date +%Y%m%d).tar.gz /opt/gametaverns --exclude=node_modules
```

---

## Scaling Notes

For future growth:

1. **Separate Database Server**: Move MariaDB to dedicated server
2. **Load Balancer**: Add HAProxy or Nginx load balancer
3. **CDN**: Serve static assets from Cloudflare
4. **Redis**: Add for session storage and caching
5. **Object Storage**: Move user uploads to S3-compatible storage

---

## Quick Reference

| Service | Port | URL |
|---------|------|-----|
| Nginx | 80, 443 | https://gametaverns.com |
| API | 3001 | http://localhost:3001 |
| MariaDB | 3306 | localhost |
| HestiaCP | 8083 | https://your-server:8083 |

| Command | Description |
|---------|-------------|
| `systemctl restart gametaverns-api` | Restart API |
| `systemctl reload nginx` | Reload Nginx |
| `journalctl -u gametaverns-api -f` | View API logs |
| `certbot renew` | Renew SSL |
