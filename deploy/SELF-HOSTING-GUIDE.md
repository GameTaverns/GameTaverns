# GameTaverns Self-Hosting Guide v3.0

> **One path. No branch-hopping. Production-ready.**

This guide deploys GameTaverns on a fresh Ubuntu 24.04 server using the **native Express + PostgreSQL** stack. It's fully independent of Lovable Cloud.

---

## Prerequisites

| Requirement | Details |
|-------------|---------|
| **Server** | Ubuntu 24.04 LTS, 2+ vCPU, 4GB+ RAM |
| **Domain** | `gametaverns.com` (or your domain) with DNS access |
| **Ports** | 80, 443 open |
| **Root/sudo** | Required for installation |

---

## Phase 1: Server Preparation

### 1.1 Initial Setup (SSH as root)

```bash
# Update system
apt update && apt upgrade -y

# Install required packages
apt install -y curl git nginx certbot python3-certbot-nginx \
  postgresql postgresql-contrib nodejs npm ufw

# Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Verify versions
node -v  # Should be v20.x
npm -v
psql --version  # Should be 16.x
```

**✅ CHECKPOINT 1:** All commands complete without errors.

### 1.2 Create Application User

```bash
# Create non-root user for the application
useradd -m -s /bin/bash gametaverns
usermod -aG sudo gametaverns

# Create installation directory
mkdir -p /opt/gametaverns
chown gametaverns:gametaverns /opt/gametaverns
```

---

## Phase 2: Database Setup

### 2.1 Configure PostgreSQL

```bash
# Switch to postgres user
sudo -u postgres psql

# In the PostgreSQL prompt, run:
CREATE USER gametaverns_app WITH PASSWORD 'CHANGE_THIS_PASSWORD';
CREATE DATABASE gametaverns_core OWNER gametaverns_app;
GRANT ALL PRIVILEGES ON DATABASE gametaverns_core TO gametaverns_app;

-- Required extensions (run as superuser)
\c gametaverns_core
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "unaccent";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

\q
```

**⚠️ IMPORTANT:** Save your database password securely. You'll need it later.

### 2.2 Run Schema Migration

```bash
# Clone the repository
cd /opt/gametaverns
git clone https://github.com/YOUR_REPO/gametaverns.git .
# OR copy files from your local machine

# Run the schema
sudo -u postgres psql -d gametaverns_core -f deploy/native/migrations/01-schema.sql
```

**✅ CHECKPOINT 2:** Run this to verify tables exist:
```bash
sudo -u postgres psql -d gametaverns_core -c "\dt"
```
Should show: `users`, `user_profiles`, `user_roles`, `libraries`, `games`, etc.

---

## Phase 3: Application Setup

### 3.1 Configure Environment

```bash
cd /opt/gametaverns

# Copy example environment file
cp deploy/standalone/.env.example .env

# Edit with your values
nano .env
```

**Required `.env` values:**

```bash
# Database
DATABASE_URL=postgresql://gametaverns_app:YOUR_PASSWORD@localhost:5432/gametaverns_core
DB_HOST=localhost
DB_PORT=5432
DB_USER=gametaverns_app
DB_PASSWORD=YOUR_PASSWORD
DB_NAME=gametaverns_core

# Security (GENERATE THESE - don't use examples!)
JWT_SECRET=$(openssl rand -base64 48 | tr -dc 'a-zA-Z0-9' | head -c 64)
PII_ENCRYPTION_KEY=$(openssl rand -hex 32)

# Server
PORT=3001
NODE_ENV=production
CORS_ORIGINS=https://gametaverns.com,https://*.gametaverns.com

# Site
SITE_NAME=GameTaverns
SITE_URL=https://gametaverns.com
TIMEZONE=America/New_York
```

**Generate your secrets:**
```bash
# Generate JWT_SECRET
echo "JWT_SECRET=$(openssl rand -base64 48 | tr -dc 'a-zA-Z0-9' | head -c 64)"

# Generate PII_ENCRYPTION_KEY
echo "PII_ENCRYPTION_KEY=$(openssl rand -hex 32)"
```

### 3.2 Install Dependencies

```bash
cd /opt/gametaverns

# Install server dependencies
cd server
npm install

# Build server
npm run build

# Install frontend dependencies
cd ..
npm install

# Build frontend with self-hosted config
npm run build
```

**✅ CHECKPOINT 3:** Both builds complete without errors.

---

## Phase 4: Create Admin User

### 4.1 Create Admin Script

