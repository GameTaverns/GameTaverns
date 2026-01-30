# GameTaverns - Self-Hosted Supabase Deployment

Complete self-hosted stack using official Supabase Docker images for 1:1 feature parity with Lovable Cloud.

**Domain:** `gametaverns.com` (hardcoded)  
**Tenant Libraries:** `*.gametaverns.com` (e.g., `tzolak.gametaverns.com`)

## ⚠️ Database Isolation

**This is a completely fresh, isolated database.**

- No connection to Lovable Cloud
- No shared data with any other environment
- All data starts from scratch
- See `MIGRATION.md` for importing existing data

## Requirements

- Ubuntu 22.04 or 24.04 LTS
- 4GB RAM minimum (8GB recommended)
- 50GB disk space
- DNS configured (see below)
- Ports 80, 443 open

## DNS Configuration

Before running the installer, configure these DNS records pointing to your server:

| Type | Name | Value |
|------|------|-------|
| A | @ | YOUR_SERVER_IP |
| A | www | YOUR_SERVER_IP |
| A | api | YOUR_SERVER_IP |
| A | mail | YOUR_SERVER_IP |
| A | studio | YOUR_SERVER_IP |
| A | * | YOUR_SERVER_IP |
| MX | @ | mail.gametaverns.com |
| TXT | @ | v=spf1 mx a ~all |

The wildcard (`*`) record enables tenant subdomains like `tzolak.gametaverns.com`.

## Quick Start

```bash
# 1. Clone and navigate
git clone https://github.com/GameTaverns/GameTaverns.git
cd GameTaverns/deploy/supabase-selfhosted

# 2. Run preflight check (catches common issues)
sudo ./scripts/preflight-check.sh

# 3. Run installer (will prompt for API keys)
# This handles EVERYTHING: Docker, database, migrations, etc.
sudo ./install.sh

# 4. Set up SSL (includes wildcard cert for *.gametaverns.com)
cd /opt/gametaverns
sudo ./scripts/setup-ssl.sh

# 5. Create admin user
sudo ./scripts/create-admin.sh

# 6. Visit https://gametaverns.com
```

The installer is fully automated and will:
- Install Docker and Docker Compose if needed
- Generate all security keys (JWT, encryption, etc.)
- Pull all required Docker images
- Build the frontend container
- Start all services
- Run all database migrations
- Create the storage buckets

## API Keys Configured During Install

The installer prompts for all API keys upfront:

| Key | Purpose | Required |
|-----|---------|----------|
| Discord Bot Token | Notifications & webhooks | Recommended |
| Discord Client ID/Secret | OAuth login | Recommended |
| Perplexity API Key | Game recommendations | Recommended |
| OpenAI API Key | Enhanced AI features | Optional |
| Firecrawl API Key | URL-based game imports | Recommended |
| Turnstile Site/Secret | Bot protection | Required |

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
│   (Static)      │  │   (Port 8000)   │  │   (Webmail)     │
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
| Roundcube | 9001 | Webmail UI |

## Directory Structure

```
/opt/gametaverns/
├── .env                    # Production config
├── docker-compose.yml      # Main orchestration
├── volumes/
│   ├── db/                 # PostgreSQL data
│   ├── storage/            # File uploads
│   └── mail/               # Mailboxes
├── nginx/
│   ├── gametaverns.conf    # Main site
│   └── ssl/                # Certificates
└── logs/                   # Application logs
```

## Common Issues & Solutions

### Issue: Services won't start
```bash
# Check Docker is running
sudo systemctl status docker

# Check for port conflicts
sudo netstat -tlnp | grep -E '(3000|8000|5432)'

# View logs
docker compose logs -f
```

### Issue: Database connection refused
```bash
# Wait for healthy status
docker compose ps

# Check db health specifically
docker compose logs db
```

### Issue: Auth not working
```bash
# Verify JWT secrets match
docker compose exec auth env | grep JWT

# Check auth logs
docker compose logs auth
```

### Issue: Edge functions failing
```bash
# Check function logs
docker compose logs functions

# Verify functions are mounted
docker compose exec functions ls -la /home/deno/functions
```

## Maintenance

```bash
# Backup database
./scripts/backup.sh

# Update to latest
./scripts/update.sh

# View all logs
docker compose logs -f

# Restart specific service
docker compose restart auth
```

## Migrating from Native Deployment

If you're migrating from the native Express-based deployment:

1. **Database**: Export with `pg_dump`, import into Supabase PostgreSQL
2. **Users**: Auth users are in `auth.users`, profiles in `public.user_profiles`
3. **Files**: Copy `/opt/gametaverns/uploads/` to storage volume
4. **Config**: Map `.env` values to new format

See `MIGRATION.md` for detailed steps.
