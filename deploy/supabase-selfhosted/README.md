# GameTaverns - Self-Hosted Supabase Deployment

Complete self-hosted stack using official Supabase Docker images for 1:1 feature parity with Lovable Cloud.

**Domain:** `gametaverns.com` (hardcoded)  
**Tenant Libraries:** `*.gametaverns.com` (e.g., `tzolak.gametaverns.com`)  
**Version:** 2.3.0 - 2FA & Security Hardening  
**Last Audit:** 2026-02-01

## ⚠️ Database Isolation

**This is a completely fresh, isolated database.**

- No connection to Lovable Cloud
- No shared data with any other environment
- All data starts from scratch
- See `MIGRATION.md` for importing existing data

## Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| OS | Ubuntu 22.04 LTS | Ubuntu 24.04 LTS |
| RAM | 2GB | 4GB+ |
| Disk | 20GB | 50GB+ |
| CPU | 1 vCPU | 2+ vCPU |

**Network Requirements:**
- Ports 80, 443 open (HTTPS)
- Ports 25, 587, 993 open (optional, for mail)
- DNS configured (see below)

## DNS Configuration

Configure these DNS records pointing to your server **before** running the installer:

| Type | Name | Value |
|------|------|-------|
| A | @ | YOUR_SERVER_IP |
| A | www | YOUR_SERVER_IP |
| A | api | YOUR_SERVER_IP |
| A | mail | YOUR_SERVER_IP |
| A | studio | YOUR_SERVER_IP |
| A | * | YOUR_SERVER_IP |
| MX | @ | mail.gametaverns.com (priority 10) |
| TXT | @ | v=spf1 mx a ~all |

The wildcard (`*`) record enables tenant subdomains like `tzolak.gametaverns.com`.

## Quick Start (2 Steps)

### Step 1: Bootstrap Server (Fresh Ubuntu Only)

Run this on a fresh Ubuntu server to install all prerequisites:

```bash
# Option A: One-liner (downloads and runs bootstrap script)
curl -fsSL https://raw.githubusercontent.com/GameTaverns/GameTaverns/main/deploy/supabase-selfhosted/bootstrap.sh | sudo bash

# Option B: Manual download
wget https://raw.githubusercontent.com/GameTaverns/GameTaverns/main/deploy/supabase-selfhosted/bootstrap.sh
chmod +x bootstrap.sh
sudo ./bootstrap.sh
```

**Bootstrap installs:**
- Docker & Docker Compose
- Nginx (reverse proxy)
- Certbot (SSL certificates)
- UFW Firewall (configured)
- Fail2ban (security)
- Git, curl, jq, and utilities

### Step 2: Install GameTaverns

```bash
# Clone repository
git clone https://github.com/GameTaverns/GameTaverns.git /opt/gametaverns

# Make installer executable and run
cd /opt/gametaverns/deploy/supabase-selfhosted
chmod +x install.sh
sudo ./install.sh
```

