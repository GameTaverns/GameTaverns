# Game Haven Self-Hosted Deployment Guide

This guide walks you through deploying Game Haven on your own Linux server with a fully self-hosted Supabase backend.

## Prerequisites

- **Linux server** (Ubuntu 20.04+ recommended)
- **Docker** 20.10+ and **Docker Compose** v2+
- **4GB+ RAM** (8GB recommended)
- **20GB+ disk space**
- **Domain name** (optional, but recommended for production)

## Quick Start

```bash
# Clone the repository
git clone https://github.com/your-username/game-haven.git
cd game-haven

# Make deploy script executable
chmod +x deploy/deploy.sh

# Run full setup
./deploy/deploy.sh setup
```

The script will:
1. Check requirements
2. Generate secure credentials
3. Prompt for site configuration
4. Initialize the database with all migrations
5. Start the Docker stack

## Manual Setup

If you prefer manual configuration:

### 1. Create Environment File

```bash
cp deploy/.env.example deploy/.env
```

Edit `deploy/.env` with your values:

```env
# Required - generate with: openssl rand -hex 32
POSTGRES_PASSWORD=<generate-secure-password>
PII_ENCRYPTION_KEY=<generate-32-byte-hex-key>

# Required - generate with: openssl rand -base64 64
JWT_SECRET=<generate-jwt-secret>

# Your domain
SITE_URL=https://games.yourdomain.com
API_EXTERNAL_URL=https://api.yourdomain.com

# Site branding
VITE_SITE_NAME="Your Game Library"
VITE_SITE_DESCRIPTION="Your description here"
```

### 2. Generate Supabase Keys

The JWT tokens for Supabase need to be signed with your JWT_SECRET. For development, placeholder keys work. For production, use the [Supabase Key Generator](https://supabase.com/docs/guides/self-hosting#api-keys).

### 3. Start Services

```bash
cd deploy
docker compose up -d
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Your Server                          │
│                                                             │
│  ┌─────────────┐     ┌──────────────────────────────────┐  │
│  │   nginx     │────▶│         Kong API Gateway         │  │
│  │  (Frontend) │     │                                  │  │
│  │   :80/:443  │     │  :8000 (HTTP) / :8443 (HTTPS)   │  │
│  └─────────────┘     └──────────────────────────────────┘  │
│                                    │                        │
│        ┌───────────────────────────┼───────────────────┐   │
│        │                           │                   │   │
│        ▼                           ▼                   ▼   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │   Auth   │  │   REST   │  │ Realtime │  │ Storage  │  │
│  │ (GoTrue) │  │(PostgRE- │  │          │  │          │  │
│  │  :9999   │  │   ST)    │  │  :4000   │  │  :5000   │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  │
│       │             │             │             │         │
│       └─────────────┴─────────────┴─────────────┘         │
│                           │                                │
│                           ▼                                │
│                    ┌──────────────┐                        │
│                    │  PostgreSQL  │                        │
│                    │    :5432     │                        │
│                    └──────────────┘                        │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐                        │
│  │    Studio    │  │  Functions   │                        │
│  │ (Admin UI)   │  │ (Edge Deno)  │                        │
│  │    :3000     │  │    :8081     │                        │
│  └──────────────┘  └──────────────┘                        │
└─────────────────────────────────────────────────────────────┘
```

## Services & Ports

| Service | Port | Description |
|---------|------|-------------|
| Frontend | 80/443 | Game Haven web app |
| Kong | 8000/8443 | Supabase API Gateway |
| Studio | 3000 | Supabase Admin UI |
| PostgreSQL | 5432 | Database (internal) |

## Post-Installation

### 1. Create Admin User

1. Visit your site and create an account via signup
2. Access Supabase Studio at `http://localhost:3000`
3. Navigate to Table Editor → `user_roles`
4. Insert a row with your `user_id` and `role` = `admin`

Or via SQL:
```sql
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin' FROM auth.users WHERE email = 'your@email.com';
```

### 2. Configure Site Settings

In Studio, update the `site_settings` table:

| Key | Value |
|-----|-------|
| `contact_email` | Your contact email |
| `show_for_sale` | `true` or `false` |

### 3. Set Up Turnstile (Anti-Spam)

1. Go to [Cloudflare Turnstile](https://dash.cloudflare.com/turnstile)
2. Create a new site widget
3. Add your domain
4. Copy the secret key to your `.env`

## SSL/HTTPS Setup

For production, add SSL with Let's Encrypt:

### Option 1: Nginx Reverse Proxy (Recommended)

Install Certbot on your server:

```bash
apt install certbot python3-certbot-nginx
certbot --nginx -d games.yourdomain.com
```

### Option 2: Traefik

Add Traefik to your docker-compose.yml for automatic SSL:

```yaml
services:
  traefik:
    image: traefik:v2.10
    command:
      - "--providers.docker=true"
      - "--entrypoints.websecure.address=:443"
      - "--certificatesresolvers.letsencrypt.acme.tlschallenge=true"
      - "--certificatesresolvers.letsencrypt.acme.email=you@email.com"
    ports:
      - "443:443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
```

## Backups

### Database Backup

```bash
# Create backup
docker exec supabase-db pg_dump -U postgres postgres > backup.sql

# Restore
docker exec -i supabase-db psql -U postgres postgres < backup.sql
```

### Automated Backups

Add to crontab:
```bash
0 2 * * * docker exec supabase-db pg_dump -U postgres postgres | gzip > /backups/gamehaven-$(date +\%Y\%m\%d).sql.gz
```

## Updating

```bash
# Pull latest code
git pull

# Rebuild and restart
cd deploy
docker compose build frontend
docker compose up -d

# Apply new migrations (if any)
docker exec -i supabase-db psql -U postgres postgres < ../supabase/migrations/new_migration.sql
```

## Troubleshooting

### View Logs

```bash
# All services
./deploy/deploy.sh logs

# Specific service
./deploy/deploy.sh logs frontend
./deploy/deploy.sh logs db
./deploy/deploy.sh logs auth
```

### Common Issues

**1. Database won't start**
```bash
# Check disk space
df -h

# Check logs
docker logs supabase-db
```

**2. Auth not working**
- Verify `JWT_SECRET` matches across all services
- Check `SITE_URL` is correctly set
- Ensure email auto-confirm is enabled

**3. Edge functions failing**
```bash
# Check function logs
docker logs supabase-functions

# Verify secrets are set
docker exec supabase-functions env | grep -E "(SUPABASE|PII)"
```

**4. Frontend build issues**
```bash
# Rebuild from scratch
docker compose build --no-cache frontend
```

## Resource Requirements

| Setup | RAM | CPU | Disk |
|-------|-----|-----|------|
| Minimum | 4GB | 2 cores | 20GB |
| Recommended | 8GB | 4 cores | 50GB |
| Production | 16GB | 4+ cores | 100GB+ |

## Security Checklist

- [ ] Change all default passwords
- [ ] Use HTTPS in production
- [ ] Configure firewall (only expose 80/443)
- [ ] Keep PostgreSQL port internal only
- [ ] Set up automated backups
- [ ] Monitor disk usage
- [ ] Enable fail2ban for SSH
- [ ] Review RLS policies

## Support

- **Issues**: Open a GitHub issue
- **Documentation**: See CONFIGURATION.md for customization options
- **Supabase Docs**: https://supabase.com/docs/guides/self-hosting
