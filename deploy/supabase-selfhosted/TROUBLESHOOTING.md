# GameTaverns Self-Hosted: Troubleshooting Guide

## Quick Diagnostics

```bash
# Check all container status
docker compose ps

# View logs for all services
docker compose logs -f

# View logs for specific service
docker compose logs -f db
docker compose logs -f auth
docker compose logs -f functions
```

## Common Issues

### 1. Database Connection Refused

**Symptoms:**
- "Connection refused" errors
- Auth service failing to start
- REST API returning 500 errors

**Solutions:**
```bash
# Check if database is healthy
docker compose ps db

# Check database logs
docker compose logs db

# Restart database
docker compose restart db

# Wait for it to be ready
docker compose exec db pg_isready -U supabase_admin
```

### 2. Auth Service Not Starting

**Symptoms:**
- Login/signup not working
- 401 errors everywhere
- "Invalid JWT" errors

**Solutions:**
```bash
# Check auth logs
docker compose logs auth

# Verify JWT secrets match
docker compose exec auth env | grep JWT

# Compare with .env file
grep JWT_SECRET /opt/gametaverns/.env

# Restart auth service
docker compose restart auth
```

### 3. Edge Functions Not Working

**Symptoms:**
- API calls to `/functions/v1/*` failing
- 500 errors from function endpoints

**Solutions:**
```bash
# Check functions container
docker compose logs functions

# Verify functions are mounted
docker compose exec functions ls -la /home/deno/functions

# Check for syntax errors in functions
docker compose exec functions deno check /home/deno/functions/*/index.ts

# Restart functions
docker compose restart functions
```

### 4. SSL Certificate Issues

**Symptoms:**
- Browser showing "Not Secure"
- Certificate errors
- Let's Encrypt rate limiting

**Solutions:**
```bash
# Check certificate status
sudo certbot certificates

# Test certificate renewal
sudo certbot renew --dry-run

# Force certificate renewal
sudo certbot renew --force-renewal

# Check Nginx config
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

### 5. Subdomain Not Working

**Symptoms:**
- `*.gametaverns.com` not resolving
- Tenant libraries showing 404

**Solutions:**
```bash
# Check DNS propagation
dig +short tzolak.gametaverns.com

# Verify wildcard certificate
sudo certbot certificates | grep -A5 "gametaverns.com"

# Check Nginx config for wildcard
grep -A20 "server_name ~" /etc/nginx/sites-available/gametaverns

# Test Nginx config
sudo nginx -t
```

### 6. Mail Not Sending

**Symptoms:**
- Verification emails not arriving
- Password reset emails not sending

**Solutions:**
```bash
# Check mail container
docker compose logs mail

# Test SMTP connection
docker compose exec mail swaks --to test@example.com --server localhost

# Check Postfix queue
docker compose exec mail mailq

# View mail logs
docker compose exec mail tail -f /var/log/mail.log
```

### 7. Storage Issues

**Symptoms:**
- File uploads failing
- Images not loading

**Solutions:**
```bash
# Check storage container
docker compose logs storage

# Verify storage volume
docker compose exec storage ls -la /var/lib/storage

# Check permissions
docker compose exec storage stat /var/lib/storage

# Restart storage
docker compose restart storage
```

### 8. Kong Gateway Errors

**Symptoms:**
- API returning 502/503 errors
- Routes not working
- "Invalid API key" errors

**Solutions:**
```bash
# Check Kong logs
docker compose logs kong

# Verify Kong config has correct API keys
cat /opt/gametaverns/kong.yml | grep -A2 "key:"

# If keys show {{ANON_KEY}} instead of actual keys, re-render config:
source /opt/gametaverns/.env
sed -e "s|{{ANON_KEY}}|${ANON_KEY}|g" \
    -e "s|{{SERVICE_ROLE_KEY}}|${SERVICE_ROLE_KEY}|g" \
    /opt/gametaverns/kong.yml.template > /opt/gametaverns/kong.yml

# Restart Kong
docker compose restart kong
```

## Performance Issues

### Slow Database Queries

```bash
# Connect to database
docker compose exec db psql -U supabase_admin -d postgres

# Check slow queries
SELECT * FROM pg_stat_statements ORDER BY total_time DESC LIMIT 10;

# Check table sizes
SELECT relname, pg_size_pretty(pg_total_relation_size(relid))
FROM pg_catalog.pg_statio_user_tables
ORDER BY pg_total_relation_size(relid) DESC;

# Run VACUUM
VACUUM ANALYZE;
```

### High Memory Usage

```bash
# Check container resources
docker stats

# Reduce memory limits in docker-compose.yml
# Add under each service:
#   deploy:
#     resources:
#       limits:
#         memory: 512M
```

## Complete Reset

If all else fails, you can do a complete reset:

```bash
cd /opt/gametaverns

# Backup first!
./scripts/backup.sh

# Stop and remove everything
docker compose down -v

# Remove all data (DESTRUCTIVE!)
rm -rf volumes/*

# Restart fresh
docker compose up -d

# Run migrations
./scripts/run-migrations.sh

# Create admin user
./scripts/create-admin.sh
```

## Getting Help

1. Check the logs first: `docker compose logs -f`
2. Review this troubleshooting guide
3. Check GitHub Issues: https://github.com/GameTaverns/GameTaverns/issues
4. Join Discord: https://discord.gg/gametaverns

When reporting issues, include:
- Output of `docker compose ps`
- Relevant logs from `docker compose logs [service]`
- Your Ubuntu version: `lsb_release -a`
- Docker version: `docker --version`
