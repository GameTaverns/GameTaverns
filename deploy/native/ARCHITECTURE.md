# GameTaverns Native Deployment Architecture

## Complete Self-Hosted Stack for 1:1 Feature Parity

This document outlines everything needed to replicate the Lovable Cloud platform on a fresh Ubuntu 24.04 server.

---

## 📦 Component Overview

| Component | Purpose | Self-Hosted Solution |
|-----------|---------|----------------------|
| **Database** | Multi-tenant data storage | PostgreSQL 16 |
| **Authentication** | User login, JWT tokens | Express + bcrypt + custom JWT |
| **API Server** | Business logic | Node.js/Express (port 3001) |
| **Frontend** | React SPA | Vite build → Nginx |
| **File Storage** | Uploads (logos, etc.) | Local filesystem + Nginx |
| **Email (Transactional)** | Verification, password reset | Postfix (localhost SMTP) |
| **Email (Mailboxes)** | Staff accounts | Dovecot (IMAP) + Roundcube (Webmail) |
| **Reverse Proxy** | SSL, routing | Nginx |
| **Process Manager** | Keep services running | PM2 |
| **Server Management** | GUI dashboard | Cockpit (port 9090) |
| **Firewall** | Security | UFW + Fail2ban |

---

## 🔌 External APIs (Bring Your Own Keys)

| Service | Purpose | Required? | Config Variable |
|---------|---------|-----------|-----------------|
| **Cloudflare Turnstile** | Bot protection on forms | Recommended | `TURNSTILE_SECRET_KEY`, `TURNSTILE_SITE_KEY` |
| **Perplexity AI** | Game metadata enrichment | Optional | `PERPLEXITY_API_KEY` |
| **Firecrawl** | URL scraping for imports | Optional | `FIRECRAWL_API_KEY` |
| **Discord** | Bot notifications, OAuth | Optional | `DISCORD_BOT_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` |
| **BoardGameGeek** | Game data lookup | Built-in | No key needed (public XML API) |

---

## 🗂 Directory Structure

```
/opt/gametaverns/
├── .env                      # Production configuration
├── app/                      # Built frontend (served by Nginx)
├── server/
│   ├── dist/                 # Compiled Express API
│   └── src/                  # TypeScript source
├── deploy/native/
│   ├── install.sh            # Main installer
│   ├── config.env.example    # Template config
│   ├── migrations/           # SQL schema
│   └── scripts/              # Management tools
├── uploads/                  # User-uploaded files
├── backups/                  # Database + full backups
└── logs/                     # Application logs
```

---

## 🔄 API Route Mapping (Edge Functions → Express)

The Express API in `server/src/routes/` replaces all Supabase Edge Functions:

| Edge Function | Express Route | Purpose |
|---------------|---------------|---------|
| `signup` | `POST /api/auth/signup` | User registration |
| `verify-email` | `POST /api/auth/verify-email` | Email confirmation |
| `verify-reset-token` | `POST /api/auth/verify-reset-token` | Password reset validation |
| `send-auth-email` | `POST /api/auth/send-email` | Transactional emails |
| `send-message` | `POST /api/messages` | Contact form (encrypted PII) |
| `decrypt-messages` | `GET /api/messages` | Admin message viewing |
| `bgg-import` | `POST /api/bgg/import` | Bulk BGG collection import |
| `bgg-lookup` | `GET /api/bgg/search` | BGG game search |
| `game-import` | `POST /api/games/import` | Import from URL |
| `game-recommendations` | `GET /api/ai/recommendations` | AI game suggestions |
| `condense-descriptions` | `POST /api/ai/condense` | AI description cleanup |
| `rate-game` | `POST /api/ratings` | Guest star ratings |
| `wishlist` | `POST /api/wishlist` | Guest wishlist votes |
| `image-proxy` | `GET /api/image-proxy` | BGG image proxying |
| `discord-notify` | `POST /api/discord/notify` | Webhook notifications |
| `discord-send-dm` | `POST /api/discord/dm` | Direct messages via bot |
| `discord-create-event` | `POST /api/events/discord` | Discord scheduled events |
| `discord-forum-post` | `POST /api/discord/forum` | Forum thread creation |
| `discord-oauth-callback` | `GET /api/discord/callback` | OAuth account linking |
| `discord-unlink` | `POST /api/discord/unlink` | Disconnect Discord |
| `manage-users` | `GET/POST /api/admin/users` | Platform user management |
| `sync-achievements` | `POST /api/achievements/sync` | Achievement calculation |
| `refresh-images` | `POST /api/games/refresh-images` | Re-fetch BGG images |

