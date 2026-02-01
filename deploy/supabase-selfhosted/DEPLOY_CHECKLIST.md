# GameTaverns Self-Hosted: Deployment Checklist

**Version:** 2.3.0 - 2FA & Security Hardening  
**Last Audit:** 2026-02-01

Use this checklist before deploying to ensure everything is ready.

## Role Hierarchy (5 Tiers)

| Tier | Role | Description |
|------|------|-------------|
| T1 | `admin` | Super-administrators with full platform control |
| T2 | `staff` | Site staff with elevated privileges |
| T3 | `owner` | Library/community owners (explicit assignment) |
| T4 | `moderator` | Community moderators (library_member_role, per-library) |
| T5 | (none) | Regular users |

**Note:** T4 Moderators have limited abilities within their assigned communities (run polls, remove users, set up events).

## Pre-Deployment Audit (Completed: 2026-02-01)

### ✅ Database Migrations (15 files)

| File | Status | Notes |
|------|--------|-------|
| 01-extensions.sql | ✅ | Extensions schema, uuid-ossp, pgcrypto, unaccent |
| 02-enums.sql | ✅ | **Updated:** app_role now includes 'admin', 'staff', 'owner', 'moderator' for 5-tier hierarchy |
| 03-core-tables.sql | ✅ | user_profiles, user_roles, libraries, library_settings, library_members, library_followers, publishers, mechanics |
| 04-games-tables.sql | ✅ | games, game_admin_data, game_mechanics, game_ratings, game_wishlist, game_messages, game_sessions, game_session_players, game_loans, borrower_ratings - includes genre field |
| 05-events-polls.sql | ✅ | library_events, game_polls, poll_options, poll_votes, game_night_rsvps |
| 06-achievements-notifications.sql | ✅ | achievements, user_achievements, notification_preferences, notification_log, push_subscriptions |
| 07-platform-admin.sql | ✅ | platform_feedback, site_settings, library_suspensions, import_jobs, password_reset_tokens, email_confirmation_tokens |
| 08-functions-triggers.sql | ✅ | **Updated:** Added get_role_tier(), has_role_level() for hierarchical role checks |
| 09-views.sql | ✅ | Public views: libraries_public, library_settings_public, games_public (with genre), user_profiles_public, library_directory, game_ratings_summary, game_wishlist_summary, borrower_reputation, library_calendar_events, site_settings_public |
| 10-rls-policies.sql | ✅ | 776 lines of RLS policies, all use DROP IF EXISTS for idempotent runs |
| 11-seed-data.sql | ✅ | Default achievements and mechanics |
| 12-auth-trigger.sql | ✅ | Auto-create user profiles on signup, role grants |
| 13-storage-buckets.sql | ✅ | library-logos bucket with RLS policies |
| 15-totp-2fa.sql | ✅ | **NEW:** TOTP 2FA support with user_totp_settings table |
| 16-security-hardening.sql | ✅ | **NEW:** Library members privacy fix, member access policies |

### ✅ Docker Configuration

| Component | Version | Status |
|-----------|---------|--------|
| PostgreSQL | 15.6.1.143 | ✅ Supabase-optimized |
| Kong | 2.8.1 | ✅ API Gateway |
| GoTrue | v2.158.1 | ✅ Auth service |
| PostgREST | v12.2.3 | ✅ REST API |
| Realtime | v2.30.34 | ✅ WebSocket |
| Storage | v1.0.6 | ✅ File storage |
| Edge Runtime | v1.66.4 | ✅ Deno functions |
| Postgres Meta | v0.83.2 | ✅ Studio backend |
| Studio | 20240729 | ✅ Admin UI |
| imgproxy | v3.18 | ✅ Image transformations |
| Roundcube | 1.6-apache | ✅ Webmail |
| Nginx | 1.25-alpine | ✅ Reverse proxy |
| Node | 20-alpine | ✅ Frontend build |

### ✅ Scripts

| Script | Purpose | Status |
|--------|---------|--------|
| install.sh | Main installer | ✅ Tested |
| preflight-check.sh | System validation | ✅ Tested |
| run-migrations.sh | Database setup | ✅ Tested |
| create-admin.sh | Admin user creation | ✅ Tested |
| setup-ssl.sh | SSL/wildcard certs | ✅ Tested |
| backup.sh | Full backup | ✅ Tested |
| restore.sh | Full restore | ✅ Tested |
| update.sh | Update deployment | ✅ Tested |
| inject-config.sh | Runtime config | ✅ Tested |

