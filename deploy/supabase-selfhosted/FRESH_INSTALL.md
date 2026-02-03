# GameTaverns - Complete Fresh Installation Guide

**One-Shot Installation for Ubuntu 24.04 with Mailcow**

This guide incorporates ALL lessons learned from deployment testing. Follow it exactly for a smooth installation.

---

## 🚨 Pre-Flight Checklist

Before you begin, verify:

| Requirement | Minimum | Check Command |
|-------------|---------|---------------|
| Ubuntu | 24.04 LTS | `lsb_release -a` |
| RAM | 4GB (6GB+ for Mailcow+ClamAV) | `free -h` |
| Disk | 30GB free | `df -h /` |
| Ports | 25, 80, 443, 587, 993 unblocked | Contact VPS provider |

### DNS Must Be Configured FIRST

Configure these records **before running any scripts** (replace `YOUR_IP`):

```
gametaverns.com.          A     YOUR_IP
www.gametaverns.com.      A     YOUR_IP
api.gametaverns.com.      A     YOUR_IP
mail.gametaverns.com.     A     YOUR_IP
studio.gametaverns.com.   A     YOUR_IP
*.gametaverns.com.        A     YOUR_IP

gametaverns.com.          MX    10 mail.gametaverns.com.
gametaverns.com.          TXT   "v=spf1 mx a:mail.gametaverns.com -all"
```

Verify propagation:
```bash
dig +short gametaverns.com
dig +short mail.gametaverns.com
```

---

## 📋 Installation Steps

### Step 1: Bootstrap Server (5 minutes)

```bash
# Download and run bootstrap
curl -fsSL https://raw.githubusercontent.com/GameTaverns/GameTaverns/main/deploy/supabase-selfhosted/bootstrap.sh -o /tmp/bootstrap.sh
chmod +x /tmp/bootstrap.sh
sudo /tmp/bootstrap.sh
```

### Step 2: Install Mailcow FIRST (15 minutes)

**Critical: Install Mailcow before GameTaverns to avoid port conflicts.**

```bash
cd /opt
git clone https://github.com/mailcow/mailcow-dockerized mailcow
cd mailcow

# Generate config (answer: mail.gametaverns.com for hostname)
./generate_config.sh
```

Edit `mailcow.conf` to avoid port conflicts with host Nginx:
```bash
nano mailcow.conf
```

Change these lines:
```bash
HTTP_PORT=8080
HTTPS_PORT=8443
HTTP_BIND=127.0.0.1
HTTPS_BIND=127.0.0.1
```

Start Mailcow:
```bash
docker compose pull
docker compose up -d

# Wait for it to fully initialize (2-3 minutes)
docker compose ps
```

**Verify Mailcow is healthy before continuing:**
```bash
# All containers should show "Up" or "healthy"
docker compose ps | grep -E "(Up|healthy)"
```

### Step 3: Clone and Install GameTaverns (20 minutes)

```bash
# Clone repository
git clone https://github.com/GameTaverns/GameTaverns.git /opt/gametaverns
cd /opt/gametaverns/deploy/supabase-selfhosted

# Make scripts executable
chmod +x install.sh scripts/*.sh

# Run installer
sudo ./install.sh
```

The installer will prompt for:
- Admin email and password
- Discord credentials (optional)
- Perplexity API key (recommended for AI features)
- Turnstile keys (recommended for bot protection)
- SMTP settings → **Enter Mailcow SMTP details here**

When prompted for SMTP:
```
External SMTP Host: mail.gametaverns.com
SMTP Port: 587
SMTP User: noreply@gametaverns.com  (create this in Mailcow first!)
SMTP Password: (the password you set in Mailcow)
```

### Step 4: Configure Host Nginx (5 minutes)

Create the main Nginx config:

```bash
sudo nano /etc/nginx/sites-available/gametaverns
```

Paste this configuration:

```nginx
# GameTaverns - Main Site
server {
    listen 80;
    server_name gametaverns.com www.gametaverns.com *.gametaverns.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name gametaverns.com www.gametaverns.com *.gametaverns.com;

    ssl_certificate /etc/letsencrypt/live/gametaverns.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/gametaverns.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;

    # API routes → Kong Gateway
    location /auth/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /rest/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /functions/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /storage/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 50M;
    }

    location /realtime/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }

    # Frontend → App container
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# API subdomain
server {
    listen 443 ssl http2;
    server_name api.gametaverns.com;

    ssl_certificate /etc/letsencrypt/live/gametaverns.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/gametaverns.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 50M;
    }
}

# Studio subdomain
server {
    listen 443 ssl http2;
    server_name studio.gametaverns.com;

    ssl_certificate /etc/letsencrypt/live/gametaverns.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/gametaverns.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Mailcow webmail
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
        proxy_ssl_verify off;
    }
}
```

Enable and test:
```bash
sudo ln -sf /etc/nginx/sites-available/gametaverns /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

### Step 5: Get SSL Certificates (5 minutes)

```bash
# Install Cloudflare DNS plugin for wildcards
sudo apt install -y python3-certbot-dns-cloudflare

# Create Cloudflare credentials
sudo mkdir -p /etc/letsencrypt
sudo nano /etc/letsencrypt/cloudflare.ini
```

Add your Cloudflare API token:
```
dns_cloudflare_api_token = YOUR_CLOUDFLARE_API_TOKEN
```

Secure and get certs:
```bash
sudo chmod 600 /etc/letsencrypt/cloudflare.ini