**The installer handles:**
- ✓ Docker image pulls
- ✓ Security key generation (JWT, encryption, etc.)
- ✓ API key configuration (Discord, Perplexity, Turnstile, etc.)
- ✓ Database setup & all 14 migrations
- ✓ Frontend build
- ✓ Mail server (Postfix + Dovecot + SOGo)
- ✓ SSL certificate setup (Let's Encrypt or Cloudflare)
- ✓ Admin user creation

After completion, visit: **https://gametaverns.com**

## API Keys Configured During Install

The installer prompts for all API keys upfront:

| Key | Purpose | Required |
|-----|---------|----------|
| Discord Bot Token | Notifications & webhooks | Recommended |
| Discord Client ID/Secret | OAuth login | Recommended |
| Perplexity API Key | Game recommendations | Recommended |
| OpenAI API Key | Enhanced AI features | Optional |
| Firecrawl API Key | URL-based game imports | Recommended |
| Turnstile Site/Secret | Bot protection | **Required** |

To update API keys later:
```bash
nano /opt/gametaverns/.env
docker compose restart functions
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Nginx (443/80)                       │
│                    SSL + Subdomain Routing                   │
└─────────────────────────────────────────────────────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   Frontend      │  │   Kong Gateway  │  │   SOGo          │
│   (Static)      │  │   (Port 8000)   │  │   Groupware     │
│   Port 3000     │  │                 │  │   Port 9001     │
└─────────────────┘  └────────┬────────┘  └─────────────────┘
                              │
    ┌──────────┬──────────┬───┴───┬──────────┬──────────┐
    ▼          ▼          ▼       ▼          ▼          ▼
┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
│  Auth  │ │  REST  │ │Realtime│ │Storage │ │  Edge  │ │ Studio │
│ GoTrue │ │PostgRES│ │        │ │        │ │  Func  │ │        │
└────────┘ └────────┘ └────────┘ └────────┘ └────────┘ └────────┘
    │          │          │          │          │          │
    └──────────┴──────────┴────┬─────┴──────────┴──────────┘
                               ▼
                    ┌─────────────────────┐
                    │    PostgreSQL 15    │
                    │     (Port 5432)     │
                    └─────────────────────┘
```

## Services

| Service | Port | Purpose |
|---------|------|---------|
| Frontend | 3000 | React SPA |
| Kong Gateway | 8000 | API routing |
| Studio | 3001 | Database admin UI |
| PostgreSQL | 5432 | Database |
| Auth (GoTrue) | 9999 | Authentication |
| REST (PostgREST) | 3002 | REST API |
| Realtime | 4000 | WebSocket subscriptions |
| Storage | 5000 | File storage |
| Edge Functions | 9000 | Deno runtime |
| Mail (Postfix) | 25/587 | Outgoing email |
| Mail (Dovecot) | 993 | IMAP |
| SOGo | 9001 | Webmail + Calendar + Contacts |

### SOGo Groupware Features

SOGo provides a full groupware solution accessible at `https://mail.gametaverns.com`:

- **Webmail**: Full email client with search, folders, filters
- **Calendar**: CalDAV with event scheduling and sharing
- **Contacts**: CardDAV address book with sync
- **ActiveSync**: Mobile device synchronization (iOS/Android)

## Directory Structure

```
/opt/gametaverns/
├── .env                    # Production config (chmod 600)
├── docker-compose.yml      # Main orchestration
├── volumes/
│   ├── db/                 # PostgreSQL data
│   ├── storage/            # File uploads
│   └── mail/               # Mailboxes
├── nginx/
│   ├── gametaverns.conf    # Main site
│   └── ssl/                # Certificates
├── scripts/                # Management scripts
└── logs/                   # Application logs
```

## Management Commands

```bash
cd /opt/gametaverns

# View all logs
docker compose logs -f

# Check service status
docker compose ps

# Restart specific service
docker compose restart auth

# Backup database
./scripts/backup.sh

# Update to latest version
./scripts/update.sh

# Re-run migrations
./scripts/run-migrations.sh
```

## Troubleshooting

### Services won't start
```bash
# Check Docker is running
sudo systemctl status docker

# Check for port conflicts
sudo netstat -tlnp | grep -E '(3000|8000|5432)'

# View logs
docker compose logs -f
```

### Database connection refused
```bash
# Wait for healthy status
docker compose ps

# Check db health specifically
docker compose logs db
```

### Auth not working
```bash
# Verify JWT secrets match
docker compose exec auth env | grep JWT

# Check auth logs
docker compose logs auth
```

### Edge functions failing
```bash
# Check function logs
docker compose logs functions

# Verify functions are mounted
docker compose exec functions ls -la /home/deno/functions
```

## Migrating from Native Deployment

If you're migrating from the native Express-based deployment:

1. **Database**: Export with `pg_dump`, import into Supabase PostgreSQL
2. **Users**: Auth users are in `auth.users`, profiles in `public.user_profiles`
3. **Files**: Copy `/opt/gametaverns/uploads/` to storage volume
4. **Config**: Map `.env` values to new format

See `MIGRATION.md` for detailed steps.

## Security Checklist

- [ ] Change default admin password after first login
- [ ] Delete `/root/gametaverns-credentials.txt` after noting values
- [ ] Configure Turnstile for bot protection
- [ ] Set up proper DNS SPF/DKIM for email deliverability
- [ ] Enable automatic backups via cron
- [ ] Review RLS policies for your use case
