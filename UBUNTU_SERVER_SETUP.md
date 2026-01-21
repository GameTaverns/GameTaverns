# Game Haven: Complete Ubuntu Server Deployment Guide

This is a step-by-step guide to prepare an Ubuntu server and deploy Game Haven with a self-hosted Supabase backend.

---

## Table of Contents

1. [Server Requirements](#server-requirements)
2. [Server Preparation](#server-preparation)
3. [Security Hardening](#security-hardening)
4. [Install Docker](#install-docker)
5. [Deploy Game Haven](#deploy-game-haven)
6. [Configure SSL/HTTPS](#configure-sslhttps)
7. [Create Admin User](#create-admin-user)
8. [Firewall Configuration](#firewall-configuration)
9. [Automated Backups](#automated-backups)
10. [Monitoring & Maintenance](#monitoring--maintenance)
11. [Troubleshooting](#troubleshooting)

---

## Server Requirements

### Minimum Specifications
| Resource | Minimum | Recommended | Production |
|----------|---------|-------------|------------|
| RAM | 4GB | 8GB | 16GB+ |
| CPU | 2 cores | 4 cores | 4+ cores |
| Disk | 20GB SSD | 50GB SSD | 100GB+ SSD |
| OS | Ubuntu 20.04 | Ubuntu 22.04 | Ubuntu 22.04 LTS |

### Network Requirements
- Static IP address (or dynamic DNS)
- Ports 80, 443 open for web traffic
- Port 22 for SSH access (recommended: change to non-standard)
- Domain name (optional but recommended for production)

---

## Server Preparation

### Step 1: Connect to Your Server

```bash
ssh root@your-server-ip
```

### Step 2: Update System

```bash
# Update package lists
apt update

# Upgrade all packages
apt upgrade -y

# Install essential tools
apt install -y curl wget git openssl htop nano ufw fail2ban
```

### Step 3: Create Deploy User (Recommended)

Running as root is not recommended. Create a dedicated user:

```bash
# Create user
adduser gamehaven

# Add to sudo group
usermod -aG sudo gamehaven

# Switch to new user
su - gamehaven
```

### Step 4: Set Timezone

```bash
# Set your timezone
sudo timedatectl set-timezone America/New_York  # Change to your timezone

# Verify
timedatectl
```

### Step 5: Configure Swap (If RAM < 8GB)

```bash
# Check if swap exists
sudo swapon --show

# If no swap, create 4GB swap
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Make permanent
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Verify
free -h
```

---

## Security Hardening

### Step 1: Configure SSH

```bash
# Backup SSH config
sudo cp /etc/ssh/sshd_config /etc/ssh/sshd_config.backup

# Edit SSH config
sudo nano /etc/ssh/sshd_config
```

Add/modify these settings:

```
# Disable root login
PermitRootLogin no

# Disable password authentication (after setting up SSH keys)
# PasswordAuthentication no

# Change default port (optional but recommended)
Port 2222

# Limit authentication attempts
MaxAuthTries 3

# Disable empty passwords
PermitEmptyPasswords no
```

```bash
# Restart SSH
sudo systemctl restart sshd
```

### Step 2: Setup SSH Keys (Recommended)

On your **local machine**:

```bash
# Generate SSH key if you don't have one
ssh-keygen -t ed25519 -C "your_email@example.com"

# Copy to server
ssh-copy-id -p 2222 gamehaven@your-server-ip
```

### Step 3: Install Fail2ban

```bash
# Install
sudo apt install -y fail2ban

# Create local config
sudo cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local
sudo nano /etc/fail2ban/jail.local
```

Add/modify:

```ini
[sshd]
enabled = true
port = 2222
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 3600
findtime = 600
```

```bash
# Start fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban

# Check status
sudo fail2ban-client status sshd
```

---

## Install Docker

### Step 1: Install Docker Engine

```bash
# Remove old versions
sudo apt remove -y docker docker-engine docker.io containerd runc 2>/dev/null || true

# Install prerequisites
sudo apt install -y ca-certificates curl gnupg lsb-release

# Add Docker GPG key
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Add Docker repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Update and install
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Verify installation
docker --version
docker compose version
```

### Step 2: Configure Docker

```bash
# Add your user to docker group (no sudo needed for docker commands)
sudo usermod -aG docker gamehaven

# Apply group change (or log out and back in)
newgrp docker

# Test Docker
docker run hello-world
```

### Step 3: Configure Docker Logging

Prevent logs from filling up disk:

```bash
sudo nano /etc/docker/daemon.json
```

Add:

```json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
```

```bash
# Restart Docker
sudo systemctl restart docker
```

---

## Deploy Game Haven

### Step 1: Clone Repository

```bash
# Navigate to home directory
cd ~

# Clone the repository (replace with your actual repo URL)
git clone https://github.com/your-username/game-haven.git
cd game-haven
```

### Step 2: Make Deploy Script Executable

```bash
chmod +x deploy/deploy.sh
```

### Step 3: Run Setup

```bash
./deploy/deploy.sh setup
```

The script will prompt you for:

1. **Site name** - Your game library name
2. **Site description** - Brief description
3. **Site author** - Your name
4. **Domain** - Your domain or `localhost` for testing
5. **SMTP settings** - For email notifications (optional)
6. **Cloudflare Turnstile** - For anti-spam (optional)
7. **API keys** - For enhanced features (optional)

### Step 4: Verify Deployment

```bash
# Check all services are running
./deploy/deploy.sh status

# Expected output: All containers should be "Up"
```

### Step 5: Access Your Site

| Service | URL | Description |
|---------|-----|-------------|
| Frontend | http://your-server-ip | Main web application |
| Supabase API | http://your-server-ip:8000 | Backend API |
| Supabase Studio | http://your-server-ip:3000 | Admin database UI |

---

## Configure SSL/HTTPS

### Option A: Nginx with Let's Encrypt (Recommended)

#### Step 1: Install Nginx and Certbot

```bash
# Install Nginx
sudo apt install -y nginx

# Install Certbot
sudo apt install -y certbot python3-certbot-nginx
```

#### Step 2: Configure Nginx

```bash
# Create site config
sudo nano /etc/nginx/sites-available/gamehaven
```

Add this configuration (replace `games.yourdomain.com` with your domain):

```nginx
# HTTP - redirect to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name games.yourdomain.com;
    
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }
    
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# HTTPS - main site
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name games.yourdomain.com;

    # SSL certificates (will be added by certbot)
    # ssl_certificate /etc/letsencrypt/live/games.yourdomain.com/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/games.yourdomain.com/privkey.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Frontend
    location / {
        proxy_pass http://127.0.0.1:80;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # Supabase API
    location /api/ {
        proxy_pass http://127.0.0.1:8000/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket for Realtime
    location /realtime/ {
        proxy_pass http://127.0.0.1:8000/realtime/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

#### Step 3: Enable Site and Get Certificate

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/gamehaven /etc/nginx/sites-enabled/

# Remove default site
sudo rm /etc/nginx/sites-enabled/default

# Test config
sudo nginx -t

# Get SSL certificate
sudo certbot --nginx -d games.yourdomain.com

# Restart Nginx
sudo systemctl restart nginx
```

#### Step 4: Update Game Haven Config

Update `deploy/.env` with HTTPS URLs:

```bash
nano deploy/.env
```

Change:
```env
SITE_URL=https://games.yourdomain.com
API_EXTERNAL_URL=https://games.yourdomain.com/api
```

Then restart:
```bash
./deploy/deploy.sh restart
```

#### Step 5: Auto-Renew Certificates

Certbot automatically sets up renewal. Verify:

```bash
sudo certbot renew --dry-run
```

---

## Create Admin User

### Step 1: Create Account

1. Visit your site (e.g., https://games.yourdomain.com)
2. Click "Sign Up" and create your account
3. Check your email if SMTP is configured

### Step 2: Grant Admin Role

**Option A: Using Supabase Studio**

1. Visit http://your-server-ip:3000
2. Go to Table Editor → `user_roles`
3. Click "Insert row"
4. Find your `user_id` from the `auth.users` table
5. Set `role` to `admin`

**Option B: Using SQL**

```bash
# Connect to database
docker exec -it supabase-db psql -U postgres

# Grant admin role
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin' FROM auth.users WHERE email = 'your@email.com';

# Verify
SELECT u.email, r.role 
FROM auth.users u 
JOIN public.user_roles r ON u.id = r.user_id;

# Exit
\q
```

---

## Firewall Configuration

### Configure UFW

```bash
# Enable UFW
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow SSH (use your port if changed)
sudo ufw allow 2222/tcp comment 'SSH'

# Allow HTTP/HTTPS
sudo ufw allow 80/tcp comment 'HTTP'
sudo ufw allow 443/tcp comment 'HTTPS'

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status verbose
```

### Important: Restrict Internal Ports

Do NOT expose these ports publicly:
- Port 5432 (PostgreSQL)
- Port 3000 (Supabase Studio) - access via SSH tunnel if needed
- Port 8000 (Kong API) - access via Nginx proxy

To access Studio remotely, use SSH tunnel:

```bash
# On your local machine
ssh -L 3000:localhost:3000 gamehaven@your-server-ip -p 2222

# Then visit http://localhost:3000 in your browser
```

---

## Automated Backups

### Step 1: Create Backup Script

```bash
sudo mkdir -p /opt/backups
sudo nano /opt/backups/backup-gamehaven.sh
```

Add:

```bash
#!/bin/bash
# Game Haven Automated Backup Script

BACKUP_DIR="/opt/backups/gamehaven"
RETENTION_DAYS=30
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Database backup
docker exec supabase-db pg_dump -U postgres postgres | gzip > "$BACKUP_DIR/db_$DATE.sql.gz"

# Storage backup (if using file storage)
if [ -d "/home/gamehaven/game-haven/deploy/volumes/storage" ]; then
    tar -czf "$BACKUP_DIR/storage_$DATE.tar.gz" -C /home/gamehaven/game-haven/deploy/volumes storage
fi

# Remove old backups
find "$BACKUP_DIR" -name "*.gz" -mtime +$RETENTION_DAYS -delete

# Log success
echo "$(date): Backup completed - db_$DATE.sql.gz" >> /var/log/gamehaven-backup.log
```

```bash
# Make executable
sudo chmod +x /opt/backups/backup-gamehaven.sh

# Test backup
sudo /opt/backups/backup-gamehaven.sh

# Verify
ls -la /opt/backups/gamehaven/
```

### Step 2: Schedule with Cron

```bash
# Edit crontab
sudo crontab -e
```

Add (runs daily at 2 AM):

```cron
0 2 * * * /opt/backups/backup-gamehaven.sh
```

### Step 3: Off-Site Backups (Optional)

For production, sync to external storage:

```bash
# Example: rsync to another server
rsync -avz /opt/backups/gamehaven/ backup-server:/backups/gamehaven/

# Example: sync to S3 (requires AWS CLI)
aws s3 sync /opt/backups/gamehaven/ s3://your-bucket/gamehaven-backups/
```

---

## Monitoring & Maintenance

### System Health Commands

```bash
# Check disk space
df -h

# Check memory
free -h

# Check CPU/memory usage
htop

# Check Docker containers
docker ps

# Check container resource usage
docker stats

# Check container logs
./deploy/deploy.sh logs
./deploy/deploy.sh logs frontend
./deploy/deploy.sh logs db
```

### Updating Game Haven

```bash
cd ~/game-haven

# Pull latest changes
git pull origin main

# Rebuild frontend
cd deploy
docker compose build frontend

# Restart services
docker compose up -d

# Apply new migrations (if any)
# Check supabase/migrations/ for new files and apply
```

### Database Maintenance

```bash
# Vacuum and analyze (run monthly)
docker exec supabase-db psql -U postgres -c "VACUUM ANALYZE;"

# Check database size
docker exec supabase-db psql -U postgres -c "SELECT pg_size_pretty(pg_database_size('postgres'));"

# Check table sizes
docker exec supabase-db psql -U postgres -c "
SELECT schemaname, tablename, 
       pg_size_pretty(pg_total_relation_size(schemaname || '.' || tablename)) AS size
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname || '.' || tablename) DESC;
"
```

---

## Troubleshooting

### Common Issues

#### 1. Containers Not Starting

```bash
# Check Docker daemon
sudo systemctl status docker

# Check container logs
docker logs supabase-db
docker logs supabase-auth
docker logs gamehaven-frontend
```

#### 2. Database Connection Issues

```bash
# Test database
docker exec supabase-db pg_isready -U postgres

# Check if database is running
docker ps | grep supabase-db

# Restart database
cd ~/game-haven/deploy
docker compose restart db
```

#### 3. Frontend Not Loading

```bash
# Check frontend container
docker logs gamehaven-frontend

# Rebuild frontend
docker compose build --no-cache frontend
docker compose up -d frontend
```

#### 4. Auth Not Working

```bash
# Check auth service
docker logs supabase-auth

# Verify JWT secret matches
docker exec supabase-auth env | grep JWT

# Check if SITE_URL is correct
docker exec supabase-auth env | grep SITE_URL
```

#### 5. Edge Functions Not Working

```bash
# Check functions container
docker logs supabase-functions

# Verify secrets are set
docker exec supabase-functions env | grep -E "(SUPABASE|PII)"
```

#### 6. SSL Certificate Issues

```bash
# Check certificate status
sudo certbot certificates

# Force renewal
sudo certbot renew --force-renewal

# Check Nginx config
sudo nginx -t
sudo systemctl restart nginx
```

### Reset Everything

If you need to start fresh:

```bash
cd ~/game-haven

# Stop all containers
./deploy/deploy.sh stop

# Remove all data (WARNING: deletes database!)
sudo rm -rf deploy/volumes/db/data/*
sudo rm -rf deploy/volumes/storage/*

# Run setup again
./deploy/deploy.sh setup
```

---

## Quick Reference

### Essential Commands

```bash
# Start/Stop/Restart
./deploy/deploy.sh start
./deploy/deploy.sh stop
./deploy/deploy.sh restart

# Check status
./deploy/deploy.sh status

# View logs
./deploy/deploy.sh logs           # All services
./deploy/deploy.sh logs frontend  # Specific service
./deploy/deploy.sh logs db

# Database access
docker exec -it supabase-db psql -U postgres

# Backup now
sudo /opt/backups/backup-gamehaven.sh
```

### Important Paths

| Path | Description |
|------|-------------|
| `~/game-haven/` | Project root |
| `~/game-haven/deploy/.env` | Configuration file |
| `~/game-haven/deploy/volumes/db/data/` | Database files |
| `~/game-haven/deploy/volumes/storage/` | File storage |
| `/opt/backups/gamehaven/` | Backup files |
| `/var/log/gamehaven-backup.log` | Backup log |

### Ports Reference

| Port | Service | Exposure |
|------|---------|----------|
| 80 | Frontend (Nginx) | Public |
| 443 | Frontend (HTTPS) | Public |
| 2222 | SSH | Public (restricted) |
| 3000 | Supabase Studio | Internal only |
| 5432 | PostgreSQL | Internal only |
| 8000 | Kong API Gateway | Internal only |

---

## Support

- **GitHub Issues**: Report bugs and request features
- **Documentation**: See `DEPLOYMENT.md` for additional details
- **Configuration**: See `CONFIGURATION.md` for customization options

---

*Last updated: January 2026*
