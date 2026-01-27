# Game Haven v1 - Full Supabase Stack

Complete self-hosting guide for the full Supabase platform with all features.

> ⚠️ **Note:** v1 requires more resources (4GB+ RAM) and is more complex. Consider [v2](./README-v2.md) for simpler setups.

---

## Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| Ubuntu | 24.04 LTS | 24.04 LTS |
| RAM | 4GB | 8GB |
| Storage | 20GB | 40GB |
| CPU | 2 cores | 4 cores |

---

## Quick Start (Fresh Ubuntu 24.04)

Run this single command on a fresh Ubuntu server:

```bash
sudo apt update && sudo apt upgrade -y && \
sudo apt install -y curl git nginx certbot python3-certbot-nginx && \
curl -fsSL https://get.docker.com | sh && \
sudo usermod -aG docker $USER && \
newgrp docker && \
git clone https://github.com/ThaneWinters/GameTavern.git && \
cd GameTavern/deploy/standalone && \
chmod +x install.sh scripts/*.sh && \
./install.sh
```

**That's it!** The installer handles everything including optional SSL setup.

---

## Step-by-Step Installation

### 1. Update System

```bash
sudo apt update && sudo apt upgrade -y
```

### 2. Install All Prerequisites

Install all required packages in one command:

```bash
sudo apt install -y \
  curl \
  git \
  nginx \
  certbot \
  python3-certbot-nginx
```

### 3. Install Docker

```bash
# Install Docker
curl -fsSL https://get.docker.com | sh

# Add your user to docker group
sudo usermod -aG docker $USER

# Apply group changes (or logout/login)
newgrp docker

# Verify installation
docker --version
docker compose version
```

### 4. Clone Repository

```bash
git clone https://github.com/ThaneWinters/GameTavern.git
cd GameTavern/deploy/standalone
```

### 5. Make Scripts Executable

```bash
chmod +x install.sh scripts/*.sh
```

### 6. Run Installer

```bash
./install.sh
```

The installer will:
1. Prompt for site name and admin credentials
2. Generate secure secrets automatically
3. Start all Docker services (7+ containers)
4. Run database migrations
5. Create your admin user
6. **Offer to configure Nginx with SSL** (if not localhost)

### 7. Access Your Site

- **Frontend:** `http://your-server-ip:3000` (or `https://yourdomain.com` with SSL)
- **Supabase Studio:** `http://your-server-ip:3001`

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Your Linux Server                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Game Haven  │  │    Kong     │  │      PostgreSQL     │  │
│  │  Frontend   │──│  API Gateway│──│   + Auth + REST     │  │
│  │   :3000     │  │    :8000    │  │   + Realtime        │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Services (7+ containers)

| Service | Description | Port |
|---------|-------------|------|
| Game Haven | Frontend app | 3000 |
| PostgreSQL | Database | 5432 |
| GoTrue | Authentication | - |
| PostgREST | REST API | - |
| Kong | API Gateway | 8000 |
| Realtime | WebSockets | - |
| Studio | Database UI | 3001 |

---

## Configuration

### Environment Variables

Edit `.env` to customize:

```bash
nano .env
```

```bash
# Site Settings
SITE_NAME=Game Haven
SITE_DESCRIPTION=Browse and discover our collection of board games
SITE_URL=http://localhost:3000
API_EXTERNAL_URL=http://localhost:8000

# Ports
APP_PORT=3000
STUDIO_PORT=3001
POSTGRES_PORT=5432
KONG_HTTP_PORT=8000

# Security (auto-generated - don't change unless needed)
POSTGRES_PASSWORD=...
JWT_SECRET=...
ANON_KEY=...
SERVICE_ROLE_KEY=...

# Features
FEATURE_PLAY_LOGS=true
FEATURE_WISHLIST=true
FEATURE_FOR_SALE=true
FEATURE_MESSAGING=true
FEATURE_COMING_SOON=true
FEATURE_DEMO_MODE=false

# AI - Bring Your Own Key (optional)
# For BGG data extraction and description condensing
# Supports: Perplexity (recommended), OpenAI
PERPLEXITY_API_KEY=pplx-...
# OR
OPENAI_API_KEY=sk-...
```

After editing, restart:

```bash
docker compose restart
```

---

## Administration

### Create Additional Admin Users

```bash
./scripts/create-admin.sh
```

### Backup Database

```bash
./scripts/backup.sh
```

Backups are saved to `./backups/` with timestamps.

### Restore Database

```bash
./scripts/restore.sh ./backups/gamehaven_20240101_120000.sql.gz
```

---

## Docker Commands

