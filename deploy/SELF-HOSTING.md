# Self-Hosting Game Haven

Complete guide to running Game Haven on your own infrastructure.

## Architecture

```
┌─────────────────────┐      ┌─────────────────────┐
│   Cloudron Server   │      │   Supabase Server   │
│   (Game Haven UI)   │─────▶│   (Database + API)  │
│   games.your.domain │      │   db.your.domain    │
└─────────────────────┘      └─────────────────────┘
```

---

## Part 1: Self-Host Supabase

### Option A: Docker Compose (Recommended)

**Requirements:** Ubuntu 22.04+, 4GB RAM, Docker

```bash
# 1. Clone Supabase
git clone --depth 1 https://github.com/supabase/supabase
cd supabase/docker

# 2. Copy environment template
cp .env.example .env

# 3. Generate secure secrets
sed -i "s|POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$(openssl rand -base64 32)|" .env
sed -i "s|JWT_SECRET=.*|JWT_SECRET=$(openssl rand -base64 64)|" .env
sed -i "s|ANON_KEY=.*|ANON_KEY=$(openssl rand -base64 32)|" .env
sed -i "s|SERVICE_ROLE_KEY=.*|SERVICE_ROLE_KEY=$(openssl rand -base64 32)|" .env

# 4. Set your domain
sed -i "s|SITE_URL=.*|SITE_URL=https://db.yourdomain.com|" .env
sed -i "s|API_EXTERNAL_URL=.*|API_EXTERNAL_URL=https://db.yourdomain.com|" .env

# 5. Start Supabase
docker compose up -d
```

### Option B: Single Server Script

```bash
curl -fsSL https://raw.githubusercontent.com/supabase/supabase/master/docker/setup.sh | bash
```

### Get Your Credentials

After Supabase is running, get these values from `.env`:

| What | .env Variable | Use In Cloudron |
|------|---------------|-----------------|
| API URL | `API_EXTERNAL_URL` | `SUPABASE_URL` |
| Anon Key | `ANON_KEY` | `SUPABASE_ANON_KEY` |
| Service Key | `SERVICE_ROLE_KEY` | For edge functions |

---

## Part 2: Setup Database

### Run Migrations

Connect to your Supabase Studio (usually `http://your-server:3000`) and run the SQL from each file in `supabase/migrations/` in order.

Or use the CLI:

```bash
# Install Supabase CLI
npm install -g supabase

# Link to your self-hosted instance
supabase link --project-ref local --db-url postgresql://postgres:YOUR_PASSWORD@db.yourdomain.com:5432/postgres

# Run migrations
supabase db push
```

### Create Admin User

1. Sign up through the Game Haven UI
2. Get your user ID from Supabase Studio → Authentication → Users
3. Run this SQL:

```sql
INSERT INTO public.user_roles (user_id, role)
VALUES ('your-user-uuid-here', 'admin');
```

---

## Part 3: Deploy Game Haven to Cloudron

### Build & Push

```bash
# Clone the repo
git clone https://github.com/ThaneWinters/GameTavern.git
cd GameTavern

# Build for your registry
docker build -t registry.yourdomain.com/gamehaven:1.0.0 -f deploy/cloudron/Dockerfile .

# Push
docker push registry.yourdomain.com/gamehaven:1.0.0

# Install on Cloudron
cd deploy/cloudron
cloudron install --image registry.yourdomain.com/gamehaven:1.0.0
```

### Configure Environment

In Cloudron dashboard → Apps → Game Haven → Environment Variables:

```
SUPABASE_URL=https://db.yourdomain.com
SUPABASE_ANON_KEY=your-anon-key-from-step-1
SITE_NAME=My Game Collection
```

---

## Part 4: SSL & Networking

### Supabase Server (Nginx)

```nginx
server {
    listen 443 ssl http2;
    server_name db.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/db.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/db.yourdomain.com/privkey.pem;

    # Kong API Gateway
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Get SSL certificate:
```bash
sudo certbot --nginx -d db.yourdomain.com
```

---

## Verification

### Test Supabase

```bash
curl https://db.yourdomain.com/rest/v1/ \
  -H "apikey: YOUR_ANON_KEY"
# Should return: []
```

### Test Game Haven

```bash
curl https://games.yourdomain.com/health
# Should return: {"status":"healthy"}
```

---

## Maintenance

### Backup Database

```bash
docker exec supabase-db pg_dump -U postgres > backup-$(date +%Y%m%d).sql
```

### Update Supabase

```bash
cd supabase/docker
docker compose pull
docker compose up -d
```

### Update Game Haven

```bash
docker build -t registry.yourdomain.com/gamehaven:1.0.1 -f deploy/cloudron/Dockerfile .
docker push registry.yourdomain.com/gamehaven:1.0.1
cloudron update --image registry.yourdomain.com/gamehaven:1.0.1
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| CORS errors | Add your Cloudron domain to Supabase's `ADDITIONAL_REDIRECT_URLS` |
| Auth not working | Ensure `SITE_URL` in Supabase matches your Cloudron app URL |
| Database connection refused | Check firewall allows port 5432 from Cloudron server |
| Edge functions failing | Set `SUPABASE_SERVICE_ROLE_KEY` in Cloudron secrets |

---

## Resource Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| Supabase Server | 4GB RAM, 2 CPU | 8GB RAM, 4 CPU |
| Cloudron (Game Haven) | 512MB RAM | 1GB RAM |
| Disk Space | 20GB | 50GB+ |
