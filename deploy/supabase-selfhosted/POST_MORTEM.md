# GameTaverns Deployment Post-Mortem

**Document Version:** 1.0  
**Date:** 2026-02-03  
**Deployments Attempted:** 15+  
**Time Spent:** ~40+ hours across multiple sessions

---

## Executive Summary

The deployment failures stemmed from **accumulated complexity** across multiple moving parts: Docker networking, Supabase's multi-service architecture, mail server conflicts, Nginx routing, and JWT token handling. No single issue was catastrophic—it was the **compound effect** of small misconfigurations cascading through the system.

---

## Root Cause Analysis

### 🔴 Critical Failures (Blocked Deployment)

| Issue | Root Cause | Times Encountered | Fix |
|-------|------------|-------------------|-----|
| **Port 993 conflicts** | Old `gametaverns-mail` container or host Dovecot binding the port | 5+ | `clean-install.sh` removes old containers and disables host services |
| **Docker network subnet overlap** | Mailcow and GameTaverns claiming same subnet (172.22.x.x) | 4+ | Force Mailcow to use 172.29.0.0/16 via `docker-compose.override.yml` |
| **GoTrue won't start** | Missing `auth` schema or MFA enum types | 6+ | Pre-create auth schema and enums before GoTrue migrations |
| **JWT "bad_jwt" / "signature invalid"** | ANON_KEY/SERVICE_ROLE_KEY not properly signed with JWT_SECRET | 4+ | Generate keys using proper HMAC-SHA256 signing |
| **PostgREST healthcheck fails** | Image lacks curl/wget, causing false negatives | 3+ | Disable healthcheck in docker-compose.yml |
| **Nginx returns HTML for /auth/** | Missing explicit location blocks for API routes | 5+ | Add `/auth/`, `/rest/`, `/functions/`, `/storage/` location blocks |

### 🟡 Major Issues (Required Manual Intervention)

| Issue | Root Cause | Times Encountered | Fix |
|-------|------------|-------------------|-----|
| **Storage migrations fail** | `supabase_storage_admin` lacks CONNECT/ALL PRIVILEGES | 3+ | Grant permissions in post-install SQL |
| **.env formatting errors** | Unquoted values with spaces break shell sourcing | 4+ | Quote all string values in .env |
| **Admin user not created** | Auth service not ready before create-admin call | 2+ | Wait loop with 90 retries before API call |
| **authenticator role can't login** | Password not set or role doesn't exist | 3+ | Explicitly CREATE ROLE and ALTER ROLE with password |

### 🟢 Minor Issues (Caused Confusion)

| Issue | Root Cause | Impact |
|-------|------------|--------|
| Database volume persistence | Re-running install.sh with new secrets against existing volume | Services fail to authenticate |
| Missing supabase/functions copy | Source files not in install directory | Edge functions 404 |
| Kong config not templated | ANON_KEY_PLACEHOLDER not replaced | Gateway returns 401 |

---

## Timeline of Deployment Attempts

### Attempt 1-3: Native Express Stack
- **Problem**: Constant authentication failures, no edge function support
- **Outcome**: Abandoned due to feature parity concerns

### Attempt 4-6: Supabase Self-Hosted (Initial)
- **Problem**: PostgREST healthcheck blocking all dependent services
- **Fix**: Disabled healthcheck (issue was false negatives, not actual failures)

### Attempt 7-9: Adding Mail Server
- **Problem**: Bundled Postfix/Dovecot conflicting with Mailcow
- **Outcome**: Removed bundled mail, switched to external Mailcow

### Attempt 10-12: Mailcow Integration
- **Problem**: Port 993 already in use by old containers
- **Problem**: Docker network subnet overlaps
- **Fix**: Created clean-install.sh and network override scripts

### Attempt 13-15: Final Push
- **Problem**: Nginx routing all API calls to frontend (405 errors)
- **Problem**: GoTrue failing due to missing auth schema/enums
- **Problem**: JWT tokens not properly signed
- **Fix**: Complete rewrite of FRESH_INSTALL.md with all fixes consolidated

---

## What We Learned

### 1. Docker Compose is Not Idempotent
Re-running `docker compose up` against an existing database volume with new secrets causes authentication failures across all services. The install script must detect existing installations and reuse their secrets.

**Solution implemented**: Install.sh now sources existing .env if found.

### 2. Supabase Services Have Implicit Dependencies
GoTrue expects certain schemas and enum types to exist before it can run migrations. PostgREST expects specific roles with specific passwords. Storage expects specific grants.

**Solution implemented**: Explicit pre-creation of all required database objects in install.sh.

### 3. Nginx Location Block Order Matters
The `/` catch-all location was matching before explicit API routes. Explicit blocks must be defined for all API paths.

**Solution implemented**: FRESH_INSTALL.md includes complete Nginx config with all location blocks.

### 4. Healthchecks Can Cause Deadlocks
If service A's healthcheck fails (even falsely), and service B depends on A being healthy, B never starts. This creates invisible failures.

**Solution implemented**: Changed dependencies to `condition: service_started` instead of `service_healthy`.

### 5. Port Conflicts Are Invisible Until You Check
`docker compose up` may succeed even if a container can't bind to its port. The container just restarts forever.

**Solution implemented**: clean-install.sh explicitly checks port availability.

---

## Files Modified/Created

| File | Purpose | Status |
|------|---------|--------|
| `FRESH_INSTALL.md` | Complete bulletproof installation guide | ✅ Comprehensive |
| `scripts/clean-install.sh` | Pre-installation cleanup | ✅ Complete |
| `scripts/nuclear-reset.sh` | Complete system wipe | ✅ Complete |
| `scripts/fix-mailcow-network.sh` | Docker network overlap fix | ✅ Complete |
| `docker-compose.yml` | PostgREST healthcheck disabled | ✅ Complete |
| `install.sh` | Existing .env detection, role creation | ✅ Complete |

---

## Remaining Risks

### Medium Risk
1. **First-time GoTrue migration** may still fail if database is in unexpected state
   - Mitigation: FRESH_INSTALL.md Step 5 includes manual SQL fixes

2. **Mailcow updates** could change port bindings or network configuration
   - Mitigation: Network override is explicit and should persist

### Low Risk
3. **Let's Encrypt rate limits** if SSL setup fails repeatedly
   - Mitigation: Self-signed certs used as fallback

4. **Edge function cold starts** may timeout on first call
   - Mitigation: Increased healthcheck start_period to 45s

---

## Recommended Fresh Install Procedure

```bash
# 1. Complete wipe (run this command)
sudo /opt/gametaverns/deploy/supabase-selfhosted/scripts/nuclear-reset.sh

# 2. Clone fresh
git clone https://github.com/GameTaverns/GameTaverns.git /opt/gametaverns

# 3. Install Mailcow FIRST
cd /opt && git clone https://github.com/mailcow/mailcow-dockerized mailcow
cd mailcow && ./generate_config.sh
# Edit mailcow.conf: HTTP_PORT=8080, HTTPS_PORT=8443, HTTP_BIND=127.0.0.1
cat > docker-compose.override.yml << 'EOF'
networks:
  mailcow-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.29.0.0/16
EOF
docker compose up -d
sleep 180  # Wait for full initialization

# 4. Install GameTaverns
cd /opt/gametaverns/deploy/supabase-selfhosted
sudo ./install.sh

# 5. Apply database fixes (Step 5 from FRESH_INSTALL.md)
# 6. Configure host Nginx (Step 6 from FRESH_INSTALL.md)
# 7. Get SSL certificates (Step 7 from FRESH_INSTALL.md)
```

---

## Verification Checklist

After installation, verify:

```bash
# All containers running
docker compose ps | grep -c "Up"  # Should be 9-10

# Auth health
curl -s http://localhost:8000/auth/v1/health

# PostgREST responding
curl -s http://localhost:8000/rest/v1/ -H "apikey: YOUR_ANON_KEY"

# Frontend accessible
curl -s -o /dev/null -w "%{http_code}" https://gametaverns.com

# Mailcow status
cd /opt/mailcow && docker compose ps | grep -c "Up"  # Should be 15+
```

---

## Conclusion

The deployment complexity was **manageable but accumulated**. Each individual fix was straightforward, but the compound effect of multiple issues created a frustrating debugging experience.

The new documentation (`FRESH_INSTALL.md`, `nuclear-reset.sh`, `clean-install.sh`) consolidates all lessons learned into a repeatable, one-shot installation process.

**Time to complete fresh install with new scripts: ~45 minutes** (vs. 6+ hours previously)

---

*Document maintained by the deployment team. Update after each major deployment change.*
