# Mailcow Mail Server Setup for GameTaverns

This guide covers installing Mailcow as your full mail stack (SMTP + IMAP) alongside GameTaverns.

## Overview

Mailcow provides:
- **Postfix** - SMTP (outbound/inbound mail)
- **Dovecot** - IMAP/POP3 (mail retrieval)
- **SOGo** - Webmail, calendar, contacts
- **Rspamd** - Spam filtering
- **ClamAV** - Antivirus scanning
- **Automatic SSL** via Let's Encrypt

## Prerequisites

1. **Separate subdomain** - `mail.gametaverns.com` (or your domain)
2. **Ports available** - 25, 80, 110, 143, 443, 465, 587, 993, 995, 4190
3. **Minimum 4GB RAM** (6GB+ recommended with ClamAV)
4. **VPS allows mail ports** - Some providers block port 25

## Step 1: DNS Configuration

Add these DNS records (replace `YOUR_SERVER_IP` and `gametaverns.com`):

```
# A Records
mail.gametaverns.com.     A       YOUR_SERVER_IP
autodiscover.gametaverns.com.  A  YOUR_SERVER_IP
autoconfig.gametaverns.com.    A  YOUR_SERVER_IP

# MX Record (mail exchange)
gametaverns.com.          MX  10  mail.gametaverns.com.

# SPF Record (sender policy)
gametaverns.com.          TXT     "v=spf1 mx a:mail.gametaverns.com -all"

# DKIM (add after Mailcow generates it - Step 4)
dkim._domainkey.gametaverns.com.  TXT  "v=DKIM1; k=rsa; p=..."

# DMARC Record
_dmarc.gametaverns.com.   TXT     "v=DMARC1; p=quarantine; rua=mailto:postmaster@gametaverns.com"

# PTR Record (reverse DNS - set via VPS provider)
# YOUR_SERVER_IP should resolve to mail.gametaverns.com
```

## Step 2: Install Mailcow

Mailcow runs as a separate Docker Compose stack. Install it in `/opt/mailcow`:

```bash
# Install prerequisites
apt update && apt install -y git curl

# Clone Mailcow
cd /opt
git clone https://github.com/mailcow/mailcow-dockerized mailcow
cd mailcow

# Generate configuration
./generate_config.sh
```

When prompted:
- **Mail server hostname**: `mail.gametaverns.com`
- **Timezone**: Your timezone (e.g., `America/New_York`)

## Step 3: Configure Mailcow

Edit the generated `mailcow.conf`:

```bash
nano /opt/mailcow/mailcow.conf
```

Key settings:
```bash
# Your mail hostname
MAILCOW_HOSTNAME=mail.gametaverns.com

# Timezone
TZ=America/New_York

# HTTP ports (change if 80/443 conflict with GameTaverns nginx)
HTTP_PORT=8080
HTTPS_PORT=8443
HTTP_BIND=0.0.0.0
HTTPS_BIND=0.0.0.0

# Skip Let's Encrypt if using external SSL
SKIP_LETS_ENCRYPT=n

# Branch
MAILCOW_GIT_BRANCH=master

# Memory limits (reduce if low RAM)
# CLAMD_MEMORY_LIMIT=1024M
```

### Port Conflict Resolution

If GameTaverns nginx uses 80/443, configure Mailcow to use alternate HTTP ports and proxy through nginx:

```bash
# In mailcow.conf
HTTP_PORT=8080
HTTPS_PORT=8443
```

Then add to `/etc/nginx/sites-available/gametaverns`:
```nginx
# Mailcow Webmail
server {
    listen 443 ssl http2;
    server_name mail.gametaverns.com autodiscover.gametaverns.com autoconfig.gametaverns.com;

    ssl_certificate /etc/letsencrypt/live/gametaverns.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/gametaverns.com/privkey.pem;

    location / {
        proxy_pass https://127.0.0.1:8443;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Step 4: Start Mailcow

```bash
cd /opt/mailcow

# Pull images and start
docker compose pull
docker compose up -d

