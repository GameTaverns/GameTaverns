# GameTaverns Multi-Tenant Self-Hosted Deployment

Complete guide for deploying GameTaverns as a self-hosted multi-tenant SaaS platform.

## 📋 Table of Contents

1. [Overview](#overview)
2. [Requirements](#requirements)
3. [Quick Start](#quick-start)
4. [Detailed Setup](#detailed-setup)
5. [GitHub CI/CD](#github-cicd)
6. [SSL Configuration](#ssl-configuration)
7. [DNS Setup](#dns-setup)
8. [Administration](#administration)
9. [Maintenance](#maintenance)
10. [Troubleshooting](#troubleshooting)

---

## Overview

This deployment creates a complete multi-tenant board game library platform where:

- Users sign up and create their own libraries
- Each library gets a subdomain (e.g., `mylib.gametaverns.com`)
- All data is isolated per-library
- Single database with row-level isolation
- Platform admins can manage all libraries

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Internet                                  │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Nginx Reverse Proxy                            │
│         (SSL termination, subdomain routing)                     │
│                  gametaverns.com:443                             │
│              *.gametaverns.com:443                               │
└─────────────────────────┬───────────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│  Frontend   │   │  Express    │   │  PostgreSQL │
│   (Nginx)   │──▶│    API      │──▶│  Database   │
│   :80       │   │   :3001     │   │   :5432     │
└─────────────┘   └─────────────┘   └─────────────┘
```

---

## Requirements

### Server Requirements

| Tenants | RAM | CPU | Storage |
|---------|-----|-----|---------|
| 1-10 | 4GB | 2 cores | 40GB |
| 10-50 | 8GB | 4 cores | 80GB |
| 50-200 | 16GB | 4+ cores | 160GB |

### Software Requirements

- Ubuntu 22.04+ or Debian 12+
- Docker 24.0+
- Docker Compose 2.0+
- Domain with DNS access

---

## Quick Start

### 1. Prepare Your Server

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Re-login to apply group changes
exit
# SSH back in

# Install Docker Compose plugin
sudo apt install docker-compose-plugin -y

# Verify installation
docker --version
docker compose version
```

### 2. Clone and Setup

```bash
# Clone repository
git clone https://github.com/YOUR_USERNAME/GameTavern.git /opt/gametaverns
cd /opt/gametaverns/deploy/multitenant

# Make scripts executable
chmod +x install.sh scripts/*.sh

# Run interactive installer
./install.sh
```

### 3. Start Services

```bash
# Start the stack
docker compose up -d

# Watch logs
docker compose logs -f

# Check health
docker compose ps
```

### 4. Create Admin

```bash
./scripts/create-admin.sh
```

### 5. Configure SSL

```bash
# For Let's Encrypt
./scripts/setup-ssl.sh

# OR for Cloudflare (recommended for wildcards)
./scripts/setup-ssl-cloudflare.sh
```

---

## Detailed Setup

### Directory Structure

```
/opt/gametaverns/
├── deploy/multitenant/
│   ├── docker-compose.yml      # Main compose file
│   ├── .env                    # Configuration (generated)
│   ├── install.sh              # Interactive installer
│   ├── migrations/
│   │   └── 01-core-schema.sql  # Database schema
│   ├── nginx/
│   │   ├── app.conf            # Frontend config
│   │   ├── proxy.conf          # Reverse proxy config
│   │   └── ssl/                # SSL certificates
│   ├── scripts/
│   │   ├── create-admin.sh     # Create admin user
│   │   ├── setup-ssl.sh        # Let's Encrypt setup
│   │   ├── setup-ssl-cloudflare.sh
│   │   ├── backup.sh           # Database backup
│   │   └── restore.sh          # Database restore
│   └── backups/                # Backup storage
└── server/                     # API source code
```

### Configuration Options

The `.env` file contains all configuration. Key settings:

```bash
# Domain and branding
DOMAIN=gametaverns.com
SITE_NAME=GameTaverns

# Database
POSTGRES_PASSWORD=<generated>

# Security
JWT_SECRET=<generated>
PII_ENCRYPTION_KEY=<generated>

# Email (optional but recommended)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=noreply@gametaverns.com

# Discord integration (optional)
DISCORD_BOT_TOKEN=
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=

# Platform admins (comma-separated emails)
PLATFORM_ADMINS=admin@example.com
```

---

## GitHub CI/CD

### Setup Requirements

1. **GitHub Secrets** - Add these to your repository:

   | Secret | Description |
   |--------|-------------|
   | `DEPLOY_HOST` | Server IP or hostname |
   | `DEPLOY_USER` | SSH username |
   | `DEPLOY_KEY` | SSH private key |

2. **Server SSH Key**:
   ```bash
   # On your local machine
   ssh-keygen -t ed25519 -C "github-deploy"
   
   # Copy public key to server
   ssh-copy-id -i ~/.ssh/id_ed25519.pub user@your-server
   
   # Add private key to GitHub secrets as DEPLOY_KEY
   ```

### Deployment Flow

```
Push to main → Build Docker Images → Push to GHCR → SSH to Server → Pull & Restart
```

### Manual Deployment

To deploy manually from GitHub:
1. Go to Actions tab
2. Select "Deploy to Production"
3. Click "Run workflow"

### Updating from Lovable

1. Make changes in Lovable
2. Commit syncs to GitHub
3. Push to `main` branch triggers deploy
4. New version is live in ~5 minutes

---

## SSL Configuration

### Option 1: Let's Encrypt (Standard)

Best for single domain without wildcards:

```bash
./scripts/setup-ssl.sh
```

Requires:
- Port 80 open to internet
- DNS pointing to your server

### Option 2: Cloudflare (Recommended)

Best for wildcard subdomains:

1. Get API token from [Cloudflare Dashboard](https://dash.cloudflare.com/profile/api-tokens)
   - Permission: Zone → DNS → Edit
   
2. Run setup:
   ```bash
   ./scripts/setup-ssl-cloudflare.sh
   ```

### Certificate Renewal

Certificates auto-renew via certbot container. Check status:

```bash
docker compose logs certbot
```

---

## DNS Setup

### Required DNS Records

| Type | Name | Value | Notes |
|------|------|-------|-------|
| A | @ | `YOUR_SERVER_IP` | Root domain |
| A | * | `YOUR_SERVER_IP` | Wildcard for subdomains |
| A | www | `YOUR_SERVER_IP` | www redirect |

### Cloudflare Settings

If using Cloudflare:
1. Set SSL/TLS to "Full (strict)"
2. Enable "Always Use HTTPS"
3. **Disable** proxy (gray cloud) for wildcard if using local SSL

---

## Administration

### Platform Admin Dashboard

Access at `https://gametaverns.com/admin`

Features:
- View all libraries
- Suspend/unsuspend libraries
- View platform analytics
- Manage user feedback

### Creating Additional Admins

```bash
docker exec -it gametaverns-db psql -U postgres -d gametaverns << EOF
INSERT INTO user_roles (user_id, role)
SELECT id, 'admin' FROM users WHERE email = 'admin@example.com';
EOF
```

### Suspending a Library

Via admin dashboard or:

```bash
docker exec -it gametaverns-db psql -U postgres -d gametaverns << EOF
UPDATE libraries SET is_active = false WHERE slug = 'problem-library';
EOF
```

---

## Maintenance

### Daily Operations

```bash
# View logs
docker compose logs -f
docker compose logs api --tail=100

# Check health
docker compose ps
curl http://localhost:3001/health

# Restart a service
docker compose restart api
```

### Backups

```bash
# Manual backup
./scripts/backup.sh

# Scheduled backup (add to crontab)
0 2 * * * /opt/gametaverns/deploy/multitenant/scripts/backup.sh

# List backups
ls -la backups/

# Restore from backup
./scripts/restore.sh backups/gametaverns_20240115_020000.sql.gz
```

### Updates

```bash
# Pull latest code
cd /opt/gametaverns
git pull origin main

# Rebuild and restart
cd deploy/multitenant
docker compose build
docker compose up -d
```

### Database Operations

```bash
# Access database
docker exec -it gametaverns-db psql -U postgres -d gametaverns

# Run SQL file
docker exec -i gametaverns-db psql -U postgres -d gametaverns < script.sql

# View table sizes
docker exec -it gametaverns-db psql -U postgres -d gametaverns -c "
SELECT relname, pg_size_pretty(pg_total_relation_size(relid))
FROM pg_catalog.pg_statio_user_tables
ORDER BY pg_total_relation_size(relid) DESC LIMIT 10;"
```

---

## Troubleshooting

### Service Won't Start

```bash
# Check logs
docker compose logs api --tail=50

# Common issues:
# - Database not ready: wait and retry
# - Port conflict: check `netstat -tlnp`
# - Missing .env: run install.sh
```

### Database Connection Failed

```bash
# Check if database is running
docker compose ps db

# Test connection
docker exec -it gametaverns-db psql -U postgres -d gametaverns -c "SELECT 1"

# Restart database
docker compose restart db
```

### SSL Certificate Issues

```bash
# Check certificate status
docker compose run --rm certbot certificates

# Force renewal
docker compose run --rm certbot renew --force-renewal

# Check nginx config
docker compose exec proxy nginx -t
```

### Library Not Loading

1. Check DNS: `dig library.gametaverns.com`
2. Check nginx logs: `docker compose logs proxy`
3. Check if library exists: 
   ```sql
   SELECT * FROM libraries WHERE slug = 'library';
   ```

### Memory Issues

```bash
# Check memory usage
docker stats --no-stream

# Prune unused Docker resources
docker system prune -a

# Increase swap
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

---

## Security Checklist

- [ ] Strong passwords in `.env`
- [ ] SSL certificates configured
- [ ] Firewall allows only 80, 443, 22
- [ ] Regular backups enabled
- [ ] SSH key authentication only
- [ ] Fail2ban installed
- [ ] Updates automated

---

## Support

- **Documentation**: This README
- **Issues**: GitHub Issues
- **Email**: support@gametaverns.com

---

*Last updated: January 2025*