```bash
# Start all services
docker compose up -d

# Stop all services
docker compose down

# View logs (all services)
docker compose logs -f

# View specific service logs
docker compose logs -f gamehaven
docker compose logs -f db
docker compose logs -f auth

# Restart a service
docker compose restart gamehaven

# Rebuild and restart
docker compose build --no-cache
docker compose up -d

# Check service status
docker compose ps
```

---

## Troubleshooting

### Services not starting

```bash
# Check status
docker compose ps

# Fix database passwords
./scripts/fix-db-passwords.sh

# Restart
docker compose restart
```

### Auth service errors (401 Unauthorized)

```bash
# Check auth logs
docker logs gamehaven-auth --tail=50

# Check Kong gateway logs
docker logs gamehaven-kong --tail=50

# Verify JWT configuration
./scripts/fix-auth-permissions.sh
```

### Database connection issues

```bash
# Check if database is ready
docker exec gamehaven-db pg_isready

# Test connection
docker exec gamehaven-db psql -U supabase_admin -d postgres -c "SELECT 1;"

# View database logs
docker compose logs db
```

### Password authentication failed

```bash
./scripts/fix-db-passwords.sh
docker compose restart
```

### Studio "Failed to retrieve users" error

The installer automatically patches this, but if it occurs:

```bash
docker exec gamehaven-db psql -U supabase_admin -d postgres -c \
  "ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN DEFAULT FALSE;"
docker compose restart studio
```

### Reset everything (nuclear option)

```bash
docker compose down -v
./install.sh
```

---

## Data Persistence & Safety

**Your data is stored in Docker volumes**, which persist across:
- Container restarts (`docker compose restart`)
- System reboots
- `docker stop` / `docker start` commands
- `docker compose down` (without `-v`)

**Data is ONLY deleted when you explicitly use the `-v` flag:**
```bash
docker compose down -v   # ⚠️ THIS DELETES ALL DATA
```

| Command | Containers | Data |
|---------|-----------|------|
| `docker compose stop` | Stopped | ✅ Safe |
| `docker compose down` | Removed | ✅ Safe |
| `docker compose down -v` | Removed | ❌ **DELETED** |
| System shutdown/reboot | Stopped | ✅ Safe |

---

## Reinstall / Backout (keep DB vs wipe DB)

When reinstalling, you have two safe options:

### Option A — Reinstall but KEEP the existing database (recommended)

1) **Stop containers (keep volumes):**
```bash
docker compose down
```

2) **Re-run installer and choose to reuse secrets** when prompted (this keeps the DB and prevents auth/key mismatches):
```bash
./install.sh
```

### Option B — Full backout: WIPE the database and start fresh

1) **(Optional) Backup first:**
```bash
./scripts/backup.sh
```

2) **Stop containers AND delete volumes (this deletes the DB):**
```bash
docker compose down -v
```

3) **Re-run installer:**
```bash
./install.sh
```

> Tip: If you want to remove only the DB volume, you can find it with `docker volume ls | grep gamehaven` and remove it explicitly.

---

## Updating

```bash
cd ~/GameTavern
git fetch origin
git reset --hard origin/main
cd deploy/standalone
chmod +x install.sh scripts/*.sh
docker compose build --no-cache
docker compose up -d
```

---

## Uninstall

```bash
# Stop and remove containers + volumes
docker compose down -v

# Remove Docker image
docker rmi standalone-gamehaven:latest

# Remove project files
cd ~ && rm -rf ~/GameTavern

# Remove Nginx config (if configured)
sudo rm -f /etc/nginx/sites-enabled/gamehaven
sudo rm -f /etc/nginx/sites-available/gamehaven
sudo systemctl reload nginx

# Clear Docker cache
docker builder prune -af
```

---

## Database Schema

The v1 stack uses the full Supabase schema with RLS policies:

| Table | Description |
|-------|-------------|
| `games` | Game catalog |
| `game_mechanics` | Game-to-mechanic mappings |
| `game_sessions` | Play history |
| `game_wishlist` | User wishlists |
| `game_messages` | Contact messages (encrypted) |
| `game_ratings` | User ratings |
| `site_settings` | Configuration |
| `user_roles` | Admin permissions |

All tables have Row Level Security enabled.

---

## Edge Functions

v1 includes Supabase Edge Functions:

| Function | Purpose |
|----------|---------|
| `bgg-lookup` | Search BoardGameGeek |
| `bgg-import` | Import game from BGG |
| `send-message` | Contact form |
| `rate-game` | Submit rating |
| `wishlist` | Wishlist management |
| `condense-descriptions` | AI summarization (BYOK) |

Functions are automatically deployed and routed through Kong at `/functions/v1/`.

> If edge functions appear to be missing/404 in v1, verify the `functions` container is mounting the repo’s `supabase/functions` directory (not `deploy/standalone/functions`).