# Check status
docker compose ps
```

Access Mailcow admin at: `https://mail.gametaverns.com` (or your configured port)
- Default login: `admin` / `moohoo`
- **Change this immediately!**

## Step 5: Configure Domain and Mailboxes

In Mailcow admin UI:

1. **Add Domain**:
   - Go to Configuration → Mail Setup → Domains
   - Add `gametaverns.com`

2. **Create Mailboxes**:
   - Go to Configuration → Mail Setup → Mailboxes
   - Create: `noreply@gametaverns.com` (for system emails)
   - Create: `postmaster@gametaverns.com` (required)
   - Create: `admin@gametaverns.com` (optional)

3. **Get DKIM Key**:
   - Go to Configuration → Mail Setup → Domains
   - Click on your domain → DKIM
   - Copy the DKIM TXT record and add to DNS

## Step 6: Configure GameTaverns to Use Mailcow

Update your GameTaverns `.env` file:

```bash
cd /opt/gametaverns
nano .env
```

Set SMTP settings:
```bash
# Mailcow SMTP Configuration
SMTP_HOST=mail.gametaverns.com
SMTP_PORT=587
SMTP_USER=noreply@gametaverns.com
SMTP_PASS=your-mailbox-password
SMTP_FROM=noreply@gametaverns.com
SMTP_SECURE=true
```

Restart GameTaverns auth service to pick up new settings:
```bash
docker compose restart auth
```

## Step 7: Test Email Delivery

```bash
# Test from GameTaverns
cd /opt/gametaverns
source .env

curl -sS -X POST http://localhost:8000/auth/v1/signup \
  -H "apikey: $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"your-test-email@gmail.com","password":"TestPassword123!"}'
```

Check Mailcow logs:
```bash
cd /opt/mailcow
docker compose logs postfix-mailcow --tail=50
```

## Troubleshooting

### Port 25 Blocked
Many cloud providers block port 25. Check with your VPS provider or use a relay:
```bash
# In mailcow.conf
RELAYHOST=smtp.sendgrid.net:587
RELAYHOST_USERNAME=apikey
RELAYHOST_PASSWORD=your-sendgrid-api-key
```

### SSL Certificate Issues
If using external nginx SSL, tell Mailcow to skip its own SSL:
```bash
# In mailcow.conf
SKIP_LETS_ENCRYPT=y
```

### Check Mail Queue
```bash
cd /opt/mailcow
docker compose exec postfix-mailcow postqueue -p
```

### View Logs
```bash
# All Mailcow logs
docker compose logs -f

# Specific services
docker compose logs postfix-mailcow
docker compose logs dovecot-mailcow
docker compose logs rspamd-mailcow
```

## Maintenance

### Updates
```bash
cd /opt/mailcow
./update.sh
```

### Backups
```bash
cd /opt/mailcow
./helper-scripts/backup_and_restore.sh backup
```

### Resource Usage
Mailcow is resource-intensive. Monitor with:
```bash
docker stats
```

To reduce memory usage, disable ClamAV:
```bash
# In mailcow.conf
SKIP_CLAMD=y
docker compose up -d
```

## Integration Summary

After setup, your architecture will be:

```
                    ┌─────────────────────────────────────┐
                    │           Host Nginx                │
                    │         (SSL Termination)           │
                    └─────────────┬───────────────────────┘
                                  │
        ┌─────────────────────────┼─────────────────────────┐
        │                         │                         │
        ▼                         ▼                         ▼
┌───────────────┐       ┌─────────────────┐       ┌─────────────────┐
│  GameTaverns  │       │    Mailcow      │       │    Mailcow      │
│   App :3000   │       │  Webmail :8443  │       │   SMTP :587     │
│   API :8000   │       │                 │       │   IMAP :993     │
└───────────────┘       └─────────────────┘       └─────────────────┘
        │                                                   ▲
        │              SMTP Authentication                  │
        └───────────────────────────────────────────────────┘
```

GameTaverns sends auth emails via Mailcow SMTP, and you can access webmail at `mail.gametaverns.com`.
