# GameTaverns Multi-Tenant Deployment Guide

> **Target:** Fresh Ubuntu 22.04+ server → Production multi-tenant platform  
> **Time:** ~30 minutes  
> **Result:** `https://yourdomain.com` with wildcard subdomains for libraries

---

## Prerequisites Checklist

Before starting, ensure you have:

- [ ] **Fresh Ubuntu 22.04+ server** (Debian 12+ also works)
- [ ] **Root or sudo access** to the server
- [ ] **Domain name** with access to DNS settings
- [ ] **Cloudflare account** (free tier works) for wildcard SSL

**Recommended Specs:**

| Scale | RAM | CPU | Storage | Example |
|-------|-----|-----|---------|---------|
| 50–100 libraries | 32GB | 6 cores | NVMe SSD | OVH Sys-1 ($30/mo) |

---

## Step 1: Server Preparation

SSH into your fresh server and run these commands **in order**.

### 1.1 Update System

```bash
sudo apt update && sudo apt upgrade -y
```

### 1.2 Install Docker

```bash
curl -fsSL https://get.docker.com | sh
```

### 1.3 Add Your User to Docker Group

```bash
sudo usermod -aG docker $USER
```

### 1.4 Apply Group Changes

**⚠️ IMPORTANT:** You must log out and back in for the group change to take effect.

```bash
exit
```

Now SSH back into your server.

### 1.5 Install Docker Compose Plugin

```bash
sudo apt install docker-compose-plugin -y
```

### 1.6 Verify Installation

```bash
docker --version
docker compose version
```

**✓ Checkpoint:** Both commands should output version numbers (Docker 24+, Compose 2+).

---

## Step 2: Clone Repository

### 2.1 Clone to /opt

```bash
sudo git clone https://github.com/YOUR_USERNAME/GameTavern.git /opt/gametaverns
```

> **Note:** Replace `YOUR_USERNAME` with your actual GitHub username or organization.

### 2.2 Set Ownership

```bash
sudo chown -R $USER:$USER /opt/gametaverns
```

### 2.3 Navigate to Deploy Directory

```bash
cd /opt/gametaverns/deploy/multitenant
```

### 2.4 Make Scripts Executable

```bash
chmod +x install.sh scripts/*.sh
```

**✓ Checkpoint:** You should be in `/opt/gametaverns/deploy/multitenant`.

---

## Step 3: Configure the Platform

### 3.1 Run Interactive Installer

```bash
./install.sh
```

The installer will prompt you for:

| Prompt | Example | Notes |
|--------|---------|-------|
| Domain | `gametaverns.com` | Your actual domain |
| Site name | `GameTaverns` | Display name |
| Admin email | `admin@example.com` | For SSL & notifications |
| SSL method | `2` (Cloudflare) | Recommended for wildcards |
| Cloudflare API token | `abc123...` | See Step 3.2 below |

### 3.2 Get Cloudflare API Token

