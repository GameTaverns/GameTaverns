# Game Haven Self-Hosted Deployment

Deploy your own Game Haven instance with Docker on any Linux server.

## Quick Start

```bash
# Clone the repository
git clone https://github.com/your-org/game-haven.git
cd game-haven

# Run the deployment script
./deploy/deploy.sh setup
```

The script will:
1. Check for Docker and required tools
2. Prompt for configuration (site name, domain, SMTP, etc.)
3. Generate secure credentials automatically
4. Initialize the database with all migrations
5. Start all services

## Access Points

After deployment:

| Service | URL | Description |
|---------|-----|-------------|
| Frontend | http://localhost | Main application |
| API | http://localhost:8000 | Supabase REST/Auth API |
| Studio | http://localhost:3000 | Admin database UI |

## Commands

```bash
./deploy/deploy.sh setup      # Full setup (first time)
./deploy/deploy.sh configure  # Update configuration
./deploy/deploy.sh start      # Start services
./deploy/deploy.sh stop       # Stop services
./deploy/deploy.sh restart    # Restart services
./deploy/deploy.sh logs       # View logs
./deploy/deploy.sh status     # Check service status
```

## Configuration

Edit `deploy/.env` to customize:

### Required Settings
- `POSTGRES_PASSWORD` - Database password (auto-generated)
- `JWT_SECRET` - JWT signing key (auto-generated)
- `PII_ENCRYPTION_KEY` - Encryption key for personal data (auto-generated)

### Site Branding
- `VITE_SITE_NAME` - Your site name
- `VITE_SITE_DESCRIPTION` - Site description
- `VITE_SITE_AUTHOR` - Author/owner name

### Domain & URLs
- `SITE_URL` - Your public URL (e.g., https://games.example.com)
- `API_EXTERNAL_URL` - API URL (e.g., https://games.example.com:8000)

### Email (SMTP)
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`

### Optional Features
- `TURNSTILE_SECRET_KEY` - Cloudflare Turnstile for anti-spam
- `FIRECRAWL_API_KEY` - For BoardGameGeek import feature
- `LOVABLE_API_KEY` - For AI-enhanced data extraction

## First Admin User

1. Sign up through the frontend at http://localhost
2. Connect to the database: `docker exec -it supabase-db psql -U postgres`
3. Grant admin role:

```sql
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin' FROM auth.users WHERE email = 'your@email.com';
```

## SSL/HTTPS Setup

### Option 1: Nginx Reverse Proxy (Recommended)

Install Nginx and Certbot on your host:

```bash
sudo apt install nginx certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d games.example.com
```

Example Nginx config (`/etc/nginx/sites-available/gamehaven`):

```nginx
server {
    listen 80;
    server_name games.example.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name games.example.com;

    ssl_certificate /etc/letsencrypt/live/games.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/games.example.com/privkey.pem;

    location / {
        proxy_pass http://localhost:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /api/ {
        proxy_pass http://localhost:8000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Option 2: Traefik

Add Traefik labels to docker-compose.yml for automatic SSL.

## Backups

### Database Backup

```bash
docker exec supabase-db pg_dump -U postgres -d postgres > backup-$(date +%Y%m%d).sql
```

### Restore

```bash
cat backup-20240101.sql | docker exec -i supabase-db psql -U postgres -d postgres
```

## Updating

```bash
cd game-haven
git pull origin main
./deploy/deploy.sh restart
```

## Troubleshooting

### View Logs
```bash
./deploy/deploy.sh logs           # All services
./deploy/deploy.sh logs frontend  # Specific service
./deploy/deploy.sh logs db        # Database logs
```

### Database Connection Issues
```bash
docker exec -it supabase-db psql -U postgres -c "SELECT 1"
```

### Reset Everything
```bash
./deploy/deploy.sh stop
rm -rf deploy/volumes/db/data/*
./deploy/deploy.sh setup
```

## Resource Requirements

| Level | RAM | CPU | Disk |
|-------|-----|-----|------|
| Minimum | 2GB | 1 core | 10GB |
| Recommended | 4GB | 2 cores | 20GB |
| Production | 8GB+ | 4 cores | 50GB+ |

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Your Server                          │
├─────────────────────────────────────────────────────────┤
│  ┌─────────┐                                            │
│  │ Nginx   │ :80/:443 (optional SSL termination)       │
│  └────┬────┘                                            │
│       │                                                 │
│  ┌────▼────┐     ┌──────────────────────────────────┐  │
│  │Frontend │:80  │         Kong API Gateway :8000   │  │
│  │ (React) │     │  ┌─────┐ ┌─────┐ ┌───────────┐   │  │
│  └─────────┘     │  │Auth │ │REST │ │ Functions │   │  │
│                  │  └──┬──┘ └──┬──┘ └─────┬─────┘   │  │
│                  └─────┼───────┼──────────┼─────────┘  │
│                        │       │          │            │
│                  ┌─────▼───────▼──────────▼─────┐      │
│                  │     PostgreSQL Database      │      │
│                  │          :5432               │      │
│                  └──────────────────────────────┘      │
│                                                         │
│  ┌─────────────┐                                       │
│  │ Studio :3000│ (Admin UI)                            │
│  └─────────────┘                                       │
└─────────────────────────────────────────────────────────┘
```

## License

MIT License - See LICENSE file for details.
