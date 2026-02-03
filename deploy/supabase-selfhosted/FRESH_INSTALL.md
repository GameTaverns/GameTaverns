# GameTaverns - Complete Fresh Installation Guide

**One-Shot Installation for Ubuntu 24.04 with Mailcow**
**Version: 2.4.0 - Bulletproof Edition**

This guide incorporates ALL lessons learned from multiple deployment attempts. Every known issue has been addressed.

---

## 📋 Known Issues Addressed in This Guide

| Issue | Root Cause | Solution |
|-------|------------|----------|
| Port 993 conflicts | Old mail containers or host Dovecot | Clean-install script removes them |
| Docker network overlap | Multiple stacks claim same subnet | Mailcow gets dedicated subnet |
| Nginx 405 errors | API routes going to frontend | Explicit `/auth/`, `/rest/`, `/functions/` location blocks |
| JWT signature invalid | Keys not signed with JWT_SECRET | Installer regenerates properly signed keys |
| GoTrue won't start | Missing `auth` schema/enums | Migration script pre-creates them |
| PostgREST healthcheck fails | Image lacks curl/wget | Healthcheck disabled in compose |
| Storage migrations fail | Missing role permissions | Installer grants permissions |
| .env formatting errors | Unquoted values with spaces | All values properly quoted |

---

## 🚨 Pre-Flight Checklist

Before you begin, verify:

| Requirement | Minimum | Check Command |
|-------------|---------|---------------|
| Ubuntu | 24.04 LTS | `lsb_release -a` |
| RAM | 4GB (6GB+ with Mailcow) | `free -h` |
| Disk | 30GB free | `df -h /` |
| Ports | 25, 80, 443, 587, 993 unblocked | Contact VPS provider |

### DNS Must Be Configured FIRST

Configure these records **before running any scripts** (replace `YOUR_IP`):

```
gametaverns.com.          A     YOUR_IP
www.gametaverns.com.      A     YOUR_IP
api.gametaverns.com.      A     YOUR_IP
mail.gametaverns.com.     A     YOUR_IP
studio.gametaverns.com.   A     YOUR_IP
*.gametaverns.com.        A     YOUR_IP

gametaverns.com.          MX    10 mail.gametaverns.com.
gametaverns.com.          TXT   "v=spf1 mx a:mail.gametaverns.com -all"
```

Verify propagation:
```bash
dig +short gametaverns.com
dig +short mail.gametaverns.com
```

---

## 📋 Installation Steps

### Step 1: Clean Environment (5 minutes)

**Critical: Run this even on a "fresh" server to prevent conflicts.**

```bash
# Download clean-install script
curl -fsSL https://raw.githubusercontent.com/GameTaverns/GameTaverns/main/deploy/supabase-selfhosted/scripts/clean-install.sh -o /tmp/clean-install.sh
chmod +x /tmp/clean-install.sh
sudo /tmp/clean-install.sh
```

This script:
- Stops and removes any existing mail containers
- Disables host-level Postfix/Dovecot
- Prunes Docker networks
- Removes conflicting GameTaverns installations

### Step 2: Bootstrap Server (5 minutes)

```bash
curl -fsSL https://raw.githubusercontent.com/GameTaverns/GameTaverns/main/deploy/supabase-selfhosted/bootstrap.sh -o /tmp/bootstrap.sh
chmod +x /tmp/bootstrap.sh
sudo /tmp/bootstrap.sh
```

### Step 3: Install Mailcow FIRST (15 minutes)

**Critical: Install Mailcow before GameTaverns to claim mail ports.**

```bash
cd /opt
git clone https://github.com/mailcow/mailcow-dockerized mailcow
cd mailcow

# Generate config (answer: mail.gametaverns.com for hostname)
./generate_config.sh
```

Edit `mailcow.conf` to avoid port conflicts:
```bash
nano mailcow.conf
```

Change these lines:
```bash
HTTP_PORT=8080
HTTPS_PORT=8443
HTTP_BIND=127.0.0.1
HTTPS_BIND=127.0.0.1
```

**Fix network subnet overlap** (critical!):
```bash
cat > docker-compose.override.yml << 'EOF'
networks:
  mailcow-network:
    driver: bridge
    driver_opts:
      com.docker.network.bridge.name: br-mailcow
    ipam:
      driver: default
      config:
        - subnet: 172.29.0.0/16
EOF
```