---

## 🗄 Database Schema

Full PostgreSQL schema in `deploy/native/migrations/01-schema.sql`:

### Core Tables
- `users` - Authentication (email, password_hash)
- `user_profiles` - Public profile info (display_name, avatar, discord_user_id)
- `user_roles` - Authorization (admin, moderator, user) - **SEPARATE for security**

### Multi-Tenant Tables
- `libraries` - Tenant containers (slug, owner_id, custom_domain)
- `library_settings` - Per-tenant config (theme, features, Discord webhooks)
- `library_members` - Community membership with roles
- `library_followers` - Users following libraries
- `library_suspensions` - Audit log for moderation

### Game Tables
- `games` - Core game data with all BGG fields
- `game_mechanics` - Many-to-many mechanic associations
- `game_admin_data` - Private owner data (purchase price/date)
- `game_sessions` + `game_session_players` - Play logging
- `game_messages` - Encrypted contact form messages
- `game_ratings` - Guest star ratings (fraud-resistant)
- `game_wishlist` - Guest "want to play" votes

### Community Features
- `game_loans` - Full lending workflow (request → approve → borrow → return)
- `borrower_ratings` - Reputation system
- `game_polls` + `poll_options` + `poll_votes` - Game night voting
- `game_night_rsvps` - Event attendance
- `library_events` - Calendar events
- `achievements` + `user_achievements` - Gamification

### System Tables
- `email_confirmation_tokens` - Email verification
- `password_reset_tokens` - Password recovery
- `notification_preferences` - Per-user notification settings
- `notification_log` - Notification history
- `platform_feedback` - User feedback/bug reports
- `import_jobs` - BGG import progress tracking
- `site_settings` - Platform-wide configuration

### Reference Tables
- `publishers` - Game publishers
- `mechanics` - Game mechanics

### Views (Performance/Security)
- `libraries_public` - Hides owner_id from anonymous users
- `games_public` - Hides sensitive game data
- `library_settings_public` - Hides webhook URLs
- `library_directory` - Discoverable libraries with stats
- `game_ratings_summary` - Pre-aggregated ratings
- `game_wishlist_summary` - Pre-aggregated wishlist counts

---

## 🔐 Security Model

### Authentication Flow
1. **Signup**: Email + password → hash with bcrypt → store in `users`
2. **Email Verification**: Generate token → send via Postfix → confirm on click
3. **Login**: Verify password → issue JWT (7-day expiry)
4. **Requests**: JWT in `Authorization: Bearer <token>` header

### Authorization
- `user_roles` table stores platform-wide roles
- `has_role(user_id, role)` security definer function
- `library_members` stores per-library roles
- `is_library_member()` and `is_library_moderator()` helper functions

### Data Protection
- PII (messages, emails) encrypted with AES-256-GCM
- Cloudflare Turnstile on public forms
- Rate limiting on all API routes
- Fail2ban for SSH/SMTP/IMAP protection

---

## 📧 Email System

### Transactional Mail (Postfix)
- Runs on localhost, no external SMTP needed
- Sends verification emails, password resets, notifications
- SPF/DKIM records for deliverability

### Staff Mailboxes (Dovecot)
- Virtual mailbox accounts (no system users)
- IMAP access via any mail client
- Roundcube webmail at `mail.yourdomain.com`

### Recommended Accounts
```bash
./scripts/add-mail-user.sh add admin@gametaverns.com   # Platform admin
./scripts/add-mail-user.sh add noreply@gametaverns.com # Transactional sender
./scripts/add-mail-user.sh add legal@gametaverns.com   # Legal notices
./scripts/add-mail-user.sh add support@gametaverns.com # User support
```

---

## 🌐 Nginx Configuration

### Main Site
```nginx
server {
    listen 443 ssl http2;
    server_name gametaverns.com *.gametaverns.com;
    
    # Frontend SPA
    root /opt/gametaverns/app;
    index index.html;
    
    # API proxy
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
    
    # Uploads
    location /uploads/ {
        alias /opt/gametaverns/uploads/;
    }
    
    # SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

---

## ⚡ Installation Checklist

### Pre-Install Requirements
- [ ] Fresh Ubuntu 24.04 VPS (2GB RAM minimum, 4GB recommended)
- [ ] Root/sudo access
- [ ] Domain pointed to server IP (A record for `@` and `*`)
- [ ] Mail subdomain (`mail.yourdomain.com`)

### DNS Records Needed
| Type | Name | Value |
|------|------|-------|
| A | @ | `YOUR_SERVER_IP` |
| A | * | `YOUR_SERVER_IP` |
| A | mail | `YOUR_SERVER_IP` |
| MX | @ | `mail.yourdomain.com` (priority 10) |
| TXT | @ | `v=spf1 ip4:YOUR_SERVER_IP -all` |
| TXT | _dmarc | `v=DMARC1; p=quarantine; rua=mailto:admin@yourdomain.com` |

### Installation Steps
```bash
# 1. Clone repository
git clone https://github.com/GameTaverns/GameTaverns.git /opt/gametaverns
cd /opt/gametaverns/deploy/native

