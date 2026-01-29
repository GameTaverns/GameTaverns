# GameTaverns Native Deployment

Complete guide for deploying GameTaverns on a fresh **Ubuntu 24.04 LTS** server.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLOUDFLARE                               │
│   DNS + Proxy + SSL Termination + DDoS Protection              │
│   *.gametaverns.com → Your Server IP                           │
└──────────────────────────────┬──────────────────────────────────┘
                               │ HTTPS (443)
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                         NGINX                                   │
│   Reverse Proxy + Static Files + Rate Limiting                 │
│   Port 80/443 → localhost:3000 (frontend)                      │
│                → localhost:3001 (API)                           │
└──────────────────────────────┬──────────────────────────────────┘
                               │
          ┌────────────────────┼────────────────────┐
          ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   FRONTEND      │  │   API SERVER    │  │   MAIL SERVER   │
│   (Static)      │  │   (Express)     │  │   (Postfix)     │
│   Vite build    │  │   Node.js 22    │  │   + Dovecot     │
│   served by     │  │   PM2 managed   │  │                 │
│   Nginx         │  │   Port 3001     │  │   SMTP/IMAP     │
└─────────────────┘  └────────┬────────┘  └─────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │   POSTGRESQL    │
                    │   Version 16    │
                    │   Port 5432     │
                    └─────────────────┘
```

## Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/GameTaverns/GameTaverns.git /opt/gametaverns
cd /opt/gametaverns/deploy/native

# 2. Run the installer
sudo ./install.sh

# 3. Configure your domain in Cloudflare
# 4. Create the first admin user
./create-admin.sh
```

## Prerequisites

- **Ubuntu 24.04 LTS** (fresh install recommended)
- **Root or sudo access**
- **Domain name** pointed to your server (e.g., `gametaverns.com`)
- **Cloudflare account** (free tier works)
- Minimum **2 CPU cores, 4GB RAM, 20GB SSD**

## Components Installed

| Component | Version | Purpose |
|-----------|---------|---------|
| PostgreSQL | 16 | Database |
| Node.js | 22 LTS | JavaScript runtime |
| PM2 | Latest | Process manager |
| Nginx | Latest | Reverse proxy |
| Postfix | Latest | Outgoing email (SMTP) |
| Dovecot | Latest | Incoming email (IMAP) |
| Roundcube | Latest | Webmail interface |
| **Cockpit** | Latest | **Web-based server management GUI** |
| Certbot | Latest | SSL certificates (optional) |

## Management Interfaces

After installation, you'll have access to these web interfaces:

| Interface | URL | Purpose |
|-----------|-----|---------|
| **Cockpit** | `https://<server-ip>:9090` | Server management GUI (logs, services, terminal, storage) |
| **Roundcube** | `http://mail.yourdomain.com` | Webmail for admin/legal/support accounts |
| **App** | `https://yourdomain.com` | Your GameTaverns application |

### Cockpit Features

Cockpit provides a modern web-based GUI for server administration:

- **System Overview**: CPU, RAM, disk usage in real-time
- **Logs**: Browse systemd journal logs (filter by service, time, severity)
- **Services**: Start/stop/restart PM2, Nginx, PostgreSQL, Postfix, Dovecot
- **Terminal**: Full browser-based SSH terminal
- **Storage**: Manage disks, partitions, and mounts
- **Networking**: Configure interfaces, firewall rules
- **Updates**: View and install system package updates

Login with your server's root or sudo user credentials.

## Directory Structure

```
/opt/gametaverns/
├── app/                    # Frontend build (served by Nginx)
├── server/                 # Express API server
├── uploads/                # User uploads (logos, images)
├── backups/                # Database backups
├── logs/                   # Application logs
└── deploy/native/          # Deployment scripts
    ├── install.sh          # Main installer
    ├── config.env.example  # Environment template
    ├── nginx/              # Nginx configurations
    ├── systemd/            # Service files
    └── scripts/            # Maintenance scripts
```

## Configuration

### Environment Variables

Copy and edit the environment file:

```bash
cp /opt/gametaverns/deploy/native/config.env.example /opt/gametaverns/.env
nano /opt/gametaverns/.env
```

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://gametaverns:password@localhost:5432/gametaverns` |
| `JWT_SECRET` | 32+ character secret for auth | `openssl rand -base64 32` |
| `SITE_URL` | Your domain with https | `https://gametaverns.com` |
| `SMTP_HOST` | Mail server hostname | `localhost` or `mail.gametaverns.com` |

### Optional AI Features

| Variable | Description |
|----------|-------------|
| `PERPLEXITY_API_KEY` | Perplexity AI for game enrichment |
| `FIRECRAWL_API_KEY` | Web scraping for BGG imports |
| `OPENAI_API_KEY` | Alternative AI provider |

## Cloudflare Setup

### DNS Records

Create these DNS records pointing to your server IP:

| Type | Name | Content | Proxy |
|------|------|---------|-------|
| A | @ | `YOUR_SERVER_IP` | ✅ Proxied |
| A | * | `YOUR_SERVER_IP` | ✅ Proxied |
| A | mail | `YOUR_SERVER_IP` | ❌ DNS only |
| MX | @ | `mail.gametaverns.com` | N/A |
| TXT | @ | `v=spf1 mx a ~all` | N/A |

### SSL/TLS Settings

1. Go to **SSL/TLS** → **Overview**
2. Set mode to **Full (strict)**
3. Enable **Always Use HTTPS**
4. Enable **Automatic HTTPS Rewrites**

### Firewall Rules (Recommended)

1. **Allow only Cloudflare IPs** to ports 80/443
2. Allow port **25** (SMTP) for email
3. Allow port **22** (SSH) for management

## Email Configuration

### Self-Hosted Mail (Postfix + Dovecot)

The installer sets up Postfix for sending and optionally Dovecot for receiving.

**Sending emails works out of the box** for:
- Email verification
- Password reset
- Contact form responses

### DNS for Email Deliverability

Add these records for best deliverability:

```
Type: TXT
Name: @
Value: v=spf1 mx a ip4:YOUR_SERVER_IP ~all

Type: TXT
Name: _dmarc
Value: v=DMARC1; p=quarantine; rua=mailto:admin@gametaverns.com

Type: TXT
Name: mail._domainkey
Value: [DKIM key - generated by installer]
```

## Maintenance

### View Logs

```bash
# API server logs
pm2 logs gametaverns-api

# Nginx access logs
tail -f /var/log/nginx/gametaverns-access.log

# Nginx error logs
tail -f /var/log/nginx/gametaverns-error.log

# Mail logs
tail -f /var/log/mail.log
```

### Database Backup

```bash
# Manual backup
/opt/gametaverns/deploy/native/scripts/backup.sh

# Backups are stored in /opt/gametaverns/backups/
ls -la /opt/gametaverns/backups/
```

### Update Application

```bash
cd /opt/gametaverns
git pull origin main
./deploy/native/scripts/update.sh
```

### Restart Services

```bash
# Restart API
pm2 restart gametaverns-api

# Restart Nginx
sudo systemctl restart nginx

# Restart all
/opt/gametaverns/deploy/native/scripts/restart-all.sh
```

## Troubleshooting

### Common Issues

**API not starting:**
```bash
# Check PM2 status
pm2 status

# Check logs
pm2 logs gametaverns-api --lines 50

# Verify environment
cat /opt/gametaverns/.env
```

**Database connection failed:**
```bash
# Test connection
sudo -u postgres psql -d gametaverns -c "SELECT 1"

# Check PostgreSQL status
sudo systemctl status postgresql
```

**Emails not sending:**
```bash
# Test mail
echo "Test" | mail -s "Test" your@email.com

# Check mail queue
mailq

# Check logs
tail -f /var/log/mail.log
```

**502 Bad Gateway:**
```bash
# Check if API is running
curl http://localhost:3001/health

# Check Nginx config
sudo nginx -t
```

## Security Checklist

- [ ] Change default database password
- [ ] Generate strong JWT_SECRET (32+ chars)
- [ ] Enable Cloudflare proxy for all records
- [ ] Set up fail2ban for SSH
- [ ] Configure automatic backups
- [ ] Enable automatic security updates
- [ ] Set up monitoring (optional)

## Support

- **Documentation**: https://docs.gametaverns.com
- **GitHub Issues**: https://github.com/GameTaverns/GameTaverns/issues
- **Email**: admin@gametaverns.com