Start Mailcow:
```bash
docker compose pull
docker compose up -d

# Wait 2-3 minutes for full initialization
sleep 180
docker compose ps
```

**Verify Mailcow is healthy before continuing:**
```bash
# All containers should show "Up" or "healthy"
docker compose ps | grep -E "(Up|healthy)" | wc -l
# Should show 15+ containers running
```

### Step 4: Clone and Install GameTaverns (20 minutes)

```bash
# Clone repository
git clone https://github.com/GameTaverns/GameTaverns.git /opt/gametaverns
cd /opt/gametaverns/deploy/supabase-selfhosted

# Make scripts executable
chmod +x install.sh scripts/*.sh

# Run installer
sudo ./install.sh
```

The installer will prompt for:
- Admin email and password
- Discord credentials (optional)
- Perplexity API key (recommended for AI features)
- Turnstile keys (recommended for bot protection)
- SMTP settings → **Enter Mailcow SMTP details here**

When prompted for SMTP:
```
External SMTP Host: mail.gametaverns.com
SMTP Port: 587
SMTP User: noreply@gametaverns.com  (create this in Mailcow first!)
SMTP Password: (the password you set in Mailcow)
```

### Step 5: Post-Install Database Fixes (5 minutes)

**Critical: These fixes address GoTrue, Storage, and PostgREST initialization issues.**

This step resolves ALL known database initialization failures we've encountered:
- GoTrue "identities table does not exist" errors
- Storage "permission denied" errors  
- PostgREST authentication failures
- MFA enum type missing errors

```bash
cd /opt/gametaverns

# Load environment
source .env

# Apply critical database fixes
docker compose exec -T db psql -U supabase_admin -d postgres << 'EOSQL'
-- ===========================================
-- FIX 1: Auth schema and search_path for GoTrue
-- Without this, GoTrue can't find/create the identities table
-- ===========================================
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS storage;
CREATE SCHEMA IF NOT EXISTS extensions;

GRANT USAGE ON SCHEMA auth TO supabase_auth_admin;
GRANT ALL ON SCHEMA auth TO supabase_auth_admin;
ALTER ROLE supabase_auth_admin SET search_path TO auth, public, extensions;

-- ===========================================
-- FIX 2: MFA enum types that GoTrue expects
-- These MUST exist before GoTrue runs migrations
-- ===========================================
DO $$
BEGIN
  -- AAL (Authenticator Assurance Level)
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'aal_level' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'auth')) THEN
    CREATE TYPE auth.aal_level AS ENUM ('aal1', 'aal2', 'aal3');
  END IF;
  
  -- Factor types for MFA
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'factor_type' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'auth')) THEN
    CREATE TYPE auth.factor_type AS ENUM ('totp', 'webauthn', 'phone');
  END IF;
  
  -- Factor status
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'factor_status' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'auth')) THEN
    CREATE TYPE auth.factor_status AS ENUM ('unverified', 'verified');
  END IF;
  
  -- Code challenge method for PKCE
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'code_challenge_method' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'auth')) THEN
    CREATE TYPE auth.code_challenge_method AS ENUM ('s256', 'plain');
  END IF;
  
  -- One-time token type
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'one_time_token_type' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'auth')) THEN
    CREATE TYPE auth.one_time_token_type AS ENUM (
      'confirmation_token',
      'reauthentication_token',
      'recovery_token',
      'email_change_token_new',
      'email_change_token_current',
      'phone_change_token'
    );
  END IF;
END
$$;

-- ===========================================
-- FIX 3: Storage admin permissions
-- Without these, storage migrations fail
-- ===========================================
GRANT CONNECT ON DATABASE postgres TO supabase_storage_admin;
GRANT ALL PRIVILEGES ON DATABASE postgres TO supabase_storage_admin;
GRANT USAGE ON SCHEMA storage TO supabase_storage_admin;
GRANT ALL ON SCHEMA storage TO supabase_storage_admin;
GRANT ALL ON ALL TABLES IN SCHEMA storage TO supabase_storage_admin;
GRANT ALL ON ALL SEQUENCES IN SCHEMA storage TO supabase_storage_admin;
GRANT USAGE ON SCHEMA public TO supabase_storage_admin;
GRANT ALL ON ALL TABLES IN SCHEMA public TO supabase_storage_admin;

-- ===========================================
-- FIX 4: PostgREST authenticator role permissions
-- Without these, API calls fail with 403
-- ===========================================
GRANT USAGE ON SCHEMA public TO authenticator;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;

-- Grant table permissions
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- Grant sequence permissions (for inserts with auto-generated IDs)
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Grant execute on all functions
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- ===========================================
-- FIX 5: Ensure extensions schema access
-- ===========================================
GRANT USAGE ON SCHEMA extensions TO PUBLIC;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO PUBLIC;
EOSQL

echo "Database fixes applied. Restarting services..."

# Restart services to pick up fixes
docker compose restart auth storage rest
sleep 15

# Verify services are healthy
echo "Checking service health..."
curl -sf http://localhost:8000/auth/v1/health && echo " Auth: OK" || echo " Auth: FAILED"
curl -sf http://localhost:8000/rest/v1/ -H "apikey: $ANON_KEY" > /dev/null && echo " REST: OK" || echo " REST: FAILED"
```

