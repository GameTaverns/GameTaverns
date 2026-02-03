# GameTaverns - Self-Hosted Supabase Deployment

Complete self-hosted stack using official Supabase Docker images for 1:1 feature parity with Lovable Cloud.

**Domain:** `gametaverns.com` (hardcoded)  
**Tenant Libraries:** `*.gametaverns.com` (e.g., `tzolak.gametaverns.com`)  
**Version:** 2.3.3 - Mailcow Integration  
**Audited:** 2026-02-03

---

## 🚀 Fresh Install? Start Here!

**For new installations, use the comprehensive guide:**

📖 **[FRESH_INSTALL.md](FRESH_INSTALL.md)** - Complete step-by-step guide with Mailcow integration

This guide incorporates all lessons learned and prevents common issues like:
- Port 993 conflicts between mail services
- Docker network subnet overlaps
- Nginx routing misconfigurations
- JWT key signing problems

---

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
| RAM | 4GB | 6GB+ (for Mailcow) |
| Disk | 20GB | 50GB+ |
| CPU | 1 vCPU | 2+ vCPU |

**Network Requirements:**
- Ports 80, 443 open (HTTPS)
- Ports 25, 587, 993 open (for Mailcow)
- DNS configured (see below)

## Mail Server

**This stack uses [Mailcow](https://mailcow.email/) for email services.**

The bundled Postfix/Dovecot/Roundcube containers have been removed in favor of Mailcow, which provides:
- Full mail stack (SMTP + IMAP)
- Webmail via SOGo
- Spam filtering (Rspamd)
- Easy administration UI

See [MAILCOW.md](MAILCOW.md) for integration details or [FRESH_INSTALL.md](FRESH_INSTALL.md) for complete setup instructions.

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
| TXT | @ | v=spf1 mx a:mail.gametaverns.com -all |

The wildcard (`*`) record enables tenant subdomains like `tzolak.gametaverns.com`.

## Quick Start

### Option A: Fresh Install (Recommended)

Follow **[FRESH_INSTALL.md](FRESH_INSTALL.md)** for complete step-by-step instructions.

### Option B: Quick Install (Experienced Users)

```bash
# 1. Bootstrap server
curl -fsSL https://raw.githubusercontent.com/GameTaverns/GameTaverns/main/deploy/supabase-selfhosted/bootstrap.sh | sudo bash

# 2. Install Mailcow FIRST
cd /opt && git clone https://github.com/mailcow/mailcow-dockerized mailcow
cd mailcow && ./generate_config.sh
# Edit mailcow.conf: HTTP_PORT=8080, HTTPS_PORT=8443
docker compose up -d

# 3. Install GameTaverns
git clone https://github.com/GameTaverns/GameTaverns.git /opt/gametaverns
cd /opt/gametaverns/deploy/supabase-selfhosted
sudo ./install.sh
```

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
│   Frontend      │  │   Kong Gateway  │  │   Roundcube     │
│   (Static)      │  │   (Port 8000)   │  │   Webmail       │
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
| Roundcube | 9001 | Webmail |

### Roundcube Webmail

Roundcube provides a lightweight webmail client accessible at `https://mail.gametaverns.com`:

- **Webmail**: Full email client with search, folders, filters
- **Archive**: Built-in archive plugin for email organization
- **Attachments**: Up to 25MB file attachments

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
