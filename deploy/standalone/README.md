# GameTaverns - Standalone Self-Hosted Deployment

Complete self-hosted deployment for HestiaCP with MariaDB multi-tenant architecture.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Cloudflare                           │
│  DNS: *.gametaverns.com → Your Server IP                │
│  Turnstile: Bot protection                              │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│                 HestiaCP Server                         │
├─────────────────────────────────────────────────────────┤
│  Nginx (reverse proxy)                                  │
│  ├── gametaverns.com → React SPA (marketing)            │
│  └── *.gametaverns.com → React SPA (tenant library)     │
│       └── /api/* → Node.js :3001                        │
├─────────────────────────────────────────────────────────┤
│  Node.js API (PM2)                                      │
│  ├── Tenant middleware (subdomain → schema)             │
│  ├── Auth (JWT)                                         │
│  └── MariaDB connection                                 │
├─────────────────────────────────────────────────────────┤
│  MariaDB                                                │
│  ├── gametaverns_core (platform)                        │
│  ├── tenant_tzolak (your library)                       │
│  ├── tenant_johndoe (another user)                      │
│  └── tenant_... (more tenants)                          │
└─────────────────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites
- HestiaCP server with:
  - Nginx (web proxy template)
  - MariaDB 10.6+
  - Node.js 20+ (install via nvm)
  - PM2 for process management

### 1. Install Node.js & PM2

```bash
# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc

# Install Node.js 20
nvm install 20
nvm use 20
nvm alias default 20

# Install PM2 globally
npm install -g pm2
```

### 2. Create MariaDB Databases

```bash
# Login to MariaDB as root
mysql -u root -p

# Run the core schema
source /path/to/deploy/mariadb/00-core-schema.sql;

# Exit
exit;
```

### 3. Configure Environment

```bash
# Copy example env
cp deploy/standalone/.env.example .env

# Edit with your values
nano .env
```

### 4. Build & Deploy

```bash
# Install dependencies
npm install
cd server && npm install && cd ..

# Build frontend
npm run build

# Build server
cd server && npm run build && cd ..

# Start with PM2
pm2 start deploy/standalone/ecosystem.config.js
pm2 save
pm2 startup
```

### 5. Configure HestiaCP

#### Create Web Domain
1. Log into HestiaCP
2. Add domain: `gametaverns.com`
3. Enable SSL (Let's Encrypt)
4. Set Proxy Template: `custom` (see nginx.conf)

#### Add Wildcard DNS in Cloudflare
```
Type: A
Name: *
Value: YOUR_SERVER_IP
Proxied: Yes (orange cloud)

Type: A  
Name: @
Value: YOUR_SERVER_IP
Proxied: Yes
```

#### Wildcard SSL Certificate
```bash
# Install certbot with cloudflare plugin
apt install certbot python3-certbot-dns-cloudflare

# Create cloudflare credentials
mkdir -p ~/.secrets/certbot
cat > ~/.secrets/certbot/cloudflare.ini << EOF
dns_cloudflare_api_token = YOUR_CLOUDFLARE_API_TOKEN
EOF
chmod 600 ~/.secrets/certbot/cloudflare.ini

# Get wildcard cert
certbot certonly \
  --dns-cloudflare \
  --dns-cloudflare-credentials ~/.secrets/certbot/cloudflare.ini \
  -d gametaverns.com \
  -d "*.gametaverns.com" \
  --preferred-challenges dns-01
```

### 6. Create Custom Nginx Template

Save as `/usr/local/hestia/data/templates/web/nginx/gametaverns.tpl` and `.stpl` (see nginx.conf in this folder).

### 7. Test Tenant Creation

```bash
# Create your first tenant
./deploy/mariadb/03-create-tenant.sh tzolak your@email.com "Your Name"

# This creates:
# - User in gametaverns_core.users
# - Tenant in gametaverns_core.tenants  
# - Schema: tenant_tzolak with all game tables
```

### 8. Verify Deployment

```bash
# Check PM2 status
pm2 status

# Check logs
pm2 logs gametaverns-api

# Test API
curl https://gametaverns.com/api/health

# Test tenant resolution
curl https://tzolak.gametaverns.com/api/tenant
```

---

## File Structure

```
deploy/standalone/
├── README.md              # This file
├── .env.example           # Environment template
├── ecosystem.config.js    # PM2 configuration
├── nginx.conf             # Nginx template
└── migrations/
    └── 01-app-schema.sql  # Additional platform migrations

deploy/mariadb/
├── 00-core-schema.sql     # Platform tables (users, tenants)
├── 01-tenant-template.sql # Tenant schema template (games, etc.)
├── 02-migrate-from-postgres.sql # Migration guide
└── 03-create-tenant.sh    # Tenant creation script
```

---

## Database Structure

### Core Database (gametaverns_core)
| Table | Purpose |
|-------|---------|
| users | Platform user accounts |
| tenants | Library registrations |
| tenant_members | User-to-library associations |
| password_reset_tokens | Password recovery |
| subscription_plans | Pricing tiers |
| tenant_subscriptions | Active subscriptions |
| audit_log | Activity tracking |

### Tenant Database (tenant_{slug})
| Table | Purpose |
|-------|---------|
| games | Game collection |
| game_mechanics | Game-mechanic links |
| game_sessions | Play logs |
| game_session_players | Session participants |
| game_wishlist | Visitor votes |
| game_ratings | Star ratings |
| game_messages | Contact messages |
| settings | Library settings |
| feature_flags | Feature toggles |

---

## API Endpoints

### Platform Routes (gametaverns.com)
| Method | Path | Description |
|--------|------|-------------|
| POST | /api/platform/signup | Create account + library |
| POST | /api/platform/login | Authenticate |
| GET | /api/platform/check-slug/:slug | Check availability |
| GET | /api/platform/health | Health check |

### Tenant Routes (*.gametaverns.com)
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/tenant | Get library info & settings |
| GET | /api/tenant/stats | Library statistics |
| PUT | /api/tenant/settings | Update settings |
| PUT | /api/tenant/features/:flag | Toggle feature |
| GET | /api/games | List games |
| POST | /api/games | Create game |
| ... | ... | (all existing game routes) |

---

## Updating

```bash
# Pull latest code
git pull

# Rebuild frontend
npm run build

# Rebuild server
cd server && npm run build && cd ..

# Restart API
pm2 restart gametaverns-api
```

---

## Troubleshooting

### API not responding
```bash
pm2 logs gametaverns-api --lines 100
```

### Database connection issues
```bash
mysql -u gametaverns_app -p -e "SELECT 1"
```

### SSL certificate renewal
```bash
certbot renew --dry-run
```

### Tenant not found
```bash
mysql -u root -p -e "SELECT slug FROM gametaverns_core.tenants"
```

---

## Migration from Supabase

See `deploy/mariadb/02-migrate-from-postgres.sql` for detailed migration steps.
