# GameTaverns Native Deployment

**Version 2.3.0** - Complete self-hosted installation for Ubuntu 24.04 LTS.

## Table of Contents

1. [Overview](#overview)
2. [Requirements](#requirements)
3. [Quick Start](#quick-start)
4. [Complete Walkthrough](#complete-walkthrough)
5. [DNS Configuration](#dns-configuration)
6. [SSL Setup](#ssl-setup)
7. [API Keys & Integrations](#api-keys--integrations)
8. [Daily Management](#daily-management)
9. [Troubleshooting](#troubleshooting)
10. [File Locations](#file-locations)
11. [Script Reference](#script-reference)

---

## Overview

GameTaverns Native provides a complete, single-server deployment with:

| Component | Version | Purpose |
|-----------|---------|---------|
| PostgreSQL | 16 | Database |
| Node.js | 22 LTS | Runtime |
| PM2 | Latest | Process manager |
| Nginx | Latest | Reverse proxy |
| Postfix | Latest | Outgoing mail (SMTP) |
| Dovecot | Latest | Incoming mail (IMAP/POP3) |
| Roundcube | Latest | Webmail interface |
| Cockpit | Latest | Server management GUI |

### Database Schema (v2.3.0)

The migration creates all tables needed for the full-featured platform:

**Core Tables:**
- `users`, `user_profiles`, `user_roles`, `user_totp_settings`
- `libraries`, `library_settings`, `library_suspensions`
- `games`, `game_mechanics`, `game_admin_data`

**Community Features:**
- `library_members` - Community membership with roles
- `library_followers` - Follow libraries for updates
- `game_loans` - Lending system with full workflow
- `borrower_ratings` - Reputation system for borrowers

**Engagement Features:**
- `game_sessions`, `game_session_players`, `game_session_expansions` - Play logging
- `game_polls`, `poll_options`, `poll_votes` - Game night voting
- `game_night_rsvps` - Event attendance tracking
- `library_events` - Calendar events
- `achievements`, `user_achievements` - Gamification system

**Communication:**
- `game_messages` - Encrypted contact form messages
- `game_wishlist`, `game_ratings` - Guest interactions
- `notification_preferences`, `notification_log` - Notification system

---

## Requirements

### Minimum Server Specs
- **OS:** Ubuntu 24.04 LTS (22.04 also supported)
- **RAM:** 2 GB minimum, 4 GB recommended
- **Storage:** 10 GB minimum, 20 GB recommended
- **CPU:** 1 core minimum, 2+ cores recommended

### Network Requirements
- Public IP address
- Domain name with DNS access
- Open ports: 22, 25, 80, 143, 443, 587, 993, 9090

### Before You Start

Gather the following:
- [ ] Fresh Ubuntu 24.04 server (VPS from DigitalOcean, Linode, Hetzner, etc.)
- [ ] Root/sudo access
- [ ] Domain name (e.g., `gametaverns.com`)
- [ ] DNS access to configure records
- [ ] (Optional) Cloudflare API token for wildcard SSL

---

## Quick Start

For experienced users who want to get running fast:

```bash
# 1. Bootstrap prerequisites (run on fresh Ubuntu server)
curl -fsSL https://raw.githubusercontent.com/GameTaverns/GameTaverns/main/deploy/native/scripts/bootstrap.sh | sudo bash

# 2. Run the main installer
cd /opt/gametaverns/deploy/native
sudo ./install.sh
```

That's it! Follow the interactive prompts (~15-25 minutes).

---

## Complete Walkthrough

### Step 1: Server Preparation

**1.1 Create a new VPS**

Create a fresh Ubuntu 24.04 LTS server with your preferred provider:
- DigitalOcean Droplet (4GB+ recommended)
- Linode Nanode/Linode (4GB+ recommended)
- Hetzner Cloud CX22+ 
- AWS EC2 t3.medium+
- Any VPS with Ubuntu 24.04

**1.2 Connect via SSH**

```bash
ssh root@YOUR_SERVER_IP
```

**1.3 Run the bootstrap installer**

```bash
# Download and run bootstrap (prepares the server)
curl -fsSL https://raw.githubusercontent.com/GameTaverns/GameTaverns/main/deploy/native/scripts/bootstrap.sh | sudo bash
```

The bootstrap script will:
- Verify system requirements
- Update all packages
- Install prerequisites (git, curl, build tools)
- Add PostgreSQL and Node.js repositories
- Clone the GameTaverns repository
- Configure the firewall

### Step 2: Run the Main Installer

```bash
cd /opt/gametaverns/deploy/native
sudo ./install.sh
```

The installer will prompt you for:

1. **Mail Domain** - Your domain for email (e.g., `gametaverns.com`)
2. **Primary Domain** - Your main application domain
3. **API Keys** (all optional, can be added later):
   - Cloudflare Turnstile (bot protection)
   - Perplexity AI (game metadata enrichment)
   - Firecrawl (URL scraping)
   - BoardGameGeek API token
   - Discord integration
4. **Admin Account** - First platform administrator

**Estimated time:** 15-25 minutes

### Step 3: Configure DNS

Point these DNS records to your server's IP address:

| Type | Name | Value | Priority |
|------|------|-------|----------|
| A | @ | `YOUR_SERVER_IP` | - |
| A | * | `YOUR_SERVER_IP` | - |
| A | mail | `YOUR_SERVER_IP` | - |
| MX | @ | `mail.yourdomain.com` | 10 |
| TXT | @ | `v=spf1 ip4:YOUR_SERVER_IP -all` | - |

**For DKIM (optional but recommended for email deliverability):**

```bash
# Generate DKIM key
sudo opendkim-genkey -D /etc/opendkim/keys/yourdomain.com -d yourdomain.com -s default
sudo cat /etc/opendkim/keys/yourdomain.com/default.txt
```

Add the resulting TXT record to your DNS.

### Step 4: Enable SSL (HTTPS)

```bash
cd /opt/gametaverns/deploy/native/scripts
sudo ./setup-ssl.sh
```

**For wildcard certificates (recommended for multi-tenant):**
- You'll need a Cloudflare API token
- Create token at: https://dash.cloudflare.com/profile/api-tokens
- Use template: "Edit zone DNS" with access to your domain

### Step 5: Verify Installation

```bash
# Run health check
/opt/gametaverns/deploy/native/scripts/health-check.sh
```

### Step 6: Access Your Site

- **Main Application:** https://yourdomain.com
- **Webmail (Roundcube):** https://mail.yourdomain.com
- **Server Management (Cockpit):** https://YOUR_SERVER_IP:9090

---

## DNS Configuration

### Minimum Required Records

```
# Replace YOUR_IP with your server's public IP
@ 		A	YOUR_IP
* 		A	YOUR_IP
mail 	A	YOUR_IP
@ 		MX	10 mail.yourdomain.com.
@ 		TXT	"v=spf1 ip4:YOUR_IP -all"
```

### Optional but Recommended

```
# DMARC policy
_dmarc	TXT	"v=DMARC1; p=quarantine; rua=mailto:admin@yourdomain.com"

# DKIM (generate key first - see setup instructions)
default._domainkey	TXT	"v=DKIM1; k=rsa; p=YOUR_KEY"
```

---

## SSL Setup

### Automatic (Recommended)

```bash
sudo /opt/gametaverns/deploy/native/scripts/setup-ssl.sh
```

### Manual with Let's Encrypt

```bash
# Root + www only (NOT recommended for multi-tenant)
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Wildcard (requires Cloudflare)
sudo certbot certonly --dns-cloudflare \
  --dns-cloudflare-credentials /root/.cloudflare.ini \
  -d yourdomain.com -d '*.yourdomain.com'
```

---

## API Keys & Integrations

All API keys are optional and can be added anytime. Edit the `.env` file:

```bash
sudo nano /opt/gametaverns/.env
```

### Cloudflare Turnstile (Bot Protection)
```bash
TURNSTILE_SECRET_KEY=your_secret_key
TURNSTILE_SITE_KEY=your_site_key
```
Get keys: https://dash.cloudflare.com → Turnstile

### Perplexity AI (Game Metadata)
```bash
PERPLEXITY_API_KEY=pplx-...
```
Get key: https://www.perplexity.ai/settings/api

### Firecrawl (URL Scraping)
```bash
FIRECRAWL_API_KEY=fc-...
```
Get key: https://firecrawl.dev/

### BoardGameGeek API
```bash
BGG_API_TOKEN=your_token
```
Optional - improves reliability of BGG imports.

### Discord Integration
```bash
DISCORD_BOT_TOKEN=...
DISCORD_CLIENT_ID=...
DISCORD_CLIENT_SECRET=...
```
Create app: https://discord.com/developers/applications

**After editing .env, restart the API:**
```bash
pm2 restart gametaverns-api
```

---

## Daily Management

### Health Dashboard

```bash
./scripts/health-check.sh          # Full health dashboard
./scripts/health-check.sh --quiet  # Only show failures (for cron)
./scripts/health-check.sh --json   # JSON output for monitoring
```

### View Logs

```bash
./scripts/view-logs.sh             # All recent logs
./scripts/view-logs.sh api -f      # Follow API logs
./scripts/view-logs.sh nginx -e    # Nginx errors only
./scripts/view-logs.sh -s "error"  # Search all logs
pm2 logs gametaverns-api           # PM2 API logs directly
```

### Restart Services

```bash
./scripts/restart-all.sh           # Restart everything
pm2 restart gametaverns-api        # Restart API only
sudo systemctl reload nginx        # Reload web server
```

### Backup & Restore

```bash
./scripts/backup.sh              # Quick database backup
./scripts/backup.sh --full       # Database + uploads + mail config
./scripts/restore.sh <file.gz>   # Restore from backup
```

Backup retention: 7 days (database), 30 days (full).

### Update to Latest Version

```bash
./scripts/update.sh
```

The update script:
1. Creates a backup before updating
2. Stashes any local changes
3. Pulls latest code from GitHub
4. Rebuilds frontend and backend
5. Applies database migrations (idempotent)
6. Verifies critical tables exist
7. Restarts services

### Mail Account Management

```bash
./scripts/add-mail-user.sh list                    # List all accounts
./scripts/add-mail-user.sh add user@domain.com    # Add account
./scripts/add-mail-user.sh passwd user@domain.com # Change password
./scripts/add-mail-user.sh remove user@domain.com # Remove account
```

### Automated Maintenance

Set up automated backups, health checks, and cleanup:

```bash
sudo ./scripts/setup-cron.sh
```

This configures:
- **Daily backups** at 3:00 AM
- **Health checks** every 5 minutes
- **Log rotation** weekly
- **Token cleanup** daily
- **SSL renewal** twice daily

---

## Troubleshooting

### Quick Diagnostics

```bash
./scripts/health-check.sh     # Shows all service status
./scripts/view-logs.sh -e     # Shows recent errors
```

### API won't start

```bash
pm2 logs gametaverns-api --lines 50  # Check error logs
cat /opt/gametaverns/.env            # Verify config
pm2 restart gametaverns-api          # Restart
```

### Database connection issues

```bash
sudo -u postgres psql -d gametaverns -c "SELECT 1"  # Test connection
sudo systemctl status postgresql                     # Check service
```

### Emails not sending

```bash
echo "Test" | mail -s "Test" you@example.com  # Send test
mailq                                          # Check queue
tail -f /var/log/mail.log                      # Watch logs
```

### 502 Bad Gateway

```bash
curl http://localhost:3001/health   # API responding?
sudo nginx -t                       # Config valid?
pm2 restart gametaverns-api         # Restart API
```

### Missing tables after update

```bash
# Re-run migrations
sudo -u postgres psql -d gametaverns -f /opt/gametaverns/deploy/native/migrations/01-schema.sql
sudo -u postgres psql -d gametaverns -f /opt/gametaverns/deploy/native/migrations/02-totp-2fa.sql
```

### Security Audit

```bash
sudo ./scripts/security-audit.sh
```

Checks firewall, SSH config, SSL, file permissions, and more.

---

## File Locations

| What | Where |
|------|-------|
| Application | `/opt/gametaverns` |
| Frontend build | `/opt/gametaverns/app` |
| Backend build | `/opt/gametaverns/server/dist` |
| Uploads | `/opt/gametaverns/uploads` |
| Logs | `/opt/gametaverns/logs` |
| Backups | `/opt/gametaverns/backups` |
| Config | `/opt/gametaverns/.env` |
| Credentials | `/root/gametaverns-credentials.txt` |
| Install log | `/var/log/gametaverns-install.log` |

---

## Environment Variables

Key configuration in `/opt/gametaverns/.env`:

```bash
# Database
DATABASE_URL=postgresql://gametaverns:PASSWORD@localhost:5432/gametaverns

# Security (auto-generated)
JWT_SECRET=...
PII_ENCRYPTION_KEY=...

# Site
SITE_URL=https://yourdomain.com
SITE_NAME=GameTaverns

# Features (all enabled by default)
FEATURE_LENDING=true
FEATURE_ACHIEVEMENTS=true
FEATURE_EVENTS=true
FEATURE_PLAY_LOGS=true
FEATURE_WISHLIST=true
FEATURE_MESSAGING=true
FEATURE_RATINGS=true
```

---

## Management Interfaces

| Interface | URL | Purpose |
|-----------|-----|---------|
| **Application** | `https://yourdomain.com` | Main platform |
| **Cockpit** | `https://YOUR_IP:9090` | Server management GUI |
| **Roundcube** | `https://mail.yourdomain.com` | Webmail |

---

## Script Reference

| Script | Purpose |
|--------|---------|
| `bootstrap.sh` | Prepare fresh Ubuntu server |
| `install.sh` | Full installation |
| `preflight-check.sh` | Pre-install validation |
| `health-check.sh` | System health dashboard |
| `security-audit.sh` | Security vulnerability scan |
| `backup.sh` | Create backups |
| `restore.sh` | Restore from backup |
| `update.sh` | Update to latest version |
| `setup-ssl.sh` | Configure SSL certificates |
| `setup-cron.sh` | Set up automated maintenance |
| `view-logs.sh` | Centralized log viewer |
| `add-mail-user.sh` | Manage mail accounts |
| `create-admin.sh` | Create admin user |
| `restart-all.sh` | Restart all services |
| `rebuild-config.sh` | Regenerate runtime config |

---

## Security Checklist

- [ ] Firewall enabled (`sudo ufw status`)
- [ ] SSL certificates installed (`./scripts/setup-ssl.sh`)
- [ ] Fail2ban running (`systemctl status fail2ban`)
- [ ] Strong passwords (check `/root/gametaverns-credentials.txt`)
- [ ] Regular backups (`./scripts/setup-cron.sh`)
- [ ] Database access restricted to localhost
- [ ] SSH key authentication (disable password auth)

---

## Support

- **GitHub Issues**: https://github.com/GameTaverns/GameTaverns/issues
- **Documentation**: This file and the scripts themselves
- **Email**: admin@gametaverns.com

---

**Happy gaming! 🎲**