If auth still shows errors, check the logs:
```bash
docker compose logs auth | tail -50
```

### Step 6: Configure Host Nginx (5 minutes)

Create the main Nginx config:

```bash
sudo nano /etc/nginx/sites-available/gametaverns
```

Paste this configuration:

```nginx
# GameTaverns - Main Site
server {
    listen 80;
    server_name gametaverns.com www.gametaverns.com *.gametaverns.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name gametaverns.com www.gametaverns.com *.gametaverns.com;

    ssl_certificate /etc/letsencrypt/live/gametaverns.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/gametaverns.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;

    # CRITICAL: API routes must go to Kong Gateway, NOT frontend
    location /auth/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
        proxy_send_timeout 60s;
    }

    location /rest/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /functions/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }

    location /storage/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 50M;
    }

    location /realtime/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }

    # Frontend → App container
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# API subdomain
server {
    listen 443 ssl http2;
    server_name api.gametaverns.com;

    ssl_certificate /etc/letsencrypt/live/gametaverns.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/gametaverns.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 50M;
    }
}

# Studio subdomain
server {
    listen 443 ssl http2;
    server_name studio.gametaverns.com;

    ssl_certificate /etc/letsencrypt/live/gametaverns.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/gametaverns.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Mailcow webmail
server {
    listen 443 ssl http2;
    server_name mail.gametaverns.com autodiscover.gametaverns.com autoconfig.gametaverns.com;

    ssl_certificate /etc/letsencrypt/live/gametaverns.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/gametaverns.com/privkey.pem;

    location / {
        proxy_pass https://127.0.0.1:8443;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_ssl_verify off;
    }
}
```

Enable and test:
```bash
sudo ln -sf /etc/nginx/sites-available/gametaverns /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

### Step 7: Get SSL Certificates (5 minutes)

```bash
# Install Cloudflare DNS plugin for wildcards
sudo apt install -y python3-certbot-dns-cloudflare

# Create Cloudflare credentials
sudo mkdir -p /etc/letsencrypt
sudo nano /etc/letsencrypt/cloudflare.ini
```

Add your Cloudflare API token:
```
dns_cloudflare_api_token = YOUR_CLOUDFLARE_API_TOKEN
```

Secure and get certs:
```bash
sudo chmod 600 /etc/letsencrypt/cloudflare.ini

sudo certbot certonly \
  --dns-cloudflare \
  --dns-cloudflare-credentials /etc/letsencrypt/cloudflare.ini \
  -d gametaverns.com \
  -d "*.gametaverns.com" \
  --email admin@gametaverns.com \
  --agree-tos \
  --non-interactive

# Reload nginx with real certs
sudo systemctl reload nginx
```

### Step 8: Create Mailcow Mailbox (2 minutes)

1. Access Mailcow admin: `https://mail.gametaverns.com`
2. Login with default: `admin` / `moohoo`
3. **Change admin password immediately!**
4. Go to **Configuration → Mail Setup → Domains** → Add `gametaverns.com`
5. Go to **Configuration → Mail Setup → Mailboxes** → Create:
   - `noreply@gametaverns.com` (for system emails)
   - `postmaster@gametaverns.com` (required)
6. Copy the DKIM record from **Configuration → ARC/DKIM Keys** and add to DNS

---

## ✅ Verification Checklist

Run these commands to verify everything is working:

