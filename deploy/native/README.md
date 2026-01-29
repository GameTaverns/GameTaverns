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
pm2 status                  # Is the API running?
pm2 logs gametaverns-api    # View recent logs
```

### Restart Services

```bash
pm2 restart gametaverns-api  # Restart API
sudo systemctl reload nginx  # Reload web server
```

### Backup & Restore

```bash
./scripts/backup.sh              # Backup database
./scripts/backup.sh --full       # Backup database + uploads
./scripts/restore.sh <file.gz>   # Restore from backup
```

### Update to Latest Version

```bash
./scripts/update.sh
```

### Add a Mail Account

```bash
./scripts/add-mail-user.sh user@yourdomain.com
```

## Management Interfaces

| Interface | URL |
|-----------|-----|
| **Cockpit** (Server GUI) | `https://YOUR_IP:9090` |
| **Roundcube** (Webmail) | `http://mail.yourdomain.com` |
| **App** | `https://yourdomain.com` |

## Troubleshooting

### API won't start

```bash
pm2 logs gametaverns-api --lines 50  # Check error logs
cat /opt/gametaverns/.env            # Verify config
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
# Get key at: https://www.perplexity.ai/settings/api
PERPLEXITY_API_KEY=your_key_here

# Get key at: https://firecrawl.dev/
FIRECRAWL_API_KEY=your_key_here
```

Then restart: `pm2 restart gametaverns-api`

## Security Checklist

- [ ] Changed default passwords (auto-generated, check credentials file)
- [ ] SSL enabled (`certbot --nginx`)
- [ ] Firewall active (`sudo ufw status`)
- [ ] Regular backups (`./scripts/backup.sh` in cron)
- [ ] Server updates (`apt update && apt upgrade`)

## Support

- **GitHub Issues**: https://github.com/GameTaverns/GameTaverns/issues
- **Email**: admin@gametaverns.com
