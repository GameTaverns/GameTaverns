# GameTaverns Multi-Tenant Deployment Guide

> **Target:** Fresh Ubuntu 22.04+ server → Production multi-tenant platform  
> **Time:** ~45 minutes  
> **Result:** `https://yourdomain.com` with wildcard subdomains, email, and all features

---

## Prerequisites Checklist

Before starting, ensure you have:

- [ ] **Fresh Ubuntu 22.04+ server** (Debian 12+ also works)
- [ ] **Root or sudo access** to the server
- [ ] **Domain name** with access to DNS settings
- [ ] **Cloudflare account** (free tier works) for wildcard SSL
- [ ] **SMTP credentials** (see Email Setup section)

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
sudo git clone https://github.com/GameTaverns/GameTaverns.git /opt/gametaverns
```

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

## Step 3: Email Setup (SMTP)

GameTaverns requires email for user registration and password resets. You have several options:

### Option A: External SMTP Provider (Recommended)

| Provider | Free Tier | Setup Time | Notes |
|----------|-----------|------------|-------|
| **Resend** | 3,000/month | 5 min | Best for transactional email |
| **Postmark** | 100/month | 5 min | Excellent deliverability |
| **SendGrid** | 100/day | 10 min | Part of Twilio |
| **Mailgun** | 5,000/month | 10 min | Good API |

**Resend Setup (Fastest):**

1. Sign up at [resend.com](https://resend.com)
2. Add and verify your domain
3. Create an API key
4. Use these settings in your `.env`:
   ```
   SMTP_HOST=smtp.resend.com
   SMTP_PORT=587
   SMTP_USER=resend
   SMTP_PASS=re_your_api_key_here
   SMTP_FROM=noreply@yourdomain.com
   ```

### Option B: Self-Hosted Mail Server (Advanced)

Only use this if you have experience with email servers. Self-hosted email requires careful configuration to avoid spam filters.

```bash
# Install Postfix (basic MTA)
sudo apt install postfix mailutils -y
# Select "Internet Site" when prompted
# Use your domain name when asked

# Configure for local delivery to Docker
sudo nano /etc/postfix/main.cf
# Add: inet_interfaces = all
# Add: mynetworks = 127.0.0.0/8 172.16.0.0/12 192.168.0.0/16

sudo systemctl restart postfix
```

**SMTP settings for local Postfix:**
```
SMTP_HOST=host.docker.internal
SMTP_PORT=25
SMTP_USER=
SMTP_PASS=
SMTP_SECURE=false
SMTP_FROM=noreply@yourdomain.com
```

### Option C: Gmail SMTP (Development Only)

**⚠️ NOT recommended for production** - Gmail has strict sending limits.

1. Enable 2FA on your Google account
2. Create an App Password at [Google App Passwords](https://myaccount.google.com/apppasswords)
3. Use:
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your@gmail.com
   SMTP_PASS=your_app_password
   SMTP_FROM=your@gmail.com
   ```

---

## Step 4: Configure the Platform

### 4.1 Run Interactive Installer

```bash
./install.sh
```

The installer will prompt you for:

| Prompt | Example | Notes |
|--------|---------|-------|
| Domain | `gametaverns.com` | Your actual domain |
| Site name | `GameTaverns` | Display name |
| Admin email | `admin@example.com` | For SSL & notifications |
| SMTP Host | `smtp.resend.com` | From email provider |
| SMTP Port | `587` | Usually 587 (TLS) or 465 (SSL) |
| SMTP User | `resend` | Username from provider |
| SMTP Pass | `re_abc123...` | Password/API key |
| SMTP From | `noreply@yourdomain.com` | Must match verified domain |
| SSL method | `2` (Cloudflare) | Recommended for wildcards |
| Cloudflare API token | `abc123...` | See below |

### 4.2 Get Cloudflare API Token