```bash
# 1. Check all GameTaverns containers (should be 9-10 running)
cd /opt/gametaverns && docker compose ps

# 2. Check all Mailcow containers (should be 15+ running)
cd /opt/mailcow && docker compose ps

# 3. Test API health
curl -s https://gametaverns.com/auth/v1/health | head -c 100

# 4. Test PostgREST
curl -s https://gametaverns.com/rest/v1/ -H "apikey: $(grep ANON_KEY /opt/gametaverns/.env | cut -d= -f2)" | head -c 100

# 5. Test frontend (should return 200)
curl -s -o /dev/null -w "%{http_code}" https://gametaverns.com

# 6. Verify no port conflicts
sudo lsof -i :993 | head -5   # Should show only Mailcow dovecot
```

---

## 🔧 Troubleshooting

### Port 993 Already in Use

```bash
# Find what's using it
sudo lsof -i :993

# If it's an old GameTaverns mail container
docker stop gametaverns-mail gametaverns-roundcube 2>/dev/null
docker rm gametaverns-mail gametaverns-roundcube 2>/dev/null

# If Mailcow can't bind, restart it after cleanup
cd /opt/mailcow && docker compose down && docker compose up -d
```

### Docker Network Overlap

```bash
# Nuclear option - stop everything, clean networks, restart
cd /opt/mailcow && docker compose down
cd /opt/gametaverns && docker compose down

docker network prune -f

# Start Mailcow first (it claims subnets first)
cd /opt/mailcow && docker compose up -d
sleep 60

# Then GameTaverns
cd /opt/gametaverns && docker compose up -d
```

### Auth Returns 405 or HTML

This means Nginx is routing `/auth/` to the frontend instead of Kong:

```bash
# Verify nginx config has the location blocks
sudo nginx -t
sudo cat /etc/nginx/sites-enabled/gametaverns | grep -A5 "location /auth"

# If missing, re-apply the nginx config from Step 6
```

### JWT Signature Invalid

```bash
cd /opt/gametaverns

# Regenerate keys (DESTRUCTIVE - existing sessions invalidated)
JWT_SECRET=$(openssl rand -base64 64 | tr -d '\n=' | head -c 64)

node -e "
const crypto = require('crypto');
const jwtSecret = '$JWT_SECRET';

function makeJwt(role) {
  const header = Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');
  const now = Math.floor(Date.now()/1000);
  const payload = Buffer.from(JSON.stringify({role,iss:'supabase',iat:now,exp:now+157680000})).toString('base64url');
  const sig = crypto.createHmac('sha256', jwtSecret).update(header+'.'+payload).digest('base64url');
  return header+'.'+payload+'.'+sig;
}

console.log('JWT_SECRET=' + jwtSecret);
console.log('ANON_KEY=' + makeJwt('anon'));
console.log('SERVICE_ROLE_KEY=' + makeJwt('service_role'));
"

# Update .env with new values, then restart
docker compose down && docker compose up -d
```

### GoTrue Fails to Start

```bash
# Check auth logs
docker compose logs auth | tail -50

# If "relation does not exist" errors, run the Step 5 database fixes again
```

---

## 📊 Service Ports Reference

| Service | Container Port | Host Port | Notes |
|---------|---------------|-----------|-------|
| **GameTaverns** |
| Frontend | 80 | 3000 | React SPA |
| Kong API | 8000 | 8000 | API Gateway |
| Studio | 3000 | 3001 | Database Admin |
| PostgreSQL | 5432 | 5432 | Database |
| **Mailcow** |
| Nginx (web) | 80/443 | 8080/8443 | Webmail |
| Postfix (SMTP) | 25 | 25 | Inbound mail |
| Postfix (Submission) | 587 | 587 | Outbound mail |
| Dovecot (IMAP) | 993 | 993 | Mail retrieval |

---

## 🔄 Maintenance Commands

```bash
# Update GameTaverns
cd /opt/gametaverns
git pull origin main
docker compose build app
docker compose up -d

# Update Mailcow
cd /opt/mailcow
./update.sh

# Backup database
cd /opt/gametaverns
./scripts/backup.sh

# View logs
docker compose logs -f          # All services
docker compose logs -f auth     # Just auth service
docker compose logs -f functions # Edge functions
```

---

## 🎉 Success!

Your GameTaverns instance should now be running at:

- **Main Site**: https://gametaverns.com
- **API**: https://api.gametaverns.com  
- **Database Studio**: https://studio.gametaverns.com
- **Webmail**: https://mail.gametaverns.com
- **Libraries**: https://{slug}.gametaverns.com

Credentials are saved in `/root/gametaverns-credentials.txt` - **delete after copying!**
