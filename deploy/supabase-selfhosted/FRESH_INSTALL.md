# GameTaverns - Complete Fresh Installation Guide

**One-Shot Installation for Ubuntu 24.04 with Mailcow**
**Version: 2.7.0 - Complete Deployment Sweep Edition**

The `install.sh` script now handles **everything** in one run (14 automated steps):
- ✅ Mailcow mail server installation (optional, automated)
- ✅ Security key generation (properly signed JWTs)
- ✅ Database setup with correct order of operations
- ✅ Database migrations
- ✅ Turnstile site key insertion into database
- ✅ Host Nginx configuration (with proper API routing)
- ✅ SSL certificates (Cloudflare wildcard support)
- ✅ Admin user creation with proper role assignment
- ✅ Database admin role hardening (prevents privilege escalation)
- ✅ Email/mailbox configuration
- ✅ Full health check verification

---

## 🔐 Issues Addressed in This Version

| Issue | Root Cause | Solution in v2.7.0 |
|-------|-----------|-------------------|
| **Database/admin setup fails** | Services connect before DB ready | Step 7: DB-only startup with `pg_isready` wait |
| **Turnstile bypass mode** | Site key not in database | Step 8b: Explicit INSERT into `site_settings` |
| **Mail cert overrides primary** | Mailcow uses own SSL | Mailcow `SKIP_LETS_ENCRYPT=y` + host Nginx termination |
| **Self-hosted flag issues** | Frontend uses wrong API mode | `SELF_HOSTED: false` in runtime config |
| **Frontend can't reach API** | Wrong API URL | Same-origin routing via `/auth/`, `/rest/`, `/functions/` |

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Host Nginx (SSL Termination)             │
│  *.gametaverns.com wildcard cert                            │
├─────────────────────────────────────────────────────────────┤
│  /auth/*     → Kong:8000 → GoTrue:9999                      │
│  /rest/*     → Kong:8000 → PostgREST:3000                   │
│  /functions/* → Kong:8000 → Edge-Runtime:9000               │
│  /storage/*  → Kong:8000 → Storage-API:5000                 │
│  /           → Frontend:3000 (React SPA)                    │
├─────────────────────────────────────────────────────────────┤
│  mail.*      → Mailcow:8443 (proxy_ssl_verify off)          │
│  studio.*    → Supabase Studio:3001                         │
└─────────────────────────────────────────────────────────────┘
```

**Key Design Decisions:**
1. **Same-origin API**: Frontend accesses APIs via path-based routing, not subdomains
2. **SSL at host level**: All SSL termination happens at host Nginx, not in containers
3. **Mailcow isolated**: Mailcow uses internal ports (8080/8443), proxied through host Nginx
4. **SELF_HOSTED=false**: Frontend uses Supabase client, not Express API

---

## 📋 Pre-Flight Checklist

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

## 📋 Installation Steps (3 Commands!)

### Step 1: Clean Environment (2 minutes)

**Critical: Run this even on a "fresh" server to prevent conflicts.**

```bash
# Download clean-install script
curl -fsSL https://raw.githubusercontent.com/GameTaverns/GameTaverns/main/deploy/supabase-selfhosted/scripts/clean-install.sh -o /tmp/clean-install.sh
chmod +x /tmp/clean-install.sh
sudo /tmp/clean-install.sh
```

### Step 2: Bootstrap Server (5 minutes)

```bash
curl -fsSL https://raw.githubusercontent.com/GameTaverns/GameTaverns/main/deploy/supabase-selfhosted/bootstrap.sh -o /tmp/bootstrap.sh
chmod +x /tmp/bootstrap.sh
sudo /tmp/bootstrap.sh
```

### Step 3: Clone and Run Unified Installer (30 minutes)

**This is the main step - it handles Mailcow, SSL, and everything else!**

```bash
# Clone repository
git clone https://github.com/GameTaverns/GameTaverns.git /opt/gametaverns
cd /opt/gametaverns/deploy/supabase-selfhosted

# Make scripts executable
chmod +x install.sh scripts/*.sh

# Run the unified installer
sudo ./install.sh
```

The installer will prompt for:

1. **Admin credentials** - Email, password, display name
2. **Mailcow installation** - Say "Y" for full mail server (recommended)
3. **Discord credentials** - Bot token, client ID/secret (optional)
4. **Perplexity API key** - Powers all AI features (recommended)
5. **Turnstile keys** - Bot protection (recommended)
6. **External SMTP** - Leave empty if using Mailcow
7. **SSL setup** - Say "Y" for Cloudflare wildcard certificates
8. **Mailbox configuration** - Enter password for noreply@domain

---

## 🔧 What the Installer Does (14 Steps)

| Step | Action | Why It Matters |
|------|--------|----------------|
| 0 | Mailcow setup | Installs on ports 8080/8443, disables internal SSL |
| 1 | Collect config | Gets admin email, API keys, Turnstile keys |
| 2 | Generate keys | Creates JWT_SECRET, ANON_KEY, SERVICE_ROLE_KEY |
| 3 | Setup directories | Creates /opt/gametaverns structure |
| 4 | Generate .env | Creates config with correct API_EXTERNAL_URL |
| 5 | Pull images | Downloads Docker images |
| 6 | Build frontend | Compiles React app |
| 7 | Start DB only | Waits for `pg_isready` before continuing |
| 7a | Create roles | Roles exist BEFORE services connect |
| 7b | Create schemas | Auth enums exist BEFORE GoTrue starts |
| 8 | Run migrations | Creates tables, views, policies |
| 8a | Grant permissions | anon/authenticated can access tables |
| 8b | Insert Turnstile | Site key goes into `site_settings` |
| 9 | Start services | Auth, REST, Storage, Kong, App |
| 10 | Configure Nginx | Path-based routing for same-origin API |
| 11 | SSL setup | Cloudflare wildcard certs |
| 12 | Create admin | Profile FIRST, then role assignment |
| 13 | Email config | Updates SMTP settings in .env |
| 14 | Health check | Verifies all services running |

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
source /opt/gametaverns/.env
curl -s https://gametaverns.com/rest/v1/ -H "apikey: $ANON_KEY" | head -c 100

# 5. Test frontend (should return 200)
curl -s -o /dev/null -w "%{http_code}" https://gametaverns.com

# 6. Check Turnstile key in database
docker compose exec -T db psql -U supabase_admin -d postgres -c \
  "SELECT key, LEFT(value, 20) FROM site_settings WHERE key = 'turnstile_site_key';"

# 7. Verify no port conflicts
sudo lsof -i :993 | head -5   # Should show only Mailcow dovecot
```

---

## 🔧 Troubleshooting

### API Returns 404 or HTML

This means Nginx is routing to frontend instead of Kong:

```bash
# Verify nginx config has the location blocks
sudo nginx -t
grep -A5 "location /auth/" /etc/nginx/sites-enabled/gametaverns

# Should show: proxy_pass http://127.0.0.1:8000;
```

### Turnstile Shows "No Site Key"

```bash
# Check if key is in database
docker compose exec -T db psql -U supabase_admin -d postgres -c \
  "SELECT value FROM site_settings WHERE key = 'turnstile_site_key';"

# If empty, insert it manually
docker compose exec -T db psql -U supabase_admin -d postgres -c \
  "INSERT INTO site_settings (key, value) VALUES ('turnstile_site_key', 'your-site-key') ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;"
```

### Frontend Shows "Testing Environment" Banner

The runtime config isn't loading correctly:

```bash
# Check runtime config
curl -s https://gametaverns.com/runtime-config.js | head -20

# Should show:
# IS_PRODUCTION: true,
# SELF_HOSTED: false,
```

### Mail SSL Certificate Error

Ensure host Nginx uses the wildcard cert for mail subdomain:

```bash
# Check which cert mail.domain is using
openssl s_client -connect mail.gametaverns.com:443 -servername mail.gametaverns.com 2>/dev/null | openssl x509 -noout -subject

# Should show: CN = gametaverns.com (the wildcard)
```

### GoTrue Won't Start

```bash
# Check auth logs
docker compose logs auth | tail -50

# Common fix: ensure auth schema exists
docker compose exec -T db psql -U supabase_admin -d postgres -c \
  "ALTER ROLE supabase_auth_admin SET search_path TO auth, public, extensions;"
docker compose restart auth
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
| Nginx (web) | 80/443 | 8080/8443 | Internal only |
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

# Restart after config changes
docker compose restart auth     # After .env SMTP changes
```

---

## 🎉 Success!

Your GameTaverns instance should now be running at:

- **Main Site**: https://gametaverns.com
- **API**: https://gametaverns.com (via /auth/, /rest/, /functions/)
- **Database Studio**: https://studio.gametaverns.com
- **Webmail**: https://mail.gametaverns.com
- **Libraries**: https://{slug}.gametaverns.com

Credentials are saved in `/root/gametaverns-credentials.txt` - **delete after copying!**