sudo certbot certonly \
  --dns-cloudflare \
  --dns-cloudflare-credentials /etc/letsencrypt/cloudflare.ini \
  -d gametaverns.com \
  -d "*.gametaverns.com" \
  --email admin@gametaverns.com \
  --agree-tos \
  --non-interactive

# Reload nginx with real certs
sudo systemctl reload nginx
```

### Step 6: Create Mailcow Mailbox (2 minutes)

1. Access Mailcow admin: `https://mail.gametaverns.com` (or `https://YOUR_IP:8443`)
2. Login with default: `admin` / `moohoo`
3. **Change admin password immediately!**
4. Go to **Configuration → Mail Setup → Domains** → Add `gametaverns.com`
5. Go to **Configuration → Mail Setup → Mailboxes** → Create:
   - `noreply@gametaverns.com` (for system emails)
   - `postmaster@gametaverns.com` (required)
6. Copy the DKIM record from **Configuration → ARC/DKIM Keys** and add to DNS

---

## ✅ Verification Checklist

Run these commands to verify everything is working:

```bash
# 1. Check all GameTaverns containers
cd /opt/gametaverns && docker compose ps

# 2. Check all Mailcow containers
cd /opt/mailcow && docker compose ps

# 3. Test API health
curl -s https://gametaverns.com/auth/v1/health | jq

# 4. Test frontend
curl -s -o /dev/null -w "%{http_code}" https://gametaverns.com

# 5. Test mail (send test email)
# Login to https://gametaverns.com, try password reset
```

---

## 🔧 Troubleshooting

### Port 993 Already in Use

```bash
# Find what's using it
sudo lsof -i :993

# If it's an old GameTaverns mail container
docker stop gametaverns-mail gametaverns-roundcube 2>/dev/null
docker rm gametaverns-mail gametaverns-roundcube 2>/dev/null

# If it's Mailcow's dovecot (expected)
cd /opt/mailcow && docker compose ps dovecot-mailcow
```

### Docker Network Overlap

```bash
# Nuclear option - stop everything, clean networks, restart
cd /opt/mailcow && docker compose down
cd /opt/gametaverns && docker compose down

docker network prune -f

# Start Mailcow first (it claims subnets first)
cd /opt/mailcow && docker compose up -d
sleep 30

# Then GameTaverns
cd /opt/gametaverns && docker compose up -d
```

### Auth Returns 405 or HTML

This means Nginx is routing `/auth/` to the frontend instead of Kong:

```bash
# Verify nginx config has the location blocks for /auth/, /rest/, /functions/
sudo nginx -t
sudo cat /etc/nginx/sites-enabled/gametaverns | grep -A5 "location /auth"
```

### JWT Signature Invalid

```bash
cd /opt/gametaverns

# Regenerate keys (DESTRUCTIVE - existing sessions will be invalidated)
source .env
node -e "
const crypto = require('crypto');
const jwtSecret = crypto.randomBytes(64).toString('base64').slice(0, 64);

function makeJwt(role) {
  const header = Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');
  const now = Math.floor(Date.now()/1000);
  const payload = Buffer.from(JSON.stringify({role,iss:'supabase',iat:now,exp:now+157680000})).toString('base64url');
  const sig = crypto.createHmac('sha256', jwtSecret).update(header+'.'+payload).digest('base64url');
  return header+'.'+payload+'.'+sig;
}

console.log('JWT_SECRET=' + jwtSecret);
console.log('ANON_KEY=' + makeJwt('anon'));
console.log('SERVICE_ROLE_KEY=' + makeJwt('service_role'));
"
```

Update `.env` with new values, then:
```bash
docker compose down
docker compose up -d
```

---

## 📊 Service Ports Reference

| Service | Container Port | Host Port | Notes |
|---------|---------------|-----------|-------|
| **GameTaverns** |
| Frontend | 80 | 3000 | React SPA |
| Kong API | 8000 | 8000 | API Gateway |
| Studio | 3000 | 3001 | Database Admin |
| PostgreSQL | 5432 | 5432 | Database |
| **Mailcow** |
| Nginx (web) | 80/443 | 8080/8443 | Webmail |
| Postfix (SMTP) | 25 | 25 | Inbound mail |
| Postfix (Submission) | 587 | 587 | Outbound mail |
| Dovecot (IMAP) | 993 | 993 | Mail retrieval |

---

## 🔄 Maintenance Commands

```bash
# Update GameTaverns
cd /opt/gametaverns
git pull origin main
docker compose build app
docker compose up -d

# Update Mailcow
cd /opt/mailcow
./update.sh

# Backup database
cd /opt/gametaverns
./scripts/backup.sh

# View logs
docker compose logs -f          # All services
docker compose logs -f auth     # Just auth service
docker compose logs -f functions # Edge functions
```

---

## 🎉 Success!

Your GameTaverns instance should now be running at:

- **Main Site**: https://gametaverns.com
- **API**: https://api.gametaverns.com  
- **Database Studio**: https://studio.gametaverns.com
- **Webmail**: https://mail.gametaverns.com
- **Libraries**: https://{slug}.gametaverns.com

Credentials are saved in `/root/gametaverns-credentials.txt` - **delete after copying!**
