# GameTaverns Native Deployment

One-command installation for Ubuntu 24.04 LTS.

## Quick Start

```bash
# On your fresh Ubuntu 24.04 server:

git clone https://github.com/GameTaverns/GameTaverns.git /opt/gametaverns
cd /opt/gametaverns/deploy/native
sudo ./install.sh
```

That's it! The installer will:
1. Install all dependencies
2. Set up the database
3. Configure your domain
4. Create your admin account
5. Start everything

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

## After Installation

### 1. Set Up DNS

Point these records to your server's IP address:

| Type | Name | Value |
|------|------|-------|
| A | @ | `YOUR_SERVER_IP` |
| A | * | `YOUR_SERVER_IP` |
| A | mail | `YOUR_SERVER_IP` |
| MX | @ | `mail.yourdomain.com` |

### 2. Enable HTTPS

```bash
sudo certbot --nginx -d yourdomain.com -d "*.yourdomain.com" -d mail.yourdomain.com
```

### 3. Done!

Visit `https://yourdomain.com` and log in with your admin account.

## Daily Management

### Check Status

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

### Update to Latest Version

```bash
./scripts/update.sh
```

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

## Management Interfaces

| Interface | URL |
|-----------|-----|
| **Cockpit** (Server GUI) | `https://YOUR_IP:9090` |
| **Roundcube** (Webmail) | `http://mail.yourdomain.com` |
| **App** | `https://yourdomain.com` |

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

## File Locations

| What | Where |
|------|-------|
| Application | `/opt/gametaverns` |
| Uploads | `/opt/gametaverns/uploads` |
| Logs | `/opt/gametaverns/logs` |
| Backups | `/opt/gametaverns/backups` |
| Config | `/opt/gametaverns/.env` |
| Credentials | `/root/gametaverns-credentials.txt` |
| Install log | `/var/log/gametaverns-install.log` |

## AI Features (Optional)

To enable AI-powered game enrichment, add these to `/opt/gametaverns/.env`:

```bash
PERPLEXITY_API_KEY=your_key_here  # https://perplexity.ai/settings/api
FIRECRAWL_API_KEY=your_key_here   # https://firecrawl.dev/
```

Then restart: `pm2 restart gametaverns-api`

## Script Reference

| Script | Purpose |
|--------|---------|
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
| `preflight-check.sh` | Pre-install validation |
| `restart-all.sh` | Restart all services |

## Support

- **GitHub Issues**: https://github.com/GameTaverns/GameTaverns/issues
- **Email**: admin@gametaverns.com
