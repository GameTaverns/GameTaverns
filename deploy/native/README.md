# GameTaverns Native Deployment

One-command installation for Ubuntu 24.04 LTS.

## Quick Start

```bash
# On your fresh Ubuntu 24.04 server:

git clone https://github.com/GameTaverns/GameTaverns.git /opt/gametaverns
cd /opt/gametaverns/deploy/native
chmod +x install.sh
sudo ./install.sh
```

That's it! The installer will:
1. Install all dependencies (PostgreSQL 16, Node.js 22, Nginx)
2. Set up the database with full schema
3. Configure your domain and mail server
4. Create your admin account
5. Start everything with PM2

**Time**: ~15 minutes

## Before You Start

Make sure you have:
- [ ] A fresh Ubuntu 24.04 server (VPS from DigitalOcean, Linode, Hetzner, etc.)
- [ ] Root/sudo access
- [ ] A domain name (e.g., `gametaverns.com`)

### Optional Pre-Check

```bash
# Verify your server meets requirements:
sudo ./scripts/preflight-check.sh
```

## What Gets Installed

| Component | Version | Purpose |
|-----------|---------|---------|
| PostgreSQL | 16 | Database |
| Node.js | 22 LTS | Runtime |
| PM2 | Latest | Process manager |
| Nginx | Latest | Reverse proxy |
| Postfix | Latest | Outgoing mail (SMTP) |
| Dovecot | Latest | Incoming mail (IMAP/POP3) |
| SOGo | Latest | Webmail + Calendar + Contacts |
| Cockpit | Latest | Server management GUI |

## Database Schema (v2.3.0)

The migration creates all tables needed for the full-featured platform:

### Core Tables
- `users`, `user_profiles`, `user_roles`
- `libraries`, `library_settings`, `library_suspensions`
- `games`, `game_mechanics`, `game_admin_data`

### Community Features
- `library_members` - Community membership with roles
- `library_followers` - Follow libraries for updates
- `game_loans` - Lending system with full workflow
- `borrower_ratings` - Reputation system for borrowers

### Engagement Features
- `game_sessions`, `game_session_players` - Play logging
- `game_polls`, `poll_options`, `poll_votes` - Game night voting
- `game_night_rsvps` - Event attendance tracking
- `library_events` - Calendar events
- `achievements`, `user_achievements` - Gamification system

### Communication
- `game_messages` - Encrypted contact form messages
- `game_wishlist`, `game_ratings` - Guest interactions
- `notification_preferences`, `notification_log` - Notification system

## After Installation

### 1. Set Up DNS

Point these records to your server's IP address:

| Type | Name | Value |
|------|------|-------|
| A | @ | `YOUR_SERVER_IP` |
| A | * | `YOUR_SERVER_IP` |
| A | mail | `YOUR_SERVER_IP` |
| MX | @ | `mail.yourdomain.com` (priority: 10) |
| TXT | @ | `v=spf1 ip4:YOUR_SERVER_IP -all` |

### 2. Enable HTTPS

```bash
sudo certbot --nginx -d yourdomain.com -d "*.yourdomain.com" -d mail.yourdomain.com
```

### 3. Done!

Visit `https://yourdomain.com` and log in with your admin account.

## Daily Management

### Health Dashboard

```bash
./scripts/health-check.sh          # Full health dashboard
./scripts/health-check.sh --quiet  # Only show failures (for cron)
./scripts/health-check.sh --json   # JSON output for monitoring
```

The health check monitors:
- PostgreSQL, Nginx, PM2, API status
- Database connections and size
- Disk and memory usage
- SSL certificate expiry
- Backup status and age

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

## Automated Maintenance

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

## Management Interfaces

| Interface | URL | Purpose |
|-----------|-----|---------|
| **Cockpit** | `https://YOUR_IP:9090` | Server management GUI |
| **SOGo** | `https://mail.yourdomain.com` | Webmail, Calendar, Contacts |
| **App** | `https://yourdomain.com` | Main application |

## Security

### Run Security Audit

```bash
sudo ./scripts/security-audit.sh
```

Checks firewall, SSH config, SSL, file permissions, and more.

### Security Checklist

- [ ] Firewall enabled (`sudo ufw status`)
- [ ] SSL certificates installed (`./scripts/setup-ssl.sh`)
- [ ] Fail2ban running (`systemctl status fail2ban`)
- [ ] Strong passwords (check `/root/gametaverns-credentials.txt`)
- [ ] Regular backups (`./scripts/setup-cron.sh`)
- [ ] Database access restricted to localhost

### Fail2ban Jails

The installer configures these jails:
- `sshd` - SSH brute force protection
- `nginx-http-auth` - HTTP auth failures
- `nginx-botsearch` - Bot scanning
- `postfix` - SMTP abuse
- `dovecot` - IMAP/POP3 abuse

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
```

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

## AI Features (Perplexity)

All AI features are powered by Perplexity AI. Add to `/opt/gametaverns/.env`:

```bash
# Perplexity AI - powers ALL AI features:
# - Game recommendations
# - Description enhancement/condensing
# - Game metadata enrichment from URLs
PERPLEXITY_API_KEY=pplx-...

# For URL scraping (optional, complements Perplexity)
FIRECRAWL_API_KEY=fc-...
```

Get keys at:
- **Perplexity**: https://perplexity.ai/settings/api (recommended)
- Firecrawl: https://firecrawl.dev/

Then restart: `pm2 restart gametaverns-api`

## BoardGameGeek Integration

For enhanced BGG collection imports, add your BGG API token:

```bash
BGG_API_TOKEN=your_bgg_api_token
```

This enables authenticated API access for more reliable collection synchronization.

## Discord Integration (Optional)

```bash
DISCORD_BOT_TOKEN=...
DISCORD_CLIENT_ID=...
DISCORD_CLIENT_SECRET=...
```

Then restart: `pm2 restart gametaverns-api`

## Script Reference

| Script | Purpose |
|--------|---------|
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

## Support

- **GitHub Issues**: https://github.com/GameTaverns/GameTaverns/issues
- **Email**: admin@gametaverns.com
