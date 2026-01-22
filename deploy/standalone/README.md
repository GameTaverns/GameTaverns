# Game Haven - Standalone Self-Hosted Deployment

Complete self-hosted package including the Game Haven app and full Supabase stack.

## Quick Start (One Command)

On a fresh Ubuntu/Debian server:

```bash
curl -fsSL https://get.docker.com | sh && \
git clone https://github.com/ThaneWinters/GameTavern.git && \
cd GameTavern/deploy/standalone && \
chmod +x install.sh scripts/*.sh && \
./install.sh
```

The installer will:
1. Prompt for site configuration and admin credentials
2. Generate secure secrets
3. Start all Docker services
4. Configure database passwords
5. Run database migrations
6. Create your admin user
7. **(Optional)** Setup Nginx reverse proxy with Let's Encrypt SSL

**That's it!** Your Game Haven is ready at `http://your-server-ip:3000`

---

## Step-by-Step Installation

### 1. Prepare Your Server

```bash
# Connect to your server
ssh root@your-server-ip

# Update packages and install prerequisites (including nginx for SSL)
apt update && apt upgrade -y
apt install -y curl git wget unzip nginx certbot python3-certbot-nginx

# Install Docker
curl -fsSL https://get.docker.com | sh
systemctl start docker && systemctl enable docker

# (Optional) Create a non-root user
adduser gamehaven
usermod -aG docker gamehaven
usermod -aG sudo gamehaven
su - gamehaven
```

### 2. Download and Install

```bash
git clone https://github.com/ThaneWinters/GameTavern.git
cd GameTavern/deploy/standalone
chmod +x install.sh scripts/*.sh
./install.sh
```

### 3. Access Your Site

- **Application**: `http://your-server-ip:3000`
- **Admin Studio**: `http://your-server-ip:3001` (or via `https://yourdomain.com/studio/` with Nginx)

Log in with the admin email and password you provided during installation.

### Default Theme

Standalone deployments start with a **neutral white/grey theme** (not the warm parchment style from Lovable Cloud). Customize via the Settings > Site tab after logging in as admin.

---

## What's Included

| Service | Description | Default Port |
|---------|-------------|--------------|
| **Game Haven** | Frontend application | 3000 |
| **PostgreSQL** | Database | 5432 |
| **GoTrue** | Authentication service | - |
| **PostgREST** | REST API | - |
| **Kong** | API Gateway | 8000 |
| **Realtime** | WebSocket subscriptions | - |
| **Studio** | Database admin UI (optional) | 3001 |

## How the Database Gets Set Up

The standalone installer automatically handles all database setup:

1. **Supabase Postgres Image** - Uses `supabase/postgres:15.6.1.143` which includes the internal schemas (`auth`, `storage`, etc.)

2. **Role Password Initialization** (`migrations/00-init-users.sql`) - Sets up passwords for internal Supabase roles during container first boot

3. **Application Schema** (`migrations/01-app-schema.sql`) - Creates all Game Haven tables:
   - `publishers`, `mechanics` (lookup tables)
   - `games`, `game_mechanics`, `game_admin_data` (game data)
   - `game_sessions`, `game_session_players` (play logs)
   - `game_wishlist`, `game_messages` (user interactions)
   - `site_settings`, `user_roles` (configuration)
   - All RLS policies and security functions

4. **Admin User Creation** - Creates your admin account via GoTrue API and assigns the `admin` role

All of this happens automatically when you run `./install.sh`.

## Features

Toggle features on/off via environment variables:

| Feature | Variable | Default |
|---------|----------|---------|
| Play Logs | `FEATURE_PLAY_LOGS` | true |
| Wishlist | `FEATURE_WISHLIST` | true |
| For Sale | `FEATURE_FOR_SALE` | true |
| Messaging | `FEATURE_MESSAGING` | true |
| Coming Soon | `FEATURE_COMING_SOON` | true |
| Demo Mode | `FEATURE_DEMO_MODE` | false |

## Administration

### Create Additional Admin Users

```bash
./scripts/create-admin.sh
```

Or non-interactively:

```bash
ADMIN_EMAIL="user@example.com" ADMIN_PASSWORD="securepass" ./scripts/create-admin.sh
```

### Access Supabase Studio

Studio is enabled by default and accessible at:
- **Direct**: `http://your-server-ip:3001`
- **Via Nginx proxy**: `https://yourdomain.com/studio/` (after running `setup-nginx.sh`)

If Studio isn't accessible, check that the containers are running:

```bash
docker compose ps | grep -E "(studio|meta)"
```

If not listed, restart with:

```bash
docker compose up -d
```

### Backup Database

```bash
./scripts/backup.sh
```

Backups are saved to `./backups/` and compressed automatically.

### Restore Database

```bash
./scripts/restore.sh ./backups/gamehaven_20240101_120000.sql.gz
```

## Production Deployment