### ✅ Configuration Files

| File | Purpose | Status |
|------|---------|--------|
| docker-compose.yml | Service orchestration | ✅ |
| Dockerfile.app | Frontend build | ✅ |
| kong.yml | API gateway routing | ✅ |
| nginx/app.conf | Frontend nginx | ✅ |

### ✅ Documentation

| Document | Purpose | Status |
|----------|---------|--------|
| README.md | Installation guide | ✅ |
| MIGRATION.md | Data migration guide | ✅ |
| TROUBLESHOOTING.md | Common issues | ✅ |
| DEPLOY_CHECKLIST.md | This file | ✅ |

## Deployment Steps

### 1. Server Setup

```bash
# SSH to your server
ssh root@gametaverns.com

# Clone the repository
git clone https://github.com/GameTaverns/GameTaverns.git /tmp/gametaverns
cd /tmp/gametaverns/deploy/supabase-selfhosted

# Run preflight check
sudo ./scripts/preflight-check.sh
```

### 2. DNS Configuration

Before running install, ensure DNS is configured:

| Record | Name | Value |
|--------|------|-------|
| A | @ | SERVER_IP |
| A | * | SERVER_IP |
| A | api | SERVER_IP |
| A | mail | SERVER_IP |
| A | studio | SERVER_IP |
| MX | @ | mail.gametaverns.com (priority 10) |
| TXT | @ | v=spf1 mx a ~all |

### 3. Installation

```bash
# Run the installer (will prompt for API keys)
sudo ./install.sh

# Follow the prompts for:
# - Admin email
# - Discord Bot/Client credentials
# - Perplexity API key
# - Firecrawl API key  
# - Turnstile site/secret keys
```

### 4. SSL Setup

```bash
cd /opt/gametaverns
sudo ./scripts/setup-ssl.sh

# Choose Cloudflare DNS for automatic wildcard cert renewal
```

### 5. Admin User

```bash
sudo ./scripts/create-admin.sh

# Enter email, password, and display name
```

### 6. Verification

```bash
# Check all containers are running
docker compose ps

# Verify database schema
docker compose exec db psql -U supabase_admin -d postgres -c "\dt public.*"

# Test API health
curl -s http://localhost:8000/auth/v1/health

# Test frontend
curl -s http://localhost:3000/health
```

## Post-Deployment Checklist

- [ ] All containers show "healthy" status
- [ ] Homepage loads at https://gametaverns.com
- [ ] Admin can log in
- [ ] API responds at https://api.gametaverns.com/auth/v1/health
- [ ] Studio accessible at https://studio.gametaverns.com
- [ ] Test library creation works
- [ ] Test game creation works
- [ ] Test file upload (logo) works
- [ ] Test tenant subdomain (e.g., https://test.gametaverns.com)
- [ ] Verify email sending (password reset test)
- [ ] Set up automated backups (cron)

## Automated Backup Setup

```bash
# Add to crontab
sudo crontab -e

# Add this line for daily backups at 2 AM:
0 2 * * * /opt/gametaverns/scripts/backup.sh 7 >> /var/log/gametaverns-backup.log 2>&1
```

## Feature Parity Verification

After deployment, verify these features work:

| Feature | Cloud | Self-Hosted |
|---------|-------|-------------|
| User signup/login | ✅ | ✅ |
| Email verification | ✅ | ✅ |
| Password reset | ✅ | ✅ |
| Library creation | ✅ | ✅ |
| Game CRUD | ✅ | ✅ |
| BGG import | ✅ | ✅ |
| Bulk import | ✅ | ✅ |
| File uploads | ✅ | ✅ |
| Theme customization | ✅ | ✅ |
| Lending system | ✅ | ✅ |
| Events/Polls | ✅ | ✅ |
| Achievements | ✅ | ✅ |
| Discord notifications | ✅ | ✅ |
| AI recommendations | ✅ | ✅ |
| Tenant subdomains | ✅ | ✅ |
| Rating/Wishlist | ✅ | ✅ |
| Genre filtering | ✅ | ✅ |
| Random game picker | ✅ | ✅ |

## Support

- GitHub Issues: https://github.com/GameTaverns/GameTaverns/issues
- Discord: https://discord.gg/gametaverns
- Documentation: See README.md
