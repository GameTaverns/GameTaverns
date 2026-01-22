# Game Haven - Standalone Self-Hosted Deployment

Complete self-hosted package including the Game Haven app and full Supabase stack.

## Fresh Server Setup

Starting from a fresh Ubuntu/Debian server with only SSH access:

### 1. Connect to Your Server

```bash
ssh root@your-server-ip
```

### 2. Update System & Install Prerequisites

```bash
# Update packages
apt update && apt upgrade -y

# Install required tools
apt install -y curl git wget unzip
```

### 3. Install Docker

```bash
# Install Docker using the official script
curl -fsSL https://get.docker.com | sh

# Start Docker and enable on boot
systemctl start docker
systemctl enable docker

# Verify installation
docker --version
docker compose version
```

### 4. Create a Non-Root User (Recommended)

```bash
# Create user
adduser gamehaven
usermod -aG docker gamehaven
usermod -aG sudo gamehaven

# Switch to new user
su - gamehaven
```

### 5. Download Game Haven

```bash
# Clone the repository
git clone https://github.com/ThaneWinters/GameTavern.git
cd GameTavern/deploy/standalone

# Make scripts executable
chmod +x install.sh
chmod +x scripts/*.sh
```

### 6. Run the Installer

```bash
./install.sh
```

The wizard will prompt you for:
- Site name and description
- Domain (or localhost for testing)
- Ports for each service
- Feature toggles
- Email/SMTP settings (optional)
- Whether to enable Admin Studio

### 7. Start the Stack

```bash
docker compose up -d
```

Wait ~60 seconds for all services to initialize.

### 8. Create Your Admin User

```bash
./scripts/create-admin.sh
```

### 9. Access Your Site

- **Application**: `http://your-server-ip:3000`
- **Admin Studio** (if enabled): `http://your-server-ip:3001`

---

## One-Line Install (Alternative)

For an even faster setup on a fresh server:

```bash
curl -fsSL https://get.docker.com | sh && \
git clone https://github.com/ThaneWinters/GameTavern.git && \
cd GameTavern/deploy/standalone && \
chmod +x install.sh scripts/*.sh && \
./install.sh
```

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

## Installation Options

### Interactive Install (Recommended)

```bash
./install.sh
```

The wizard will prompt for:
- Site name and description
- Domain and ports
- Feature toggles
- Email/SMTP configuration
- Admin Studio preference

### Manual Configuration

Copy the example environment file and edit:

```bash
cp .env.example .env
nano .env
```

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

### Create Admin User

```bash
./scripts/create-admin.sh
```

### Access Supabase Studio

If enabled during install, access at `http://localhost:3001`

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

### With SSL (Recommended)

1. Point your domain to your server
2. Use a reverse proxy (Nginx, Traefik, Caddy) with SSL
3. Update `.env` with your domain:
   ```
   SITE_URL=https://yourdomain.com
   API_EXTERNAL_URL=https://api.yourdomain.com
   ```

### Example Nginx Config

```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;
    
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}

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

The `create-admin.sh` script automatically detects and fixes this issue. If services show as "Restarting", simply run:

```bash
./scripts/create-admin.sh
```

The script will:
1. Detect unhealthy services
2. Synchronize database passwords
3. Restart affected services
4. Wait for everything to be ready
5. Then create the admin user

**Manual fix** (if needed):

```bash
./scripts/fix-db-passwords.sh
```

### Roles missing ("role does not exist")

If you see errors like `role "supabase_auth_admin" does not exist`, the DB volume likely wasnt initialized correctly (or an old volume is being reused).

The latest scripts will attempt to create the missing internal roles automatically, but if services still loop/restart, do a clean reset:

```bash
docker compose down -v
docker compose up -d
./scripts/create-admin.sh
```

Also note: changing `POSTGRES_PASSWORD`, `JWT_SECRET`, `ANON_KEY`, or `SERVICE_ROLE_KEY` after the first boot can break auth/API until you either re-run the installer and/or recreate volumes.

### Check service health

```bash
# Check service health
docker compose ps

# Check specific logs
docker compose logs db
docker compose logs auth
```

### Database connection issues

```bash
# Verify database is ready
docker exec gamehaven-db pg_isready

# Check database logs
docker compose logs db
```

### Reset everything

```bash
# Stop and remove all containers and volumes
docker compose down -v

# Re-run installer
./install.sh
docker compose up -d
./scripts/create-admin.sh
```

## Requirements

- Docker 20.10+
- Docker Compose 2.0+
- 4GB RAM minimum (8GB recommended)
- 20GB disk space

## Security Notes

1. **Change default passwords** - The installer generates secure passwords automatically
2. **Use HTTPS in production** - Configure SSL via reverse proxy
3. **Backup regularly** - Use the provided backup script
4. **Keep credentials secure** - The `.credentials` file contains sensitive data