```bash
cat > /opt/gametaverns/create-admin.sh << 'SCRIPT'
#!/bin/bash
set -e

# Load environment
source /opt/gametaverns/.env

echo "=== GameTaverns Admin User Creator ==="
echo ""

read -p "Admin email: " ADMIN_EMAIL
read -s -p "Admin password (min 8 chars): " ADMIN_PASSWORD
echo ""

# Validate
if [[ ${#ADMIN_PASSWORD} -lt 8 ]]; then
  echo "Error: Password must be at least 8 characters"
  exit 1
fi

# Hash password using Node.js (matches server/src/utils/password.ts)
PASSWORD_HASH=$(node -e "
const crypto = require('crypto');
const password = process.argv[1];
const salt = crypto.randomBytes(32);
const hash = crypto.pbkdf2Sync(password, salt, 310000, 64, 'sha512');
console.log(salt.toString('hex') + ':' + hash.toString('hex'));
" "$ADMIN_PASSWORD")

# Insert user
USER_ID=$(psql "$DATABASE_URL" -t -c "
INSERT INTO users (email, password_hash, email_verified)
VALUES ('${ADMIN_EMAIL}', '${PASSWORD_HASH}', true)
ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
RETURNING id;
" | tr -d ' \n')

echo "User ID: $USER_ID"

# Create profile
psql "$DATABASE_URL" -c "
INSERT INTO user_profiles (user_id, display_name)
VALUES ('${USER_ID}', 'Site Admin')
ON CONFLICT (user_id) DO UPDATE SET display_name = 'Site Admin';
"

# Assign admin role (CRITICAL: must be in user_roles, not user_profiles)
psql "$DATABASE_URL" -c "
DELETE FROM user_roles WHERE user_id = '${USER_ID}';
INSERT INTO user_roles (user_id, role) VALUES ('${USER_ID}', 'admin');
"

# Verify
echo ""
echo "=== Verification ==="
psql "$DATABASE_URL" -c "
SELECT u.email, ur.role, up.display_name
FROM users u
LEFT JOIN user_roles ur ON u.id = ur.user_id
LEFT JOIN user_profiles up ON u.id = up.user_id
WHERE u.id = '${USER_ID}';
"

echo ""
echo "✅ Admin user created successfully!"
echo "   Email: $ADMIN_EMAIL"
echo "   Role: admin"
SCRIPT

chmod +x /opt/gametaverns/create-admin.sh
```

### 4.2 Run Admin Creation

```bash
cd /opt/gametaverns
./create-admin.sh
```

**✅ CHECKPOINT 4:** Verification query shows:
- Email: your admin email
- Role: admin
- Display name: Site Admin

---

## Phase 5: Process Manager (PM2)

### 5.1 Install and Configure PM2

```bash
npm install -g pm2

# Create ecosystem file
cat > /opt/gametaverns/ecosystem.config.cjs << 'EOF'
module.exports = {
  apps: [
    {
      name: 'gametaverns-api',
      cwd: '/opt/gametaverns/server',
      script: 'dist/index.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
      },
      env_file: '/opt/gametaverns/.env',
    },
  ],
};
EOF

# Start API server
cd /opt/gametaverns
pm2 start ecosystem.config.cjs

# Save PM2 process list
pm2 save

# Configure PM2 to start on boot
pm2 startup systemd -u gametaverns --hp /home/gametaverns
```

**✅ CHECKPOINT 5:** 
```bash
pm2 status
# Should show gametaverns-api as "online"

curl http://localhost:3001/health
# Should return {"status":"ok"} or similar
```

---

## Phase 6: Nginx & SSL

### 6.1 Configure Nginx

```bash
cat > /etc/nginx/sites-available/gametaverns << 'EOF'
# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name gametaverns.com *.gametaverns.com;
    return 301 https://$host$request_uri;
}

# Main site
server {
    listen 443 ssl http2;
    server_name gametaverns.com;

    # SSL (will be configured by certbot)
    ssl_certificate /etc/letsencrypt/live/gametaverns.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/gametaverns.com/privkey.pem;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Frontend (static files)
    root /opt/gametaverns/dist;
    index index.html;

    # API proxy
    location /api/ {
        proxy_pass http://127.0.0.1:3001/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 60s;
    }

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Static assets caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}

# Wildcard subdomain handler (tenant libraries)
server {
    listen 443 ssl http2;
    server_name ~^(?<tenant>[a-z0-9-]+)\.gametaverns\.com$;

    ssl_certificate /etc/letsencrypt/live/gametaverns.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/gametaverns.com/privkey.pem;

    root /opt/gametaverns/dist;
    index index.html;

    location /api/ {
        proxy_pass http://127.0.0.1:3001/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Tenant $tenant;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
EOF

# Enable site
ln -sf /etc/nginx/sites-available/gametaverns /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test config
nginx -t
```

### 6.2 Obtain SSL Certificate

```bash
# Stop nginx temporarily for standalone mode
systemctl stop nginx

# Get certificate (replace with your email)
certbot certonly --standalone \
  -d gametaverns.com \
  -d "*.gametaverns.com" \
  --email admin@gametaverns.com \
  --agree-tos \
  --no-eff-email

# Start nginx
systemctl start nginx
systemctl enable nginx
```

**Note:** Wildcard certificates require DNS validation. If using Cloudflare:
```bash
apt install python3-certbot-dns-cloudflare
certbot certonly --dns-cloudflare \
  --dns-cloudflare-credentials /root/.cloudflare.ini \
  -d gametaverns.com \
  -d "*.gametaverns.com"
```

