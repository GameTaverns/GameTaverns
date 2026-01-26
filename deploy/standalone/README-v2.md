# Game Haven v2 - Simplified Self-Hosted Stack

Complete self-hosting guide using the streamlined Node.js/Express backend. **One command** to install.

---

## Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| Ubuntu | 24.04 LTS | 24.04 LTS |
| RAM | 2GB | 4GB |
| Storage | 10GB | 20GB |
| CPU | 1 core | 2 cores |

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
./install.sh --v2
```

**That's it!** The installer handles everything:
- Prompts for site name and admin credentials
- Generates secure secrets automatically
- Starts all services (3 containers)
- Creates database and runs migrations automatically
- Creates your admin user
- **Offers to configure Nginx with SSL** (if not localhost)

Access your site at `http://your-server-ip:3000` or `https://yourdomain.com`

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
./install.sh --v2
```

The installer will:
1. Prompt for site name and admin credentials
2. Generate secure secrets automatically
3. Start all services (3 containers)
4. Initialize database with schema
5. Create your admin user
6. **Offer to configure Nginx with SSL** (if not localhost)

### 7. Access Your Site

- **Frontend:** `http://your-server-ip:3000` (or `https://yourdomain.com` with SSL)
- **API Health:** `http://your-server-ip:3001/health`

---

## Architecture

```
┌───────────────────────────────────────────────┐
│              Your Server                       │
│  ┌─────────┐  ┌─────────┐  ┌──────────────┐  │
│  │ Frontend│──│   API   │──│  PostgreSQL  │  │
│  │  :3000  │  │  :3001  │  │    :5432     │  │
│  └─────────┘  └─────────┘  └──────────────┘  │
└───────────────────────────────────────────────┘
```

Only **3 containers** vs 7+ in v1:

| Service | Description | Port |
|---------|-------------|------|
| App | Nginx + React frontend | 3000 |
| API | Node.js/Express backend | 3001 |
| DB | PostgreSQL 16 | 5432 |

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

# Ports
APP_PORT=3000
API_PORT=3001
POSTGRES_PORT=5432

# Security (auto-generated - don't change unless needed)
POSTGRES_PASSWORD=...
JWT_SECRET=...

# Features
FEATURE_PLAY_LOGS=true
FEATURE_WISHLIST=true
FEATURE_FOR_SALE=true
FEATURE_MESSAGING=true
FEATURE_RATINGS=true
FEATURE_DEMO_MODE=false

# AI (Bring Your Own Key - Optional)
# AI_PROVIDER=openai
# AI_API_KEY=sk-...

# Email (Optional)
# SMTP_HOST=smtp.example.com
# SMTP_PORT=587
# SMTP_USER=
# SMTP_PASS=
# SMTP_FROM=noreply@example.com

# Security (Optional)
# PII_ENCRYPTION_KEY=32-char-key-for-message-encryption
# TURNSTILE_SECRET_KEY=cloudflare-turnstile-key
```

After editing, restart:

```bash
docker compose -f docker-compose-v2.yml restart
```

---

## Administration

### Create Additional Admin Users

```bash
./scripts/create-admin-v2.sh
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
docker compose -f docker-compose-v2.yml up -d

# Stop all services
docker compose -f docker-compose-v2.yml down

# View logs (all services)
docker compose -f docker-compose-v2.yml logs -f

# View specific service logs
docker compose -f docker-compose-v2.yml logs -f api
docker compose -f docker-compose-v2.yml logs -f app
docker compose -f docker-compose-v2.yml logs -f db

# Restart a service
docker compose -f docker-compose-v2.yml restart api

# Rebuild and restart
docker compose -f docker-compose-v2.yml build --no-cache
docker compose -f docker-compose-v2.yml up -d

# Check service status
docker compose -f docker-compose-v2.yml ps
```

---

## Troubleshooting

### Check service health

```bash
# Check all services
docker compose -f docker-compose-v2.yml ps

# Check API health
curl http://localhost:3001/health

# Check database connection
docker exec gamehaven-db-v2 pg_isready -U postgres -d gamehaven
```

### View logs

```bash
# API logs
docker compose -f docker-compose-v2.yml logs -f api

# Database logs
docker compose -f docker-compose-v2.yml logs -f db

# Frontend logs
docker compose -f docker-compose-v2.yml logs -f app
```

### Database not initializing

The database schema should auto-initialize on first boot. If not:

```bash
# Check if migrations ran
docker exec gamehaven-db-v2 psql -U postgres -d gamehaven -c "\dt"

# Manually run migrations if needed
docker exec -i gamehaven-db-v2 psql -U postgres -d gamehaven < migrations-v2/01-schema.sql
```

### API connection refused

```bash
# Check if API is running
docker compose -f docker-compose-v2.yml ps api

# Check API logs for errors
docker compose -f docker-compose-v2.yml logs api --tail=50

# Restart API
docker compose -f docker-compose-v2.yml restart api
```

### Reset everything (nuclear option)

```bash
docker compose -f docker-compose-v2.yml down -v
./install.sh --v2
```

---

## Updating

```bash
cd ~/GameTavern
git fetch origin
git reset --hard origin/main
cd deploy/standalone
chmod +x install.sh scripts/*.sh
docker compose -f docker-compose-v2.yml build --no-cache
docker compose -f docker-compose-v2.yml up -d
```

---

## Uninstall

```bash
# Stop and remove containers + volumes
docker compose -f docker-compose-v2.yml down -v

# Remove Docker images
docker rmi standalone-gamehaven-app:latest standalone-gamehaven-api:latest

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

The v2 stack uses a simplified PostgreSQL schema with bcrypt authentication:

| Table | Description |
|-------|-------------|
| `users` | User accounts with bcrypt passwords |
| `games` | Game catalog |
| `publishers` | Game publishers |
| `mechanics` | Game mechanics |
| `game_mechanics` | Game-to-mechanic mappings |
| `game_sessions` | Play history |
| `game_session_players` | Players in sessions |
| `game_wishlist` | User wishlists |
| `game_messages` | Contact messages (encrypted) |
| `game_ratings` | User ratings |
| `site_settings` | Configuration |
| `user_roles` | Admin permissions |

---

## API Endpoints

The v2 Express API provides these routes:

| Endpoint | Description |
|----------|-------------|
| `POST /auth/login` | User login |
| `POST /auth/register` | User registration |
| `GET /games` | List games |
| `POST /games` | Create game (admin) |
| `GET /games/:id` | Get game details |
| `GET /bgg/search` | Search BoardGameGeek |
| `POST /bgg/import` | Import from BGG |
| `POST /ratings` | Submit rating |
| `GET /wishlist` | Get wishlist |
| `POST /messages` | Send message |
| `GET /health` | Health check |

---

## Migrating from v1

If you're migrating from v1 (Supabase stack):

1. **Export your data** from v1:
   ```bash
   ./scripts/backup.sh
   ```

2. **Stop v1**:
   ```bash
   docker compose down
   ```

3. **Install v2**:
   ```bash
   ./install.sh --v2
   ```

4. **Import data** (schema is compatible, but users need re-creation):
   ```bash
   # Games, settings, etc. can be restored
   # Users must be recreated due to different auth (bcrypt vs GoTrue)
   ```

> **Note:** User passwords cannot be migrated from v1 to v2 due to different hashing algorithms. Users will need to create new accounts.