### Automatic SSL Setup (Recommended)

If you specified a domain during installation, you'll be prompted to set up Nginx with Let's Encrypt SSL automatically:

```bash
? Setup Nginx reverse proxy with SSL for yourdomain.com? [Y/n]: y
```

This will:
1. Install Nginx
2. Configure it as a reverse proxy to the app
3. Obtain a Let's Encrypt SSL certificate
4. Set up automatic certificate renewal

### Manual Nginx Setup

You can also run the nginx setup script separately:

```bash
./scripts/setup-nginx.sh
```

### Custom Nginx Config

server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;
    
    ssl_certificate /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;
    
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## Commands

```bash
# Start all services
docker compose up -d

# Stop all services
docker compose down

# View logs
docker compose logs -f

# View specific service logs
docker compose logs -f gamehaven

# Restart a service
docker compose restart gamehaven

# Update to latest version
git pull
docker compose build
docker compose up -d
```

## Troubleshooting

### Services not starting / "password authentication failed"

Run the admin creation script which auto-detects and fixes password sync issues:

```bash
./scripts/create-admin.sh
```

Or manually fix:

```bash
./scripts/fix-db-passwords.sh
```

### Auth service not responding

Check logs:

```bash
docker logs gamehaven-auth --tail=50
docker logs gamehaven-kong --tail=50
```

### Database issues

```bash
# Verify database is ready
docker exec gamehaven-db pg_isready

# Test actual connection (more reliable than pg_isready)
docker exec gamehaven-db psql -U supabase_admin -d postgres -c "SELECT 1;"

# Check database logs
docker compose logs db
```

### Database connection refused during install

If the installer fails with "connection to server on socket... failed: Connection refused", the database may not be fully initialized. Wait and retry:

```bash
sleep 15 && ./install.sh
```

### SSL / Certbot Issues

**Re-run SSL setup:**

```bash
./scripts/setup-nginx.sh
```

**Manually renew certificates:**

```bash
sudo certbot renew
```

**Force certificate renewal:**

```bash
sudo certbot renew --force-renewal
```

**Test certificate renewal (dry run):**

```bash
sudo certbot renew --dry-run
```

**Check certificate status:**

```bash
sudo certbot certificates
```

**Obtain a new certificate manually:**

```bash
sudo certbot --nginx -d yourdomain.com
```

### Nginx Issues

**Test configuration:**

```bash
sudo nginx -t
```

**Reload after config changes:**

```bash
sudo systemctl reload nginx
```

**View access/error logs:**

```bash
sudo tail -f /var/log/nginx/gamehaven.access.log
sudo tail -f /var/log/nginx/gamehaven.error.log
```

**Remove and reconfigure Nginx:**

```bash
sudo rm -f /etc/nginx/sites-enabled/gamehaven /etc/nginx/sites-available/gamehaven
sudo systemctl reload nginx
./scripts/setup-nginx.sh
```

### Studio Access Issues

If Studio is not accessible via HTTPS, access it through the Nginx proxy:

```
https://yourdomain.com/studio/
```

Or directly (HTTP only, not recommended for production):

```
http://your-server-ip:3001
```

### Update to Latest Version

```bash
cd ~/GameTavern
git fetch origin && git reset --hard origin/main
cd deploy/standalone
chmod +x install.sh scripts/*.sh
docker compose down
docker compose build --no-cache
docker compose up -d
```

### Complete Reset (Fresh Start)

```bash
# Stop and remove all containers and volumes (deletes all data!)
docker compose down -v

# Re-run installer
./install.sh
```

### Full Uninstall

```bash
# Stop containers and delete all data
cd ~/GameTavern/deploy/standalone
docker compose down -v

# Remove Docker image
docker rmi standalone-gamehaven:latest 2>/dev/null

# Remove project files
cd ~ && rm -rf ~/GameTavern

# Remove Nginx config
sudo rm -f /etc/nginx/sites-enabled/gamehaven /etc/nginx/sites-available/gamehaven
sudo systemctl reload nginx

# (Optional) Remove Docker build cache
docker builder prune -af
```

### Check Service Health

```bash
# All container statuses
docker compose ps

# Health of each service
docker inspect --format='{{.Name}}: {{.State.Health.Status}}' $(docker compose ps -q) 2>/dev/null

# API health check
curl -s http://localhost:8000/auth/v1/health | jq .

# App health check  
curl -s http://localhost:3000/health
```

## Requirements

- Docker 20.10+
- Docker Compose 2.0+
- 4GB RAM minimum (8GB recommended)
- 20GB disk space

## Security Notes

1. **Secure passwords** - The installer generates cryptographically secure passwords
2. **Use HTTPS in production** - Configure SSL via reverse proxy
3. **Backup regularly** - Use the provided backup script
4. **Keep credentials secure** - The `.credentials` file contains sensitive data (chmod 600)