**✅ CHECKPOINT 6:**
```bash
curl -I https://gametaverns.com
# Should return HTTP/2 200

curl https://gametaverns.com/api/health
# Should return {"status":"ok"}
```

---

## Phase 7: Final Verification

### 7.1 End-to-End Test

1. **Visit** `https://gametaverns.com`
2. **Login** with your admin credentials
3. **Navigate** to `/admin` (Platform Admin dashboard)
4. **Verify** you see the admin panel (not redirected)

### 7.2 Troubleshooting Commands

```bash
# Check API logs
pm2 logs gametaverns-api

# Check nginx logs
tail -f /var/log/nginx/error.log

# Check database connection
psql "$DATABASE_URL" -c "SELECT 1;"

# Verify admin role in database
psql "$DATABASE_URL" -c "
SELECT u.email, ur.role 
FROM users u 
JOIN user_roles ur ON u.id = ur.user_id 
WHERE ur.role = 'admin';
"

# Restart API
pm2 restart gametaverns-api

# Restart nginx
systemctl restart nginx
```

---

## Common Issues & Fixes

### Issue: Admin panel shows as regular user

**Cause:** Role not properly set in `user_roles` table.

**Fix:**
```bash
# Check roles
psql "$DATABASE_URL" -c "SELECT * FROM user_roles WHERE user_id = 'YOUR_USER_ID';"

# If empty or wrong, insert admin role
psql "$DATABASE_URL" -c "
INSERT INTO user_roles (user_id, role) 
VALUES ('YOUR_USER_ID', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;
"
```

### Issue: API returns 500 errors

**Cause:** Missing or corrupted `.env` file.

**Fix:**
```bash
# Verify .env exists and has required values
cat /opt/gametaverns/.env | grep -E "^DATABASE_URL|^JWT_SECRET"

# Restart API
pm2 restart gametaverns-api
pm2 logs gametaverns-api --lines 50
```

### Issue: CORS errors in browser

**Cause:** `CORS_ORIGINS` doesn't include your domain.

**Fix:**
```bash
# Edit .env
nano /opt/gametaverns/.env

# Ensure CORS_ORIGINS includes all your domains
CORS_ORIGINS=https://gametaverns.com,https://*.gametaverns.com

# Restart
pm2 restart gametaverns-api
```

### Issue: SSL certificate errors

**Fix:**
```bash
# Renew certificate
certbot renew

# Or regenerate
certbot certonly --nginx -d gametaverns.com -d "*.gametaverns.com"

# Restart nginx
systemctl restart nginx
```

---

## Backup & Maintenance

### Daily Backup Script

```bash
cat > /opt/gametaverns/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR=/opt/gametaverns/backups
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

source /opt/gametaverns/.env

# Database backup
pg_dump "$DATABASE_URL" | gzip > "$BACKUP_DIR/db_$DATE.sql.gz"

# Keep only last 7 days
find $BACKUP_DIR -name "db_*.sql.gz" -mtime +7 -delete

echo "Backup completed: $BACKUP_DIR/db_$DATE.sql.gz"
EOF

chmod +x /opt/gametaverns/backup.sh

# Add to crontab (daily at 2 AM)
echo "0 2 * * * /opt/gametaverns/backup.sh" | crontab -
```

### Update Process

```bash
cd /opt/gametaverns

# Pull latest code
git pull origin main

# Rebuild
cd server && npm install && npm run build
cd .. && npm install && npm run build

# Run any new migrations
psql "$DATABASE_URL" -f deploy/native/migrations/02-totp-2fa.sql 2>/dev/null || true

# Restart
pm2 restart gametaverns-api
```

---

## Architecture Summary

```
┌─────────────────────────────────────────────────────────────┐
│                         Internet                            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Nginx (SSL/Proxy)                      │
│                     Port 80/443                             │
└─────────────────────────────────────────────────────────────┘
              │                              │
              ▼                              ▼
┌─────────────────────────┐    ┌─────────────────────────────┐
│   Static Frontend       │    │     Express API Server      │
│   /opt/gametaverns/dist │    │     Port 3001 (PM2)         │
│   (React SPA)           │    │     /api/* routes           │
└─────────────────────────┘    └─────────────────────────────┘
                                             │
                                             ▼
                               ┌─────────────────────────────┐
                               │      PostgreSQL 16          │
                               │   gametaverns_core DB       │
                               │      Port 5432              │
                               └─────────────────────────────┘
```

---

## Version History

- **v3.0** (2026-02-02): Consolidated guide, fixed admin role bug, single-path deployment
- **v2.3.0**: TOTP 2FA, security hardening
- **v2.0.0**: Multi-tenant support

---

**Need help?** Check the logs first:
```bash
pm2 logs gametaverns-api --lines 100
tail -f /var/log/nginx/error.log
```
