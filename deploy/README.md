# 🎲 Game Haven Deployment Guide

Deploy Game Haven to your own server with our streamlined deployment system.

## Quick Start

```bash
git clone https://github.com/your-org/game-haven.git
cd game-haven
./deploy/deploy.sh
```

The interactive wizard will guide you through configuration.

---

## Deployment Options

### Option 1: Docker (Recommended)

Full control with Docker Compose. Supports both self-hosted and external Supabase.

```bash
./deploy/deploy.sh setup
```

**Requirements:**
- Docker 20.10+
- Docker Compose 2.0+
- 2GB RAM (4GB+ for self-hosted Supabase)

### Option 2: Cloudron (One-Click)

Deploy to Cloudron for managed hosting with automatic updates and backups.

```bash
cd deploy/cloudron
cloudron build
cloudron install
```

See [Cloudron Deployment](#cloudron-deployment) for details.

### Option 3: Static Hosting

Deploy the frontend to any static host (Vercel, Netlify, Cloudflare Pages).
Requires an external Supabase instance.

```bash
npm run build
# Upload dist/ folder to your hosting provider
```

---

## Interactive Wizard Features

The `deploy.sh` wizard provides:

### 🔧 Backend Selection
- **Self-hosted Supabase**: Complete stack in Docker
- **External Supabase**: Connect to Supabase Cloud or existing instance

### 🎛️ Feature Configuration
Toggle features on/off during setup:
- Play Logging
- Wishlist
- For Sale listings
- Messaging
- Coming Soon section
- Demo Mode

### 🔐 Automatic Security
- Generates secure passwords and JWT secrets
- Creates PII encryption keys
- Sets proper file permissions

### 📧 Optional Integrations
- SMTP email configuration
- Cloudflare Turnstile anti-spam
- Firecrawl API for imports

---

## Commands Reference

| Command | Description |
|---------|-------------|
| `./deploy.sh setup` | Interactive setup wizard |
| `./deploy.sh start` | Start services |
| `./deploy.sh stop` | Stop services |
| `./deploy.sh restart` | Restart services |
| `./deploy.sh logs [service]` | View logs |
| `./deploy.sh health` | Check service health |
| `./deploy.sh status` | Show container status |
| `./deploy.sh configure` | Re-run configuration |

---

## Configuration

All configuration is stored in `deploy/.env`. Key settings:

### Site Branding
```env
VITE_SITE_NAME="My Game Collection"
VITE_SITE_DESCRIPTION="Browse my board game library"
VITE_SITE_AUTHOR="Your Name"
```

### Feature Flags
```env
VITE_FEATURE_PLAY_LOGS=true
VITE_FEATURE_WISHLIST=true
VITE_FEATURE_FOR_SALE=true
VITE_FEATURE_MESSAGING=true
VITE_FEATURE_COMING_SOON=true
VITE_FEATURE_DEMO_MODE=false
```

### External Supabase
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

---

## Cloudron Deployment

### Prerequisites
- Cloudron server (v7.0.0+)
- Supabase account (Cloud or self-hosted separately)

### Installation

1. **Build the Cloudron package:**
   ```bash
   cd deploy/cloudron
   cloudron build
   ```

2. **Install to your Cloudron:**
   ```bash
   cloudron install --image your-registry/gamehaven:latest
   ```

3. **Configure environment variables** in Cloudron dashboard:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SITE_NAME`
   - Feature flags as needed

### Cloudron Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | Yes | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | Yes | Supabase anonymous/public key |
| `SITE_NAME` | No | Custom site name |
| `FEATURE_*` | No | Feature toggles (true/false) |

---

## Health Checks

Game Haven includes built-in health monitoring:

### Frontend Health
```bash
curl http://localhost/health
# {"status":"healthy","service":"gamehaven","timestamp":"2024-01-15T10:30:00Z"}
```

### All Services (self-hosted)
```bash
./deploy.sh health
```

### Docker Health Status
```bash
docker ps --format "table {{.Names}}\t{{.Status}}"
```

---

## SSL/HTTPS Setup

### With Nginx Reverse Proxy (Recommended)

1. Install Nginx and Certbot:
   ```bash
   sudo apt install nginx certbot python3-certbot-nginx
   ```

2. Create Nginx config (`/etc/nginx/sites-available/gamehaven`):
   ```nginx
   server {
       listen 80;
       server_name games.yourdomain.com;
       return 301 https://$server_name$request_uri;
   }

   server {
       listen 443 ssl http2;
       server_name games.yourdomain.com;

       ssl_certificate /etc/letsencrypt/live/games.yourdomain.com/fullchain.pem;
       ssl_certificate_key /etc/letsencrypt/live/games.yourdomain.com/privkey.pem;

       # Frontend
       location / {
           proxy_pass http://127.0.0.1:80;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }

       # API (self-hosted only)
       location /api/ {
           proxy_pass http://127.0.0.1:8000/;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection "upgrade";
           proxy_set_header Host $host;
       }
   }
   ```

3. Enable and get certificate:
   ```bash
   sudo ln -s /etc/nginx/sites-available/gamehaven /etc/nginx/sites-enabled/
   sudo certbot --nginx -d games.yourdomain.com
   ```

---

## Backups

### Database Backup (self-hosted)
```bash
docker exec supabase-db pg_dump -U postgres -d postgres > backup-$(date +%Y%m%d).sql
```

### Automated Daily Backups
Add to crontab (`crontab -e`):
```bash
0 3 * * * cd /path/to/game-haven && docker exec supabase-db pg_dump -U postgres > /backups/gamehaven-$(date +\%Y\%m\%d).sql
```

### Restore
```bash
cat backup.sql | docker exec -i supabase-db psql -U postgres
```

---

## Troubleshooting

### Services won't start
```bash
./deploy.sh logs        # View all logs
./deploy.sh logs db     # Database specific
docker compose ps       # Check container status
```

### Database connection issues
```bash
docker exec -it supabase-db psql -U postgres -c "SELECT 1"
```

### Reset everything
```bash
./deploy.sh stop
rm -rf deploy/volumes/db/data/*
./deploy.sh setup
```

### Health check failing
```bash
curl -v http://localhost/health
./deploy.sh logs frontend
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Your Server                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────┐        ┌─────────────────────────────┐ │
│  │   Frontend      │        │   Supabase (self-hosted)    │ │
│  │   (React/Nginx) │        │   ┌─────┐ ┌──────┐ ┌─────┐ │ │
│  │   :80           │───────▶│   │Auth │ │ REST │ │ Fn  │ │ │
│  └─────────────────┘        │   └──┬──┘ └──┬───┘ └──┬──┘ │ │
│                              │      │       │        │     │ │
│                              │   ┌──▼───────▼────────▼──┐ │ │
│                              │   │     PostgreSQL       │ │ │
│                              │   │     :5432            │ │ │
│                              │   └──────────────────────┘ │ │
│                              └─────────────────────────────┘ │
│                                                              │
│              OR with External Supabase:                      │
│                                                              │
│  ┌─────────────────┐        ┌─────────────────────────────┐ │
│  │   Frontend      │        │   Supabase Cloud            │ │
│  │   (React/Nginx) │───────▶│   (your-project.supabase.co)│ │
│  │   :80           │        └─────────────────────────────┘ │
│  └─────────────────┘                                        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Resource Requirements

| Configuration | RAM | CPU | Disk |
|--------------|-----|-----|------|
| External Supabase | 512MB | 1 core | 5GB |
| Self-hosted (minimal) | 2GB | 1 core | 10GB |
| Self-hosted (recommended) | 4GB | 2 cores | 20GB |
| Production | 8GB+ | 4 cores | 50GB+ |

---

## File Structure

```
deploy/
├── deploy.sh                    # Main deployment script
├── docker-compose.yml           # Self-hosted Supabase stack
├── docker-compose.external.yml  # External Supabase (frontend only)
├── Dockerfile                   # Frontend container
├── nginx.conf                   # Nginx configuration
├── .env.example                 # Configuration template
├── cloudron/                    # Cloudron deployment files
│   ├── CloudronManifest.json
│   ├── Dockerfile
│   ├── nginx.conf
│   └── start.sh
└── volumes/                     # Persistent data (gitignored)
    ├── db/
    ├── storage/
    └── kong/
```

---

## Getting Help

- [GitHub Issues](https://github.com/your-org/game-haven/issues)
- [Documentation](https://docs.gamehaven.dev)

## License

MIT License - See LICENSE for details.