1. Go to [Cloudflare Dashboard → API Tokens](https://dash.cloudflare.com/profile/api-tokens)
2. Click **Create Token**
3. Use **Edit zone DNS** template
4. Set zone to your domain
5. Click **Create Token**
6. Copy the token (you won't see it again)

**✓ Checkpoint:** You should have a `.env` file in the current directory.

---

## Step 4: Configure DNS

In your **Cloudflare DNS settings**, add these records:

| Type | Name | Content | Proxy |
|------|------|---------|-------|
| A | `@` | `YOUR_SERVER_IP` | DNS only (gray) |
| A | `*` | `YOUR_SERVER_IP` | DNS only (gray) |
| A | `www` | `YOUR_SERVER_IP` | DNS only (gray) |

> **⚠️ CRITICAL:** Set proxy status to **DNS only** (gray cloud icon), not Proxied (orange). This is required for wildcard SSL certificates.

**✓ Checkpoint:** Running `dig yourdomain.com` should return your server IP.

---

## Step 5: Update Nginx Configuration

The default nginx config uses `gametaverns.com`. Update it to your domain.

### 5.1 Edit Proxy Config

```bash
nano nginx/proxy.conf
```

### 5.2 Find and Replace Domain

Replace all instances of `gametaverns.com` with your domain. There are **6 occurrences**:

- Line 87: `server_name yourdomain.com www.yourdomain.com;`
- Line 89: `ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;`
- Line 90: `ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;`
- Line 99: `if ($host = 'www.yourdomain.com') {`
- Line 100: `return 301 https://yourdomain.com$request_uri;`
- Lines 135-136: SSL certificate paths again

**Tip:** Use Ctrl+W in nano to search, or use sed:

```bash
sed -i 's/gametaverns\.com/yourdomain.com/g' nginx/proxy.conf
```

### 5.3 Save and Exit

Press `Ctrl+X`, then `Y`, then `Enter`.

**✓ Checkpoint:** `grep yourdomain nginx/proxy.conf` shows your domain.

---

## Step 6: Start Services

### 6.1 Start Database and API First (Without SSL Proxy)

```bash
docker compose up -d db api app
```

### 6.2 Wait for Database to Initialize

```bash
docker compose logs -f db
```

Wait until you see: `database system is ready to accept connections`

Press `Ctrl+C` to exit logs.

### 6.3 Verify Services are Healthy

```bash
docker compose ps
```

**✓ Checkpoint:** All three services (db, api, app) should show `healthy` or `running`.

---

## Step 7: Get SSL Certificates

### 7.1 Run Cloudflare SSL Setup

```bash
./scripts/setup-ssl-cloudflare.sh
```

This will:
- Request a wildcard certificate for `yourdomain.com` and `*.yourdomain.com`
- Save certificates to `nginx/ssl/`

**✓ Checkpoint:** You should see "Wildcard SSL certificate obtained!"

### 7.2 Start the SSL Proxy

```bash
docker compose --profile production up -d proxy certbot
```

### 7.3 Verify SSL is Working

```bash
curl -I https://yourdomain.com
```

**✓ Checkpoint:** You should see `HTTP/2 200` or a redirect.

---

## Step 8: Create Admin Account

### 8.1 Run Admin Creation Script

```bash
./scripts/create-admin.sh
```

You'll be prompted for:

| Prompt | Example | Notes |
|--------|---------|-------|
| Email | `admin@example.com` | Your login email |
| Display Name | `John Smith` | Shown on your library |
| Library slug | `johns-games` | URL: `johns-games.yourdomain.com` |
| Password | (hidden) | Minimum 8 characters |

**✓ Checkpoint:** You should see "Admin Created Successfully!"

---

## Step 9: Verify Deployment

### 9.1 Test Main Site

Open in browser: `https://yourdomain.com`

You should see the GameTaverns landing page.

### 9.2 Test Your Library

Open in browser: `https://your-slug.yourdomain.com`

You should see your empty library.

### 9.3 Test Admin Login

1. Go to `https://yourdomain.com`
2. Click Login
3. Enter your admin credentials
4. You should be redirected to your library

### 9.4 Test Platform Admin

Go to `https://yourdomain.com/admin`

You should see the platform administration dashboard.

---

## 🎉 Deployment Complete!

Your multi-tenant GameTaverns platform is now live:

- **Main site:** `https://yourdomain.com`
- **Libraries:** `https://[slug].yourdomain.com`
- **Platform admin:** `https://yourdomain.com/admin`

---

## Post-Deployment

### Enable Automatic Backups

```bash
# Add daily backup at 2 AM
(crontab -l 2>/dev/null; echo "0 2 * * * /opt/gametaverns/deploy/multitenant/scripts/backup.sh") | crontab -
```

### Configure Firewall

```bash
# Allow only essential ports
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP (redirects to HTTPS)
sudo ufw allow 443/tcp  # HTTPS
sudo ufw enable
```

### Set Up Fail2ban (Optional)

```bash
sudo apt install fail2ban -y
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

---

## Common Operations

### View Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f api
docker compose logs -f db
docker compose logs -f proxy
```

### Restart Services

```bash
# Restart everything
docker compose restart

# Restart specific service
docker compose restart api
```

### Manual Backup

```bash
./scripts/backup.sh
```

### Restore from Backup

```bash
./scripts/restore.sh backups/gametaverns_YYYYMMDD_HHMMSS.sql.gz
```

### Update to Latest Version

```bash
cd /opt/gametaverns
git pull origin main
cd deploy/multitenant
docker compose build
docker compose up -d
```

### Access Database

```bash
docker exec -it gametaverns-db psql -U postgres -d gametaverns
```

---

## Troubleshooting

### "Permission denied" when running Docker

You didn't log out and back in after adding yourself to the docker group. Run:

```bash
exit
```

Then SSH back in.

### SSL Certificate Not Found

1. Check if certificates exist: `ls nginx/ssl/`
2. Re-run SSL setup: `./scripts/setup-ssl-cloudflare.sh`
3. Check Cloudflare token has DNS edit permissions

### Database Connection Failed

1. Check database is running: `docker compose ps db`
2. View database logs: `docker compose logs db`
3. Restart database: `docker compose restart db`

### Library Subdomain Not Working

1. Verify DNS wildcard: `dig test.yourdomain.com`
2. Check nginx is running: `docker compose ps proxy`
3. View nginx logs: `docker compose logs proxy`

### API Returns 502 Bad Gateway

1. Check API is running: `docker compose ps api`
2. View API logs: `docker compose logs api`
3. Restart API: `docker compose restart api`

### "Address already in use" Error

Another service is using port 80 or 443:

```bash
# Find what's using the port
sudo lsof -i :80
sudo lsof -i :443

# Stop the conflicting service (e.g., apache)
sudo systemctl stop apache2
sudo systemctl disable apache2
```

---

## Architecture Reference

```
Internet
    │
    ▼
┌─────────────────────────────────────┐
│        Nginx Proxy (:443)           │  ← SSL termination
│   *.yourdomain.com → app            │  ← Subdomain routing
│   /api/* → api                      │  ← API proxy
└──────────────┬──────────────────────┘
               │
    ┌──────────┼──────────┐
    ▼          ▼          ▼
┌────────┐ ┌────────┐ ┌────────┐
│  App   │ │  API   │ │   DB   │
│ :80    │ │ :3001  │ │ :5432  │
│ (nginx)│ │(express)│ │(postgres)│
└────────┘ └────────┘ └────────┘
```

**Container Names:**
- `gametaverns-db` - PostgreSQL 16
- `gametaverns-api` - Express.js API
- `gametaverns-app` - Nginx serving React build
- `gametaverns-proxy` - Nginx reverse proxy (production profile)
- `gametaverns-certbot` - SSL certificate renewal (production profile)

---

## Support

- **Issues:** [GitHub Issues](https://github.com/YOUR_USERNAME/GameTavern/issues)
- **Documentation:** This file

*Last updated: January 2025*