1. Go to [Cloudflare Dashboard → API Tokens](https://dash.cloudflare.com/profile/api-tokens)
2. Click **Create Token**
3. Use **Edit zone DNS** template
4. Set zone to your domain
5. Click **Create Token**
6. Copy the token (you won't see it again)

**✓ Checkpoint:** You should have a `.env` file in the current directory.

---

## Step 5: Configure DNS

In your **Cloudflare DNS settings**, add these records:

| Type | Name | Content | Proxy |
|------|------|---------|-------|
| A | `@` | `YOUR_SERVER_IP` | DNS only (gray) |
| A | `*` | `YOUR_SERVER_IP` | DNS only (gray) |
| A | `www` | `YOUR_SERVER_IP` | DNS only (gray) |

**For email (if using external SMTP, skip this):**

| Type | Name | Content | Notes |
|------|------|---------|-------|
| MX | `@` | `mail.yourdomain.com` | Priority: 10 |
| TXT | `@` | `v=spf1 include:_spf.resend.com ~all` | SPF record |
| TXT | `resend._domainkey` | (from Resend dashboard) | DKIM |

> **⚠️ CRITICAL:** Set proxy status to **DNS only** (gray cloud icon), not Proxied (orange). This is required for wildcard SSL certificates.

**✓ Checkpoint:** Running `dig yourdomain.com` should return your server IP.

---

## Step 6: Update Nginx Configuration

The default nginx config uses `gametaverns.com`. Update it to your domain.

### 6.1 Quick Replace

```bash
sed -i 's/gametaverns\.com/yourdomain.com/g' nginx/proxy.conf
```

### 6.2 Verify

```bash
grep yourdomain nginx/proxy.conf
```

**✓ Checkpoint:** You should see your domain in the output.

---

## Step 7: Start Services

### 7.1 Start Database and API First (Without SSL Proxy)

```bash
docker compose up -d db api app
```

### 7.2 Wait for Database to Initialize

```bash
docker compose logs -f db
```

Wait until you see: `database system is ready to accept connections`

Press `Ctrl+C` to exit logs.

### 7.3 Verify Services are Healthy

```bash
docker compose ps
```

**✓ Checkpoint:** All three services (db, api, app) should show `healthy` or `running`.

---

## Step 8: Get SSL Certificates

### 8.1 Run Cloudflare SSL Setup

```bash
./scripts/setup-ssl-cloudflare.sh
```

This will:
- Request a wildcard certificate for `yourdomain.com` and `*.yourdomain.com`
- Save certificates to `nginx/ssl/`

**✓ Checkpoint:** You should see "Wildcard SSL certificate obtained!"

### 8.2 Start the SSL Proxy

```bash
docker compose --profile production up -d proxy certbot
```

### 8.3 Verify SSL is Working

```bash
curl -I https://yourdomain.com
```

**✓ Checkpoint:** You should see `HTTP/2 200` or a redirect.

---

## Step 9: Create Admin Account

### 9.1 Run Admin Creation Script

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

## Step 10: Test Email

### 10.1 Verify SMTP Connection

```bash
docker exec -it gametaverns-api node -e "
const nodemailer = require('nodemailer');
const t = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
});
t.verify().then(() => console.log('✓ SMTP OK')).catch(e => console.error('✗ SMTP Failed:', e.message));
"
```

**✓ Checkpoint:** You should see "✓ SMTP OK"

### 10.2 Test Registration Email

1. Go to `https://yourdomain.com`
2. Click "Create Library" or "Sign Up"
3. Enter a test email address
4. Check inbox for verification email

---

## Step 11: Verify Deployment

### 11.1 Test Main Site

Open in browser: `https://yourdomain.com`

You should see the GameTaverns landing page.

### 11.2 Test Your Library

Open in browser: `https://your-slug.yourdomain.com`

You should see your empty library.

### 11.3 Test Admin Login

1. Go to `https://yourdomain.com`
2. Click Login
3. Enter your admin credentials
4. You should be redirected to your library

### 11.4 Test Platform Admin

Go to `https://yourdomain.com/admin`

You should see the platform administration dashboard.

---

## 🎉 Deployment Complete!

Your multi-tenant GameTaverns platform is now live:

- **Main site:** `https://yourdomain.com`
- **Libraries:** `https://[slug].yourdomain.com`
- **Platform admin:** `https://yourdomain.com/admin`

---

## Feature Parity Checklist

This self-hosted deployment includes **all features** from the cloud version:

| Feature | Status | Notes |
|---------|--------|-------|
| **Authentication** | ✅ | Email/password with verification |
| **Email Verification** | ✅ | SMTP required |
| **Password Reset** | ✅ | SMTP required |
| **Username Login** | ✅ | Login with email or username |
| **Game Library** | ✅ | Full CRUD with BGG import |
| **Game Sessions/Play Logs** | ✅ | Track plays with players |
| **Game Ratings** | ✅ | Guest ratings with fingerprinting |
| **Wishlist** | ✅ | Guest voting system |
| **Polls** | ✅ | Quick votes and game nights |
| **RSVP System** | ✅ | For game night polls |
| **Events/Calendar** | ✅ | Library events + polls combined |
| **Contact Messages** | ✅ | Encrypted PII storage |
| **For Sale Listings** | ✅ | Mark games for sale |
| **Discord Webhooks** | ✅ | Per-library notifications |
| **Discord DMs** | ✅ | Requires bot token |
| **Discord Events** | ✅ | Create scheduled events |
| **Theme Customization** | ✅ | Full HSL color picker |
| **Logo Upload** | ✅ | File storage included |
| **Multi-tenant** | ✅ | Subdomain + custom domains |
| **Platform Admin** | ✅ | User/library management |

---

## Optional: Discord Integration

For Discord notifications and DMs:

### 1. Create Discord Bot

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create New Application → Name it "GameTaverns Bot"
3. Go to Bot → Add Bot
4. Copy the Token
5. Enable "Message Content Intent" under Privileged Intents

### 2. Add to .env

```bash
nano .env
```

Add:
```
DISCORD_BOT_TOKEN=your_bot_token_here
DISCORD_CLIENT_ID=your_client_id_here
DISCORD_CLIENT_SECRET=your_client_secret_here
```

### 3. Restart API

```bash
docker compose restart api
```

---

## Optional: Turnstile Bot Protection

For CAPTCHA on forms:

1. Go to [Cloudflare Turnstile](https://dash.cloudflare.com/?to=/:account/turnstile)
2. Add site with your domain
3. Get Site Key and Secret Key
4. Add to `.env`:
   ```
   TURNSTILE_SECRET_KEY=your_secret_key
   ```
5. Restart: `docker compose restart api`

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
docker compose build --no-cache
docker compose up -d
```

### Access Database

```bash
docker exec -it gametaverns-db psql -U postgres -d gametaverns
```

---

## Troubleshooting

### Email Not Sending

1. Check SMTP settings in `.env`
2. Verify with test command in Step 10
3. Check API logs: `docker compose logs api | grep -i smtp`
4. Ensure SMTP_FROM matches verified domain
5. Check spam folder

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

## API Routes Reference

All API routes are available at `/api/*`:

| Route | Methods | Auth | Description |
|-------|---------|------|-------------|
| `/api/auth/register` | POST | - | Create account |
| `/api/auth/login` | POST | - | Login |
| `/api/auth/verify-email` | POST | - | Confirm email |
| `/api/auth/forgot-password` | POST | - | Request reset |
| `/api/auth/reset-password` | POST | - | Set new password |
| `/api/games` | GET, POST | Optional/Required | Game CRUD |
| `/api/games/:id` | GET, PUT, DELETE | Optional/Required | Single game |
| `/api/bgg/search` | GET | - | BGG game search |
| `/api/bgg/import` | POST | Required | Import from BGG |
| `/api/ratings` | GET, POST | - | Game ratings |
| `/api/wishlist` | GET, POST, DELETE | - | Wishlist votes |
| `/api/messages` | GET, POST | Required | Contact messages |
| `/api/polls` | GET, POST | Optional/Required | Game polls |
| `/api/polls/:id/vote` | POST, DELETE | - | Vote on polls |
| `/api/polls/:id/rsvp` | POST | - | RSVP to game nights |
| `/api/sessions` | GET, POST | Optional | Play logs |
| `/api/events` | GET, POST | Optional/Required | Library events |
| `/api/events/calendar` | GET | - | Combined calendar view |
| `/api/profiles/me` | GET, PUT | Required | User profile |
| `/api/uploads/image` | POST | Required | Upload files |
| `/api/tenant/settings` | GET, PUT | Optional/Required | Library settings |
| `/api/admin/*` | Various | Admin | Platform admin |

---

## Support

- **Issues:** [GitHub Issues](https://github.com/YOUR_USERNAME/GameTavern/issues)
- **Documentation:** This file

*Last updated: January 2025*
