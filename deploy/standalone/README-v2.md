# Game Haven v2 - Simplified Self-Hosted Stack

The v2 stack uses Node.js/Express instead of Supabase microservices for a simpler, more portable deployment.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Your Server                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │  Frontend   │  │  Express    │  │   PostgreSQL    │  │
│  │   (Nginx)   │──│    API      │──│   (Standard)    │  │
│  │   :3000     │  │   :3001     │  │     :5432       │  │
│  └─────────────┘  └─────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

**Only 3 containers** - simple to manage and debug.

---

## Quick Start

```bash
# One-liner install
curl -fsSL https://get.docker.com | sh && \
git clone https://github.com/ThaneWinters/GameTavern.git && \
cd GameTavern/deploy/standalone && \
chmod +x install.sh scripts/*.sh && \
./install.sh --v2
```

The installer will:
1. Prompt for site settings and admin credentials
2. Generate secure secrets
3. Start all Docker services
4. Run database migrations
5. Create your admin user

**Done!** Access your site at `http://your-server-ip:3000`

---

## Manual Installation

```bash
# 1. Clone repository
git clone https://github.com/ThaneWinters/GameTavern.git
cd GameTavern/deploy/standalone

# 2. Configure environment
cp .env.example .env
nano .env  # Edit settings

# 3. Start services
docker compose -f docker-compose-v2.yml up -d

# 4. Create admin user
./scripts/create-admin-v2.sh
```

---

## Configuration

### Required Settings

```bash
# .env
DATABASE_URL=postgresql://postgres:yourpassword@db:5432/gamehaven
JWT_SECRET=your-secret-at-least-32-characters
SITE_URL=https://yourdomain.com
SITE_NAME=Game Haven
```

### Optional Settings

```bash
# AI (Bring Your Own Key)
AI_PROVIDER=openai          # or 'gemini'
AI_API_KEY=sk-...

# Email
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=user
SMTP_PASS=pass
SMTP_FROM=noreply@example.com

# Features (all enabled by default)
FEATURE_PLAY_LOGS=true
FEATURE_WISHLIST=true
FEATURE_FOR_SALE=true
FEATURE_MESSAGING=true
FEATURE_RATINGS=true
```

---

## Commands

```bash
# Start services
docker compose -f docker-compose-v2.yml up -d

# Stop services
docker compose -f docker-compose-v2.yml down

# View logs
docker compose -f docker-compose-v2.yml logs -f

# View API logs only
docker compose -f docker-compose-v2.yml logs -f api

# Restart API after changes
docker compose -f docker-compose-v2.yml restart api

# Rebuild containers
docker compose -f docker-compose-v2.yml build --no-cache
docker compose -f docker-compose-v2.yml up -d
```

---

## Administration

### Create Admin User

```bash
# Interactive
./scripts/create-admin-v2.sh

# Non-interactive
ADMIN_EMAIL="admin@example.com" ADMIN_PASSWORD="secure123" ./scripts/create-admin-v2.sh
```

### Backup Database

```bash
./scripts/backup.sh
```

### Restore Database

```bash
./scripts/restore.sh ./backups/gamehaven_20240101_120000.sql.gz
```

---

## Production Setup

### SSL with Nginx

```bash
./scripts/setup-nginx.sh
```

Or manually configure Nginx:

```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;
    
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    
    # Frontend
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    # API
    location /api/ {
        proxy_pass http://127.0.0.1:3001/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

---

## AI Features (BYOK)

v2 supports "Bring Your Own Key" AI integration:

```bash
# OpenAI
AI_PROVIDER=openai
AI_API_KEY=sk-your-openai-key

# Google Gemini
AI_PROVIDER=gemini
AI_API_KEY=your-gemini-key
```

Used for:
- Description condensing/summarization
- (Future) Smart game recommendations

---

## Troubleshooting

### API not responding

```bash
# Check container status
docker compose -f docker-compose-v2.yml ps

# Check logs
docker compose -f docker-compose-v2.yml logs api

# Test health endpoint
curl http://localhost:3001/health
```

### Database connection failed

```bash
# Check database logs
docker compose -f docker-compose-v2.yml logs db

# Test connection
docker exec gamehaven-db-v2 psql -U postgres -d gamehaven -c "SELECT 1;"
```

### Frontend not loading

```bash
# Check frontend logs
docker compose -f docker-compose-v2.yml logs app

# Verify it's running
curl http://localhost:3000
```

### Reset everything

```bash
docker compose -f docker-compose-v2.yml down -v
./install.sh --v2
```

---

## Uninstall

```bash
# Stop and remove containers + data
docker compose -f docker-compose-v2.yml down -v

# Remove images
docker rmi standalone-gamehaven:latest standalone-api:latest

# Remove project files
cd ~ && rm -rf ~/GameTavern

# Remove Nginx config (if configured)
sudo rm -f /etc/nginx/sites-enabled/gamehaven
sudo systemctl reload nginx
```

---

## API Endpoints

The Express API provides these endpoints:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/auth/register` | POST | Create account |
| `/api/auth/login` | POST | Login |
| `/api/auth/me` | GET | Current user |
| `/api/games` | GET/POST | List/create games |
| `/api/games/:id` | GET/PUT/DELETE | Game CRUD |
| `/api/bgg/search` | GET | Search BGG |
| `/api/bgg/import` | POST | Import from BGG |
| `/api/ratings` | POST | Rate a game |
| `/api/wishlist` | GET/POST/DELETE | Wishlist management |
| `/api/messages` | GET/POST | Contact messages |
| `/api/admin/*` | Various | Admin operations |

---

## Migration from v1

1. **Backup v1 database:**
   ```bash
   ./scripts/backup.sh
   ```

2. **Stop v1:**
   ```bash
   docker compose down
   ```

3. **Start v2:**
   ```bash
   docker compose -f docker-compose-v2.yml up -d
   ```

4. **Restore data:**
   ```bash
   ./scripts/restore.sh ./backups/latest.sql.gz
   ```

5. **Create new admin** (auth system changed):
   ```bash
   ./scripts/create-admin-v2.sh
   ```

> ⚠️ User passwords from v1 are not compatible. Users must reset passwords.