# 2. Run installer (interactive)
sudo ./install.sh

# 3. Set up SSL
sudo ./scripts/setup-ssl.sh

# 4. Add API keys (optional)
nano /opt/gametaverns/.env
# Add: PERPLEXITY_API_KEY, DISCORD_BOT_TOKEN, etc.

# 5. Restart API to apply keys
pm2 restart gametaverns-api
```

### Post-Install API Keys

| Key | Get From | Priority |
|-----|----------|----------|
| `TURNSTILE_SECRET_KEY` | https://dash.cloudflare.com → Turnstile | High |
| `TURNSTILE_SITE_KEY` | Same as above | High |
| `PERPLEXITY_API_KEY` | https://perplexity.ai/settings/api | Medium |
| `FIRECRAWL_API_KEY` | https://firecrawl.dev | Low |
| `DISCORD_BOT_TOKEN` | https://discord.com/developers | Optional |
| `DISCORD_CLIENT_ID` | Same as above | Optional |
| `DISCORD_CLIENT_SECRET` | Same as above | Optional |

---

## 🔧 Maintenance Scripts

| Script | Purpose | Frequency |
|--------|---------|-----------|
| `health-check.sh` | System status dashboard | On-demand |
| `backup.sh` | Database backup | Daily (cron) |
| `backup.sh --full` | Full system backup | Weekly (cron) |
| `update.sh` | Pull & deploy latest code | On release |
| `security-audit.sh` | Vulnerability scan | Monthly |
| `setup-cron.sh` | Configure all automation | Once |

---

## 🆚 Lovable Cloud vs Self-Hosted

| Feature | Lovable Cloud | Self-Hosted |
|---------|--------------|-------------|
| Database | Supabase PostgreSQL | PostgreSQL 16 |
| Auth | Supabase Auth | Custom JWT |
| Edge Functions | Deno (Supabase) | Express routes |
| File Storage | Supabase Storage | Local + Nginx |
| Email | External SMTP | Postfix + Dovecot |
| SSL | Automatic | Certbot |
| Scaling | Automatic | Manual |
| Cost | Subscription | VPS only ($5-20/mo) |
| Control | Limited | Full |
| Backups | Managed | Self-managed |

---

## 📋 Full Feature Checklist

### ✅ Core Features
- [x] Multi-tenant libraries (subdomain routing)
- [x] User authentication (signup, login, password reset)
- [x] Email verification
- [x] JWT-based sessions
- [x] Platform admin panel
- [x] Library settings & branding

### ✅ Game Management
- [x] Game CRUD with all fields
- [x] BGG import (single & bulk)
- [x] BGG metadata lookup
- [x] Image proxying
- [x] Expansion linking
- [x] Game mechanics

### ✅ Community Features
- [x] Library membership
- [x] Game lending system
- [x] Borrower ratings
- [x] Play session logging
- [x] Achievements
- [x] Events calendar
- [x] Game night polls
- [x] RSVP tracking

### ✅ Guest Interactions
- [x] Wishlist voting
- [x] Star ratings
- [x] Contact form (encrypted messages)

### ✅ Integrations
- [x] Discord webhooks
- [x] Discord bot DMs
- [x] Discord OAuth account linking
- [x] Discord scheduled events
- [x] Perplexity AI enrichment
- [x] Firecrawl URL scraping

### ✅ Security
- [x] Cloudflare Turnstile
- [x] Rate limiting
- [x] PII encryption
- [x] Role-based access control
- [x] Secure password hashing

---

## 🚀 Recommended VPS Specs

| Tier | RAM | CPU | Storage | Users |
|------|-----|-----|---------|-------|
| Starter | 2GB | 1 vCPU | 25GB | <100 |
| Standard | 4GB | 2 vCPU | 50GB | 100-500 |
| Growth | 8GB | 4 vCPU | 100GB | 500-2000 |

Recommended providers: Hetzner, DigitalOcean, Linode, Vultr
