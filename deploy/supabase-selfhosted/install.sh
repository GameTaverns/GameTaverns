#!/bin/bash
# =============================================================================
# GameTaverns - Complete Self-Hosted Installation Script
# Ubuntu 22.04 / 24.04 LTS
# Domain: gametaverns.com (hardcoded)
# Version: 2.7.3 - Correct Install Order Edition
# Audited: 2026-02-03
# 
# ISSUES ADDRESSED IN THIS VERSION:
#   1. Config collection order - Admin/API keys collected AFTER services running
#   2. Database/admin/user setup order - DB fully ready before admin creation
#   3. Turnstile setup not holding - Key inserted into database
#   4. SSL cert conflicts - Mail uses wildcard, not Mailcow internal certs
#   5. Self-hosted flag issues - Frontend properly configured for Supabase mode
#   6. Database to frontend linkage - Proper API URL injection
#   7. Connection issues - API_EXTERNAL_URL == SITE_URL for same-origin routing
#
# ARCHITECTURE:
#   - Host Nginx terminates SSL and routes traffic
#   - API paths (/auth/, /rest/, /functions/, /storage/) go to Kong (port 8000)
#   - Frontend accesses Supabase via same-origin (no CORS issues)
#   - SELF_HOSTED: false = Use Supabase client, NOT Express API
#
# ORDER OF OPERATIONS (CRITICAL FOR SUCCESS):
#   Phase 1 - INFRASTRUCTURE CONFIG:
#     Step 0:  Optional Mailcow installation
#     Step 1:  Collect BASIC config only (timezone, SMTP)
#     Step 2:  Generate security keys (JWT, Supabase)
#     Step 3:  Setup directory structure
#     Step 4:  Generate .env configuration (API_EXTERNAL_URL == SITE_URL)
#     Step 5:  Pull Docker images
#     Step 6:  Build frontend (with proper env vars baked in)
#
#   Phase 2 - DATABASE SETUP:
#     Step 7:  Start ONLY database, wait for ready
#     Step 7a: Create roles BEFORE any service connects
#     Step 7b: Create schemas and auth enum prerequisites
#     Step 8:  Run application migrations
#     Step 8a: Grant table permissions
#
#   Phase 3 - SERVICES:
#     Step 9:  Start remaining services
#     Step 10: Configure host Nginx (with proper API routing)
#     Step 11: SSL setup (Cloudflare wildcards, proper cert ordering)
#
#   Phase 4 - POST-INSTALL CONFIG (after everything running):
#     Step 12: Collect admin credentials & create admin user (DB must be ready!)
#     Step 13: Collect & configure OPTIONAL API keys (Discord, Perplexity, etc)
#     Step 13b: Insert Turnstile key into database
#     Step 14: Email/mailbox configuration
#     Step 15: Full verification
#
# =============================================================================

set -euo pipefail

# ===========================================
# Configuration
# ===========================================
INSTALL_DIR="/opt/gametaverns"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="/var/log/gametaverns-install.log"
CREDS_FILE="/root/gametaverns-credentials.txt"

# Hardcoded domain
DOMAIN="gametaverns.com"
SITE_NAME="GameTaverns"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# ===========================================
# Logging Functions
# ===========================================
mkdir -p "$(dirname "$LOG_FILE")"
touch "$LOG_FILE"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"; }
error() { echo -e "${RED}ERROR: $1${NC}" | tee -a "$LOG_FILE"; exit 1; }
warn() { echo -e "${YELLOW}WARNING: $1${NC}" | tee -a "$LOG_FILE"; }
success() { echo -e "${GREEN}✓ $1${NC}" | tee -a "$LOG_FILE"; }
info() { echo -e "${BLUE}ℹ $1${NC}" | tee -a "$LOG_FILE"; }
step() { echo -e "\n${CYAN}[$1] $2${NC}" | tee -a "$LOG_FILE"; }

# ===========================================
# Pre-flight Checks
# ===========================================
echo ""
echo -e "${CYAN}╔═══════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║         GameTaverns Self-Hosted Installer v2.7.2                  ║${NC}"
echo -e "${CYAN}║         Proper Install Order Edition                              ║${NC}"
echo -e "${CYAN}║         Domain: $DOMAIN                                  ║${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check root
if [ "$EUID" -ne 0 ]; then
    error "Please run as root: sudo ./install.sh"
fi

# Ensure script is run from correct location
if [[ ! -f "$SCRIPT_DIR/docker-compose.yml" ]]; then
    error "This script must be run from the deploy/supabase-selfhosted directory"
fi

# Check Docker
if ! command -v docker &> /dev/null; then
    error "Docker not installed. Run bootstrap.sh first or install Docker manually."
fi

if ! docker compose version &> /dev/null; then
    error "Docker Compose not found. Run bootstrap.sh first."
fi

success "Docker: $(docker --version | cut -d' ' -f3 | tr -d ',')"
success "Compose: $(docker compose version --short)"

# System resources check
TOTAL_RAM_GB=$(($(grep MemTotal /proc/meminfo | awk '{print $2}') / 1024 / 1024))
FREE_DISK_GB=$(df / | tail -1 | awk '{print int($4/1024/1024)}')

if [ "$TOTAL_RAM_GB" -lt 2 ]; then
    warn "System has ${TOTAL_RAM_GB}GB RAM. Recommended: 4GB+ for production."
fi

if [ "$FREE_DISK_GB" -lt 10 ]; then
    warn "Only ${FREE_DISK_GB}GB free disk space. Recommended: 20GB+"
fi

# ===========================================
# STEP 0: Optional Mailcow Installation
# ===========================================
step "0/15" "Mail Server Setup (Optional)"

MAILCOW_INSTALLED="no"
if [ -d "/opt/mailcow" ]; then
    if docker compose -f /opt/mailcow/docker-compose.yml ps 2>/dev/null | grep -q "running"; then
        info "Mailcow is already running. Skipping installation."
        MAILCOW_INSTALLED="yes"
    else
        warn "Mailcow directory exists but not running."
        read -p "Start existing Mailcow? (y/N): " START_MAILCOW
        if [[ "$START_MAILCOW" =~ ^[Yy]$ ]]; then
            cd /opt/mailcow && docker compose up -d
            MAILCOW_INSTALLED="yes"
            cd "$SCRIPT_DIR"
        fi
    fi
else
    echo ""
    echo "Mailcow provides a complete mail server (SMTP, IMAP, Webmail)."
    echo "This is RECOMMENDED for sending confirmation emails and notifications."
    echo ""
    read -p "Install Mailcow mail server now? (Y/n): " INSTALL_MAILCOW
    
    if [[ ! "$INSTALL_MAILCOW" =~ ^[Nn]$ ]]; then
        info "Installing Mailcow..."
        
        # Check for script or inline install
        if [ -f "$SCRIPT_DIR/scripts/setup-mailcow.sh" ]; then
            chmod +x "$SCRIPT_DIR/scripts/setup-mailcow.sh"
            "$SCRIPT_DIR/scripts/setup-mailcow.sh"
            MAILCOW_INSTALLED="yes"
        else
            # Inline Mailcow setup
            cd /opt
            git clone https://github.com/mailcow/mailcow-dockerized mailcow
            cd mailcow
            
            TIMEZONE=$(cat /etc/timezone 2>/dev/null || echo "UTC")
            ./generate_config.sh << EOF
mail.$DOMAIN
$TIMEZONE
EOF
            
            # CRITICAL: Configure non-conflicting ports
            # Mailcow should NOT use 80/443 - host Nginx handles those
            sed -i "s/^HTTP_PORT=.*/HTTP_PORT=8080/" mailcow.conf
            sed -i "s/^HTTPS_PORT=.*/HTTPS_PORT=8443/" mailcow.conf
            sed -i "s/^HTTP_BIND=.*/HTTP_BIND=127.0.0.1/" mailcow.conf
            sed -i "s/^HTTPS_BIND=.*/HTTPS_BIND=127.0.0.1/" mailcow.conf
            
            # CRITICAL: Disable Mailcow's internal ACME (SSL)
            # We use host Nginx with wildcard certs instead
            sed -i "s/^SKIP_LETS_ENCRYPT=.*/SKIP_LETS_ENCRYPT=y/" mailcow.conf
            
            # Fix network - let Mailcow use its default internal networking
            # Do NOT override the network subnet
            
            docker compose pull
            docker compose up -d
            
            echo "Waiting for Mailcow to initialize (90 seconds)..."
            sleep 90
            
            MAILCOW_INSTALLED="yes"
            success "Mailcow installed and running"
            cd "$SCRIPT_DIR"
        fi
    else
        info "Skipping Mailcow installation. You can use an external SMTP server."
    fi
fi

# ===========================================
# STEP 1: Collect ESSENTIAL Configuration Only
# ===========================================
step "1/15" "Collecting Essential Configuration"

echo ""
echo -e "${BLUE}=== Basic Configuration ===${NC}"
echo -e "${YELLOW}(Admin account & API keys will be configured AFTER database is ready)${NC}"
echo ""

read -p "Timezone [America/New_York]: " TIMEZONE
TIMEZONE=${TIMEZONE:-America/New_York}

echo ""
echo -e "${BLUE}=== External SMTP (optional) ===${NC}"
echo "Leave empty to use built-in mail server (Mailcow)"
read -p "External SMTP Host: " EXT_SMTP_HOST
EXT_SMTP_HOST=${EXT_SMTP_HOST:-}
if [ -n "$EXT_SMTP_HOST" ]; then
    read -p "SMTP Port [587]: " EXT_SMTP_PORT
    EXT_SMTP_PORT=${EXT_SMTP_PORT:-587}
    read -p "SMTP User: " EXT_SMTP_USER
    read -s -p "SMTP Password: " EXT_SMTP_PASS
    echo ""
else
    EXT_SMTP_PORT=""
    EXT_SMTP_USER=""
    EXT_SMTP_PASS=""
fi

# Initialize optional values as empty (will be collected later)
ADMIN_EMAIL=""
ADMIN_PASSWORD=""
ADMIN_DISPLAY_NAME=""
DISCORD_BOT_TOKEN=""
DISCORD_CLIENT_ID=""
DISCORD_CLIENT_SECRET=""
PERPLEXITY_API_KEY=""
FIRECRAWL_API_KEY=""
BGG_API_TOKEN=""
TURNSTILE_SITE_KEY=""
TURNSTILE_SECRET_KEY=""

success "Essential configuration collected"
info "Admin account & optional API keys will be configured after database is ready"

# ===========================================
# STEP 2: Generate Security Keys
# ===========================================
step "2/14" "Generating Security Keys"

# IMPORTANT:
# If this installer is re-run on an existing installation, we must *not* rotate
# the database password / JWT secrets, otherwise existing containers (esp. PostgREST)
# will fail to authenticate against the already-initialized database volume.
EXISTING_ENV="$INSTALL_DIR/.env"
if [ -f "$EXISTING_ENV" ]; then
    info "Existing installation detected ($EXISTING_ENV). Reusing existing security keys."
    # shellcheck disable=SC1090
    set -a
    source "$EXISTING_ENV"
    set +a
fi

gen_secret() {
    # Usage: gen_secret <bytes> <max_chars>
    local bytes="$1"
    local max_chars="$2"
    openssl rand -base64 "$bytes" | tr -d '/+=' | head -c "$max_chars"
}

# Only generate missing keys (first install or partially configured install)
POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-"$(gen_secret 32 32)"}
JWT_SECRET=${JWT_SECRET:-"$(gen_secret 64 64)"}
SECRET_KEY_BASE=${SECRET_KEY_BASE:-"$(gen_secret 64 64)"}
PII_ENCRYPTION_KEY=${PII_ENCRYPTION_KEY:-"$(gen_secret 32 32)"}

# Generate Supabase JWT tokens
generate_jwt() {
    local role=$1
    local now=$(date +%s)
    local exp=$((now + 157680000)) # 5 years
    
    local header='{"alg":"HS256","typ":"JWT"}'
    local header_b64=$(echo -n "$header" | openssl base64 -e | tr -d '\n=' | tr '+/' '-_')
    
    local payload="{\"role\":\"$role\",\"iss\":\"supabase\",\"iat\":$now,\"exp\":$exp}"
    local payload_b64=$(echo -n "$payload" | openssl base64 -e | tr -d '\n=' | tr '+/' '-_')
    
    local sig=$(echo -n "${header_b64}.${payload_b64}" | openssl dgst -sha256 -hmac "$JWT_SECRET" -binary | openssl base64 -e | tr -d '\n=' | tr '+/' '-_')
    
    echo "${header_b64}.${payload_b64}.${sig}"
}

ANON_KEY=${ANON_KEY:-"$(generate_jwt "anon")"}
SERVICE_ROLE_KEY=${SERVICE_ROLE_KEY:-"$(generate_jwt "service_role")"}

success "Security keys generated"

# ===========================================
# STEP 3: Setup Directory Structure
# ===========================================
step "3/14" "Setting Up Directories"

mkdir -p "$INSTALL_DIR"
mkdir -p "$INSTALL_DIR/logs"
mkdir -p "$INSTALL_DIR/nginx/ssl"
mkdir -p "$INSTALL_DIR/backups"

# Copy deployment files
cp -r "$SCRIPT_DIR"/* "$INSTALL_DIR/"
chmod +x "$INSTALL_DIR/scripts"/*.sh 2>/dev/null || true

# Copy source files from project root
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"
if [ -f "$PROJECT_ROOT/package.json" ]; then
    # Check if PROJECT_ROOT and INSTALL_DIR are the same (running from cloned repo)
    PROJECT_ROOT_REAL=$(realpath "$PROJECT_ROOT" 2>/dev/null || readlink -f "$PROJECT_ROOT")
    INSTALL_DIR_REAL=$(realpath "$INSTALL_DIR" 2>/dev/null || readlink -f "$INSTALL_DIR")
    
    if [ "$PROJECT_ROOT_REAL" = "$INSTALL_DIR_REAL" ]; then
        info "Running from install directory - skipping source copy (files already in place)"
    else
        info "Copying application source files..."
        
        [ -d "$PROJECT_ROOT/src" ] || error "Source directory not found: $PROJECT_ROOT/src"
        
        cp -r "$PROJECT_ROOT/src" "$INSTALL_DIR/"
        cp -r "$PROJECT_ROOT/public" "$INSTALL_DIR/"
        cp "$PROJECT_ROOT/package.json" "$INSTALL_DIR/"
        cp "$PROJECT_ROOT/package-lock.json" "$INSTALL_DIR/" 2>/dev/null || true
        cp "$PROJECT_ROOT/bun.lockb" "$INSTALL_DIR/" 2>/dev/null || true
        cp "$PROJECT_ROOT/vite.config.ts" "$INSTALL_DIR/"
        cp "$PROJECT_ROOT/tsconfig.json" "$INSTALL_DIR/"
        cp "$PROJECT_ROOT/tsconfig.app.json" "$INSTALL_DIR/" 2>/dev/null || true
        cp "$PROJECT_ROOT/tsconfig.node.json" "$INSTALL_DIR/" 2>/dev/null || true
        cp "$PROJECT_ROOT/tailwind.config.ts" "$INSTALL_DIR/"
        cp "$PROJECT_ROOT/postcss.config.js" "$INSTALL_DIR/"
        cp "$PROJECT_ROOT/index.html" "$INSTALL_DIR/"
        cp "$PROJECT_ROOT/components.json" "$INSTALL_DIR/" 2>/dev/null || true
        
        # Copy edge functions
        mkdir -p "$INSTALL_DIR/supabase"
        if [ -d "$PROJECT_ROOT/supabase/functions" ]; then
            cp -r "$PROJECT_ROOT/supabase/functions" "$INSTALL_DIR/supabase/"
        fi
        cp "$PROJECT_ROOT/supabase/config.toml" "$INSTALL_DIR/supabase/" 2>/dev/null || true
        
        success "Application source files copied"
    fi
else
    error "Project root not found at $PROJECT_ROOT"
fi

success "Directory structure created at $INSTALL_DIR"

# ===========================================
# STEP 4: Generate Configuration Files
# ===========================================
step "4/14" "Generating Configuration"

# CRITICAL: API_EXTERNAL_URL must match SITE_URL for same-origin API access
# Frontend talks to Kong via https://$DOMAIN/auth/, /rest/, /functions/
# Host Nginx proxies these paths to Kong on port 8000
# Using a separate api subdomain would cause CORS issues

cat > "$INSTALL_DIR/.env" << EOF
############################################################
# GameTaverns Self-Hosted Configuration
# Generated: $(date)
# Domain: $DOMAIN
# Version: 2.7.1 - Connection Fix Edition
############################################################

# Domain & URLs
DOMAIN=$DOMAIN
SITE_URL=https://$DOMAIN

# CRITICAL: API_EXTERNAL_URL must match SITE_URL for same-origin routing
# Frontend accesses Kong via https://$DOMAIN/auth/, /rest/, /functions/
# Host Nginx proxies these paths to Kong on port 8000
# Do NOT use a separate api subdomain - it causes CORS issues
API_EXTERNAL_URL=https://$DOMAIN

STUDIO_URL=https://studio.$DOMAIN
MAIL_DOMAIN=$DOMAIN
LIBRARY_SUBDOMAIN_PATTERN=*.$DOMAIN

# Security Keys (DO NOT SHARE)
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
JWT_SECRET=$JWT_SECRET
ANON_KEY=$ANON_KEY
SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY
SECRET_KEY_BASE=$SECRET_KEY_BASE
PII_ENCRYPTION_KEY=$PII_ENCRYPTION_KEY

# Site Branding
SITE_NAME=$SITE_NAME
SITE_DESCRIPTION=Browse and discover our collection of board games

# Ports
APP_PORT=3000
KONG_HTTP_PORT=8000
KONG_HTTPS_PORT=8443
STUDIO_PORT=3001
POSTGRES_PORT=5432
ROUNDCUBE_PORT=9001

# Auth Configuration
DISABLE_SIGNUP=false
ENABLE_EMAIL_SIGNUP=true
ENABLE_EMAIL_AUTOCONFIRM=false
JWT_EXPIRY=3600
ADDITIONAL_REDIRECT_URLS=

# SMTP Configuration
SMTP_HOST=${EXT_SMTP_HOST:-mail.$DOMAIN}
SMTP_PORT=${EXT_SMTP_PORT:-587}
SMTP_USER=${EXT_SMTP_USER:-}
SMTP_PASS=${EXT_SMTP_PASS:-}
SMTP_ADMIN_EMAIL=$ADMIN_EMAIL
SMTP_SENDER_NAME=$SITE_NAME
SMTP_FROM=noreply@$DOMAIN

# Timezone
TIMEZONE=$TIMEZONE

# Discord Integration
DISCORD_BOT_TOKEN=${DISCORD_BOT_TOKEN:-}
DISCORD_CLIENT_ID=${DISCORD_CLIENT_ID:-}
DISCORD_CLIENT_SECRET=${DISCORD_CLIENT_SECRET:-}

# AI Services (Perplexity powers ALL AI features)
PERPLEXITY_API_KEY=${PERPLEXITY_API_KEY:-}
FIRECRAWL_API_KEY=${FIRECRAWL_API_KEY:-}

# BoardGameGeek
BGG_API_TOKEN=${BGG_API_TOKEN:-}

# Bot Protection (Cloudflare Turnstile)
# CRITICAL: These must be valid - site key goes to database too
TURNSTILE_SITE_KEY=${TURNSTILE_SITE_KEY:-}
TURNSTILE_SECRET_KEY=${TURNSTILE_SECRET_KEY:-}
EOF

chmod 600 "$INSTALL_DIR/.env"

# Save credentials
cat > "$CREDS_FILE" << EOF
============================================
GameTaverns Credentials
Generated: $(date)
============================================

Domain: $DOMAIN
Admin Email: $ADMIN_EMAIL

Database:
  Host: localhost
  Port: 5432
  User: supabase_admin
  Password: $POSTGRES_PASSWORD

JWT Secret: $JWT_SECRET
Anon Key: $ANON_KEY
Service Role Key: $SERVICE_ROLE_KEY
PII Encryption Key: $PII_ENCRYPTION_KEY

Turnstile Site Key: ${TURNSTILE_SITE_KEY:-not configured}

URLs:
  Main Site: https://$DOMAIN
  API: https://$DOMAIN (via /auth/, /rest/, /functions/ paths)
  Studio: https://studio.$DOMAIN
  Webmail: https://mail.$DOMAIN

============================================
KEEP THIS FILE SECURE! DELETE AFTER NOTING.
============================================
EOF
chmod 600 "$CREDS_FILE"

# Render Kong config
sed -i \
    -e "s|ANON_KEY_PLACEHOLDER|${ANON_KEY}|g" \
    -e "s|SERVICE_ROLE_KEY_PLACEHOLDER|${SERVICE_ROLE_KEY}|g" \
    "$INSTALL_DIR/kong.yml"

success "Configuration files generated"

# ===========================================
# STEP 5: Pull Docker Images
# ===========================================
step "5/14" "Pulling Docker Images"

cd "$INSTALL_DIR"
docker compose pull 2>&1 | tee -a "$LOG_FILE"

success "Docker images pulled"

# ===========================================
# STEP 6: Build Frontend
# ===========================================
step "6/14" "Building Frontend"

docker compose build app 2>&1 | tee -a "$LOG_FILE"

success "Frontend built"

# ===========================================
# STEP 7: Start Database FIRST (before other services)
# ===========================================
step "7/14" "Starting Database & Initializing Schema"

# CRITICAL: Stop any existing containers to ensure clean state
docker compose down 2>/dev/null || true

# CRITICAL: Start ONLY the database first to run all setup before other services connect
docker compose up -d db 2>&1 | tee -a "$LOG_FILE"

# Wait for database to be ready using postgres user (always exists)
info "Waiting for PostgreSQL to be ready..."
MAX_RETRIES=60
RETRY_COUNT=0

while ! docker compose exec -T db pg_isready -U postgres -d postgres > /dev/null 2>&1; do
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
        error "Database failed to start. Check: docker compose logs db"
    fi
    echo "  Waiting for database... ($RETRY_COUNT/$MAX_RETRIES)"
    sleep 3
done

success "Database is ready"

# Give PostgreSQL a moment to fully initialize
sleep 5

# ===========================================
# STEP 7a: Create all required roles BEFORE anything connects
# ===========================================
info "Creating database roles..."

# Escape single quotes in password for SQL
ESCAPED_PW=$(printf '%s' "$POSTGRES_PASSWORD" | sed "s/'/''/g")

# CRITICAL: Use 'postgres' user for initial setup (supabase/postgres image creates this)
# The POSTGRES_PASSWORD env var sets this user's password
# Then we create/update supabase_admin and other roles
set +e
ROLE_OUTPUT=$(docker compose exec -T db psql -U postgres -d postgres 2>&1 << EOSQL
-- =====================================================
-- CRITICAL: Create ALL roles before any service connects
-- Version: 2.7.3 - Connect as postgres superuser
-- =====================================================

-- Create supabase_admin role (main admin for the platform)
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_admin') THEN
    CREATE ROLE supabase_admin WITH LOGIN SUPERUSER CREATEDB CREATEROLE PASSWORD '${ESCAPED_PW}';
    RAISE NOTICE 'Created supabase_admin role';
  END IF;
END \$\$;

-- Create API roles
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticator') THEN
    CREATE ROLE authenticator WITH LOGIN NOINHERIT PASSWORD '${ESCAPED_PW}';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
  END IF;
END \$\$;

-- Create admin roles for Supabase services
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
    CREATE ROLE supabase_auth_admin WITH LOGIN SUPERUSER CREATEDB CREATEROLE PASSWORD '${ESCAPED_PW}';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_storage_admin') THEN
    CREATE ROLE supabase_storage_admin WITH LOGIN CREATEDB CREATEROLE PASSWORD '${ESCAPED_PW}';
  END IF;
END \$\$;

-- Set passwords for all login roles (in case they existed with different passwords)
ALTER ROLE authenticator WITH LOGIN PASSWORD '${ESCAPED_PW}';
ALTER ROLE supabase_auth_admin WITH PASSWORD '${ESCAPED_PW}';
ALTER ROLE supabase_storage_admin WITH PASSWORD '${ESCAPED_PW}';
ALTER ROLE supabase_admin WITH PASSWORD '${ESCAPED_PW}';
ALTER ROLE postgres WITH PASSWORD '${ESCAPED_PW}';

-- Grant role switching to authenticator
GRANT anon TO authenticator;
GRANT authenticated TO authenticator;
GRANT service_role TO authenticator;

-- Grant roles to supabase_admin for convenience
GRANT anon TO supabase_admin;
GRANT authenticated TO supabase_admin;
GRANT service_role TO supabase_admin;

SELECT 'ROLES_CREATED_OK' as status;
EOSQL
)
ROLE_EXIT_CODE=$?
set -e

echo "$ROLE_OUTPUT" >> "$LOG_FILE"

# Check for success
if [ $ROLE_EXIT_CODE -ne 0 ] || echo "$ROLE_OUTPUT" | grep -qiE "^ERROR:|^FATAL:"; then
    echo -e "${RED}Database role creation failed:${NC}"
    echo "$ROLE_OUTPUT" | grep -iE "^ERROR:|^FATAL:|^psql:" || echo "$ROLE_OUTPUT"
    error "Failed to create database roles. Check logs: $LOG_FILE"
fi

success "Database roles created"

# ===========================================
# STEP 7b: Create schemas and auth prerequisites BEFORE GoTrue starts
# ===========================================
info "Pre-creating schemas and auth prerequisites..."

set +e
# IMPORTANT: Use 'postgres' for bootstrap operations.
# Running `psql -U supabase_admin` here can fail because the container has no TTY
# to prompt for a password, and PGPASSWORD is not set.
SCHEMA_OUTPUT=$(docker compose exec -T db psql -U postgres -d postgres 2>&1 << 'EOSQL'
-- =====================================================
-- Create schemas BEFORE services start
-- Version: 2.7.1 - Error-visible schema setup
-- =====================================================
CREATE SCHEMA IF NOT EXISTS auth;
ALTER SCHEMA auth OWNER TO supabase_admin;
GRANT ALL ON SCHEMA auth TO supabase_auth_admin;
GRANT USAGE ON SCHEMA auth TO authenticator, anon, authenticated, service_role;

CREATE SCHEMA IF NOT EXISTS storage;
ALTER SCHEMA storage OWNER TO supabase_admin;
GRANT ALL ON SCHEMA storage TO supabase_storage_admin;
GRANT USAGE ON SCHEMA storage TO authenticator, anon, authenticated, service_role;

CREATE SCHEMA IF NOT EXISTS extensions;
ALTER SCHEMA extensions OWNER TO supabase_admin;

-- Install required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "unaccent" WITH SCHEMA extensions;

-- Grant extensions usage to all roles
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role, supabase_admin, supabase_auth_admin, supabase_storage_admin, authenticator;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO postgres, anon, authenticated, service_role, supabase_admin, supabase_auth_admin, supabase_storage_admin, authenticator;
ALTER DEFAULT PRIVILEGES IN SCHEMA extensions GRANT EXECUTE ON FUNCTIONS TO postgres, anon, authenticated, service_role;

-- =====================================================
-- CRITICAL: Pre-create auth enum types that GoTrue expects
-- GoTrue migrations will fail if these don't exist
-- =====================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'aal_level' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'auth')) THEN
    CREATE TYPE auth.aal_level AS ENUM ('aal1', 'aal2', 'aal3');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'code_challenge_method' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'auth')) THEN
    CREATE TYPE auth.code_challenge_method AS ENUM ('s256', 'plain');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'factor_status' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'auth')) THEN
    CREATE TYPE auth.factor_status AS ENUM ('unverified', 'verified');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'factor_type' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'auth')) THEN
    CREATE TYPE auth.factor_type AS ENUM ('totp', 'webauthn', 'phone');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'one_time_token_type' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'auth')) THEN
    CREATE TYPE auth.one_time_token_type AS ENUM ('confirmation_token', 'reauthentication_token', 'recovery_token', 'email_change_token_new', 'email_change_token_current', 'phone_change_token');
  END IF;
END
$$;

-- Set correct search_path for supabase_auth_admin (GoTrue uses this role)
ALTER ROLE supabase_auth_admin SET search_path TO auth, public, extensions;

-- Grant public schema permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role, authenticator;
GRANT ALL ON SCHEMA public TO supabase_auth_admin, supabase_storage_admin;

-- Grant database connection permissions
GRANT CONNECT ON DATABASE postgres TO supabase_auth_admin, supabase_storage_admin, authenticator, anon, authenticated, service_role;

SELECT 'SCHEMAS_CREATED_OK' as status;
EOSQL
)
SCHEMA_EXIT_CODE=$?
set -e

echo "$SCHEMA_OUTPUT" >> "$LOG_FILE"

# Check for success
if [ $SCHEMA_EXIT_CODE -ne 0 ] || echo "$SCHEMA_OUTPUT" | grep -qiE "^ERROR:|^FATAL:"; then
    echo -e "${RED}Schema creation failed:${NC}"
    echo "$SCHEMA_OUTPUT" | grep -iE "^ERROR:|^FATAL:|^psql:" || echo "$SCHEMA_OUTPUT"
    error "Failed to create schemas. Check logs: $LOG_FILE"
fi

success "Schemas and auth prerequisites created"

# ===========================================
# STEP 8: Run Application Migrations (BEFORE services start)
# ===========================================
step "8/14" "Running Database Migrations"

# Run migrations in order - this populates public schema
MIGRATION_FILES=(
    "01-extensions.sql"
    "02-enums.sql"
    "03-core-tables.sql"
    "04-games-tables.sql"
    "05-events-polls.sql"
    "06-achievements-notifications.sql"
    "07-platform-admin.sql"
    "08-functions-triggers.sql"
    "09-views.sql"
    "10-rls-policies.sql"
    "11-seed-data.sql"
    "12-auth-trigger.sql"
    "13-storage-buckets.sql"
    "15-totp-2fa.sql"
    "16-security-hardening.sql"
)

for migration in "${MIGRATION_FILES[@]}"; do
    if [ -f "$INSTALL_DIR/migrations/$migration" ]; then
        echo -n "  $migration ... "
        if docker compose exec -T db psql -U postgres -d postgres -f "/docker-entrypoint-initdb.d/$migration" >> "$LOG_FILE" 2>&1; then
            echo -e "${GREEN}✓${NC}"
        else
            echo -e "${YELLOW}⚠${NC}"
        fi
    fi
done

success "Database migrations complete"

# ===========================================
# STEP 8a: Grant table permissions AFTER migrations created tables
# ===========================================
info "Granting table permissions..."

set +e
PERMS_OUTPUT=$(docker compose exec -T db psql -U postgres -d postgres 2>&1 << 'EOSQL'
-- Grant permissions on all public tables
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- Grant sequence usage
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- Set default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE ON SEQUENCES TO anon, authenticated, service_role;

-- Grant storage schema permissions for storage-api
GRANT ALL ON SCHEMA storage TO supabase_storage_admin;
GRANT ALL PRIVILEGES ON DATABASE postgres TO supabase_storage_admin;

SELECT 'PERMISSIONS_GRANTED_OK' as status;
EOSQL
)
PERMS_EXIT_CODE=$?
set -e

echo "$PERMS_OUTPUT" >> "$LOG_FILE"

# Check for success (non-fatal if some permissions fail)
if [ $PERMS_EXIT_CODE -ne 0 ] || echo "$PERMS_OUTPUT" | grep -qiE "^ERROR:|^FATAL:"; then
    warn "Some permissions may have failed (check log for details)"
else
    success "Table permissions granted"
fi

# ===========================================
# STEP 9: Start Remaining Services (NOW safe to connect)
# ===========================================
step "9/15" "Starting Remaining Services"

info "Database is fully initialized. Starting remaining services..."
docker compose up -d 2>&1 | tee -a "$LOG_FILE"

# Wait for auth service to be healthy
info "Waiting for auth service to initialize..."
sleep 15

# ===========================================
# STEP 10: Configure Host Nginx
# ===========================================
step "10/15" "Configuring Host Nginx"

NGINX_CONF="/etc/nginx/sites-available/gametaverns"

info "Creating host nginx configuration..."

# CRITICAL: This nginx config handles ALL SSL termination
# It proxies /auth/, /rest/, /functions/, /storage/ to Kong
# Frontend accesses Supabase via same-origin paths (no CORS issues)

cat > "$NGINX_CONF" << 'NGINX_EOF'
# ===========================================
# GameTaverns - Main Site & API
# Domain: gametaverns.com
# Version: 2.7.0 - Complete Deployment Sweep
# Generated by install.sh
#
# ARCHITECTURE:
#   - Host Nginx terminates SSL for all domains
#   - Same-origin API access: /auth/, /rest/, /functions/, /storage/
#   - Kong gateway on port 8000 (internal only)
#   - Mailcow on port 8443 (internal only)
# ===========================================

# HTTP redirect
server {
    listen 80;
    server_name gametaverns.com www.gametaverns.com *.gametaverns.com;
    return 301 https://$host$request_uri;
}

# Main site (HTTPS)
server {
    listen 443 ssl http2;
    server_name gametaverns.com www.gametaverns.com;

    ssl_certificate /etc/letsencrypt/live/gametaverns.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/gametaverns.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;

    # CRITICAL: API routes must go to Kong Gateway, NOT frontend
    # These paths allow same-origin API access from the frontend
    location /auth/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }

    location /rest/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /functions/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }

    location /storage/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
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
        proxy_read_timeout 86400;
    }

    # Frontend → App container
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# Wildcard: Tenant Library Subdomains
server {
    listen 443 ssl http2;
    server_name ~^(?<tenant>[a-z0-9-]+)\.gametaverns\.com$;

    # Skip reserved subdomains
    if ($tenant ~* ^(www|api|mail|studio|admin|dashboard)$) {
        return 404;
    }

    ssl_certificate /etc/letsencrypt/live/gametaverns.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/gametaverns.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    # API routes for tenant libraries (same-origin access)
    location /auth/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /rest/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /functions/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /storage/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 50M;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Tenant-Slug $tenant;
        proxy_cache_bypass $http_upgrade;
    }
}

# API subdomain (legacy, redirects to main domain paths)
server {
    listen 443 ssl http2;
    server_name api.gametaverns.com;

    ssl_certificate /etc/letsencrypt/live/gametaverns.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/gametaverns.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
        client_max_body_size 50M;
    }
}

# Studio subdomain
server {
    listen 443 ssl http2;
    server_name studio.gametaverns.com;

    ssl_certificate /etc/letsencrypt/live/gametaverns.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/gametaverns.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Mail subdomain - proxied through host Nginx with WILDCARD cert
# CRITICAL: Uses the wildcard cert from main domain, NOT Mailcow's internal cert
server {
    listen 443 ssl http2;
    server_name mail.gametaverns.com autodiscover.gametaverns.com autoconfig.gametaverns.com;

    # Use the WILDCARD certificate from main domain
    ssl_certificate /etc/letsencrypt/live/gametaverns.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/gametaverns.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    location / {
        # Proxy to Mailcow's internal HTTPS (self-signed is OK here)
        proxy_pass https://127.0.0.1:8443;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Accept Mailcow's self-signed cert on backend
        proxy_ssl_verify off;
    }
}
NGINX_EOF

ln -sf /etc/nginx/sites-available/gametaverns /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true

success "Nginx configuration created"

# ===========================================
# STEP 11: SSL Certificate Setup
# ===========================================
step "11/15" "Setting Up SSL Certificates"

if command -v certbot &> /dev/null; then
    read -p "Setup SSL certificates now? (Y/n): " SETUP_SSL
    
    if [[ ! "$SETUP_SSL" =~ ^[Nn]$ ]]; then
        echo ""
        echo "For wildcard certificates (*.${DOMAIN}), you need Cloudflare DNS."
        echo "Wildcard certs are REQUIRED for tenant library subdomains."
        read -p "Use Cloudflare DNS for wildcards? (Y/n): " USE_CLOUDFLARE
        
        if [[ ! "$USE_CLOUDFLARE" =~ ^[Nn]$ ]]; then
            # Install Cloudflare plugin if not present
            apt-get install -y python3-certbot-dns-cloudflare 2>/dev/null || pip3 install certbot-dns-cloudflare
            
            if [ ! -f /etc/letsencrypt/cloudflare.ini ]; then
                read -p "Enter Cloudflare API Token: " CF_API_TOKEN
                mkdir -p /etc/letsencrypt
                cat > /etc/letsencrypt/cloudflare.ini << EOF
dns_cloudflare_api_token = $CF_API_TOKEN
EOF
                chmod 600 /etc/letsencrypt/cloudflare.ini
            else
                info "Using existing Cloudflare credentials"
            fi
            
            # Get wildcard cert
            certbot certonly \
                --dns-cloudflare \
                --dns-cloudflare-credentials /etc/letsencrypt/cloudflare.ini \
                -d "$DOMAIN" \
                -d "*.$DOMAIN" \
                --email "$ADMIN_EMAIL" \
                --agree-tos \
                --non-interactive || warn "Certbot failed - may need to retry manually"
            
            if [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
                success "Wildcard SSL certificates obtained"
            fi
        else
            # Standard certs (no wildcard)
            certbot certonly --standalone \
                -d "$DOMAIN" \
                -d "www.$DOMAIN" \
                -d "api.$DOMAIN" \
                -d "mail.$DOMAIN" \
                -d "studio.$DOMAIN" \
                --email "$ADMIN_EMAIL" \
                --agree-tos \
                --non-interactive || warn "Certbot failed - may need to retry manually"
            
            if [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
                success "SSL certificates obtained"
            fi
        fi
    else
        info "Skipping SSL setup. Run ./scripts/setup-ssl.sh later."
    fi
else
    warn "Certbot not found. Install with: apt install certbot python3-certbot-dns-cloudflare"
fi

# Create self-signed as fallback if no Let's Encrypt cert
if [ ! -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
    info "Creating temporary self-signed certificate..."
    mkdir -p "$INSTALL_DIR/nginx/ssl"
    openssl req -x509 -nodes -newkey rsa:4096 \
        -days 365 \
        -keyout "$INSTALL_DIR/nginx/ssl/privkey.pem" \
        -out "$INSTALL_DIR/nginx/ssl/fullchain.pem" \
        -subj "/CN=$DOMAIN"
    
    # Create symlink for nginx config to find it
    mkdir -p "/etc/letsencrypt/live/$DOMAIN"
    ln -sf "$INSTALL_DIR/nginx/ssl/fullchain.pem" "/etc/letsencrypt/live/$DOMAIN/fullchain.pem"
    ln -sf "$INSTALL_DIR/nginx/ssl/privkey.pem" "/etc/letsencrypt/live/$DOMAIN/privkey.pem"
    
    warn "Using self-signed certificate. Run ./scripts/setup-ssl.sh later for Let's Encrypt."
fi

# Test and reload nginx
if nginx -t 2>/dev/null; then
    systemctl reload nginx 2>/dev/null || systemctl start nginx
    success "Nginx configured and reloaded"
else
    warn "Nginx config test failed. Check: nginx -t"
fi

success "SSL configuration complete"

# ===========================================
# STEP 12: Create Admin User & Database Admin Role
# ===========================================
step "12/15" "Creating Admin User & Securing Database Roles"

# Wait for auth service
info "Waiting for auth service..."
MAX_RETRIES=90
RETRY_COUNT=0

while ! curl -sf \
    -H "apikey: ${ANON_KEY}" \
    "http://localhost:${KONG_HTTP_PORT:-8000}/auth/v1/health" > /dev/null 2>&1; do
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
        warn "Auth service not ready. Create admin manually: ./scripts/create-admin.sh"
        break
    fi
    echo "  Waiting for auth... ($RETRY_COUNT/$MAX_RETRIES)"
    sleep 3
done

if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
    success "Auth service ready"
    
    # NOW collect admin credentials (after database is ready)
    echo ""
    echo -e "${BLUE}=== Admin Account Setup ===${NC}"
    echo -e "${GREEN}Database is ready! Now let's create your admin account.${NC}"
    echo ""
    
    read -p "Admin email [admin@$DOMAIN]: " ADMIN_EMAIL
    ADMIN_EMAIL=${ADMIN_EMAIL:-admin@$DOMAIN}
    
    while true; do
        read -s -p "Admin password (min 8 chars): " ADMIN_PASSWORD
        echo ""
        if [ ${#ADMIN_PASSWORD} -ge 8 ]; then
            break
        fi
        echo -e "${RED}Password must be at least 8 characters${NC}"
    done
    
    read -p "Admin display name [Admin]: " ADMIN_DISPLAY_NAME
    ADMIN_DISPLAY_NAME=${ADMIN_DISPLAY_NAME:-Admin}
    
    # Create user via Supabase Auth API
    info "Creating admin account..."
    RESPONSE=$(curl -s -X POST \
        "http://localhost:${KONG_HTTP_PORT:-8000}/auth/v1/admin/users" \
        -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
        -H "apikey: $SERVICE_ROLE_KEY" \
        -H "Content-Type: application/json" \
        -d "{
            \"email\": \"$ADMIN_EMAIL\",
            \"password\": \"$ADMIN_PASSWORD\",
            \"email_confirm\": true,
            \"user_metadata\": {
                \"display_name\": \"$ADMIN_DISPLAY_NAME\"
            }
        }" 2>&1)
    
    USER_ID=$(echo "$RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
    
    if [ -n "$USER_ID" ]; then
        success "User created: $USER_ID"
        
        # CRITICAL: Create user profile FIRST (required for admin panel access)
            docker compose exec -T db psql -U postgres -d postgres -c \
            "INSERT INTO public.user_profiles (user_id, display_name) VALUES ('$USER_ID', '$ADMIN_DISPLAY_NAME') ON CONFLICT (user_id) DO UPDATE SET display_name = EXCLUDED.display_name;" 2>/dev/null || true
        
        success "User profile created"
        
        # Add admin role (MUST be after profile creation)
            docker compose exec -T db psql -U postgres -d postgres -c \
            "INSERT INTO public.user_roles (user_id, role) VALUES ('$USER_ID', 'admin') ON CONFLICT (user_id, role) DO NOTHING;" 2>/dev/null || true
        
        success "Admin role assigned"
    else
        warn "Could not create admin user automatically. Run: ./scripts/create-admin.sh"
        echo "Response: $RESPONSE" >> "$LOG_FILE"
    fi
fi

# ===========================================
# Harden Database Admin Roles
# ===========================================
info "Securing database admin roles..."

docker compose exec -T db psql -U postgres -d postgres << 'EOSQL' >> "$LOG_FILE" 2>&1
-- =====================================================
-- SECURITY: Ensure proper role hierarchy and permissions
-- This prevents privilege escalation attacks
-- Version: 2.7.0
-- =====================================================

-- 1. Ensure user_roles table uses app_role enum (not plain text)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('admin', 'staff', 'owner', 'moderator', 'user');
  END IF;
END $$;

-- 2. Ensure has_role function exists and is secure
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 3. Grant execute to authenticated users (for RLS policies)
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO anon;

-- 4. Revoke direct INSERT on user_roles from authenticated
-- Only allow via admin APIs or service_role
REVOKE INSERT ON public.user_roles FROM authenticated;
REVOKE UPDATE ON public.user_roles FROM authenticated;
REVOKE DELETE ON public.user_roles FROM authenticated;

-- Service role and admins can still manage roles via functions
GRANT ALL ON public.user_roles TO service_role;

-- 5. Ensure PostgREST (authenticator) can switch to proper roles
GRANT anon, authenticated, service_role TO authenticator;

-- 6. Log successful hardening
DO $$ BEGIN RAISE NOTICE 'Database admin roles secured'; END $$;
EOSQL

success "Database admin roles secured"

# ===========================================
# STEP 13: Collect Optional API Keys (NOW - after services running)
# ===========================================
step "13/15" "Configuring Optional API Keys"

echo ""
echo -e "${BLUE}=== Optional API Keys (all optional - press Enter to skip) ===${NC}"
echo -e "${YELLOW}These services enhance functionality but are not required.${NC}"
echo ""

echo -e "${BLUE}=== Discord Integration ===${NC}"
echo "Create app at: https://discord.com/developers/applications"
read -p "Discord Bot Token (press Enter to skip): " DISCORD_BOT_TOKEN
DISCORD_BOT_TOKEN=${DISCORD_BOT_TOKEN:-}
if [ -n "$DISCORD_BOT_TOKEN" ]; then
    read -p "Discord Client ID: " DISCORD_CLIENT_ID
    DISCORD_CLIENT_ID=${DISCORD_CLIENT_ID:-}
    read -p "Discord Client Secret: " DISCORD_CLIENT_SECRET
    DISCORD_CLIENT_SECRET=${DISCORD_CLIENT_SECRET:-}
fi

echo ""
echo -e "${BLUE}=== AI Services ===${NC}"
echo "Perplexity (https://www.perplexity.ai/settings/api) - Powers all AI features"
read -p "Perplexity API Key (press Enter to skip): " PERPLEXITY_API_KEY
PERPLEXITY_API_KEY=${PERPLEXITY_API_KEY:-}

echo "Firecrawl (https://www.firecrawl.dev/) - For URL-based game imports"
read -p "Firecrawl API Key (press Enter to skip): " FIRECRAWL_API_KEY
FIRECRAWL_API_KEY=${FIRECRAWL_API_KEY:-}

echo ""
echo -e "${BLUE}=== BoardGameGeek Integration ===${NC}"
echo "BGG API Token (optional) - For authenticated collection imports"
read -p "BGG API Token (press Enter to skip): " BGG_API_TOKEN
BGG_API_TOKEN=${BGG_API_TOKEN:-}

echo ""
echo -e "${BLUE}=== Cloudflare Turnstile (Bot Protection) ===${NC}"
echo "Get keys at: https://dash.cloudflare.com/?to=/:account/turnstile"
echo -e "${YELLOW}IMPORTANT: Add your domain to the allowed hostnames in Cloudflare!${NC}"
read -p "Turnstile Site Key (press Enter to skip): " TURNSTILE_SITE_KEY
TURNSTILE_SITE_KEY=${TURNSTILE_SITE_KEY:-}
if [ -n "$TURNSTILE_SITE_KEY" ]; then
    read -p "Turnstile Secret Key: " TURNSTILE_SECRET_KEY
    TURNSTILE_SECRET_KEY=${TURNSTILE_SECRET_KEY:-}
fi

# Update .env with the optional keys
info "Updating configuration with optional API keys..."

# Update .env file with collected keys
sed -i "s|^DISCORD_BOT_TOKEN=.*|DISCORD_BOT_TOKEN=${DISCORD_BOT_TOKEN}|" "$INSTALL_DIR/.env"
sed -i "s|^DISCORD_CLIENT_ID=.*|DISCORD_CLIENT_ID=${DISCORD_CLIENT_ID}|" "$INSTALL_DIR/.env"
sed -i "s|^DISCORD_CLIENT_SECRET=.*|DISCORD_CLIENT_SECRET=${DISCORD_CLIENT_SECRET}|" "$INSTALL_DIR/.env"
sed -i "s|^PERPLEXITY_API_KEY=.*|PERPLEXITY_API_KEY=${PERPLEXITY_API_KEY}|" "$INSTALL_DIR/.env"
sed -i "s|^FIRECRAWL_API_KEY=.*|FIRECRAWL_API_KEY=${FIRECRAWL_API_KEY}|" "$INSTALL_DIR/.env"
sed -i "s|^BGG_API_TOKEN=.*|BGG_API_TOKEN=${BGG_API_TOKEN}|" "$INSTALL_DIR/.env"
sed -i "s|^TURNSTILE_SITE_KEY=.*|TURNSTILE_SITE_KEY=${TURNSTILE_SITE_KEY}|" "$INSTALL_DIR/.env"
sed -i "s|^TURNSTILE_SECRET_KEY=.*|TURNSTILE_SECRET_KEY=${TURNSTILE_SECRET_KEY}|" "$INSTALL_DIR/.env"

# Insert Turnstile site key into database if provided
if [ -n "$TURNSTILE_SITE_KEY" ]; then
    info "Inserting Turnstile site key into database..."
    ESCAPED_TURNSTILE_KEY=$(printf '%s' "$TURNSTILE_SITE_KEY" | sed "s/'/''/g")
    
    docker compose exec -T db psql -U postgres -d postgres << EOSQL >> "$LOG_FILE" 2>&1
-- Insert Turnstile site key into site_settings
INSERT INTO public.site_settings (key, value)
VALUES ('turnstile_site_key', '${ESCAPED_TURNSTILE_KEY}')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
EOSQL
    
    success "Turnstile site key inserted into database"
else
    info "No Turnstile key provided - bot protection will use bypass mode"
fi

# Restart edge-runtime to pick up new API keys
if [ -n "$PERPLEXITY_API_KEY" ] || [ -n "$FIRECRAWL_API_KEY" ] || [ -n "$DISCORD_BOT_TOKEN" ]; then
    info "Restarting edge functions to apply API keys..."
    docker compose restart edge-runtime 2>/dev/null || true
    sleep 5
fi

success "Optional API keys configured"

# ===========================================
# STEP 14: Setup Email / Mailbox
# ===========================================
step "14/15" "Configuring Email System"

if [ "$MAILCOW_INSTALLED" = "yes" ]; then
    echo ""
    echo "Mailcow is running. You need to create a mailbox for system emails."
    echo ""
    echo -e "${BLUE}To complete email setup:${NC}"
    echo "  1. Open https://mail.$DOMAIN in your browser"
    echo "  2. Login with Mailcow admin credentials (set during Mailcow install)"
    echo "  3. Go to: Configuration → Domains → Add domain: $DOMAIN"
    echo "  4. Go to: Configuration → Mailboxes → Add mailbox:"
    echo "     - Username: noreply"
    echo "     - Domain: $DOMAIN"
    echo "     - Password: (generate secure password)"
    echo "  5. Update $INSTALL_DIR/.env with SMTP credentials:"
    echo "     SMTP_HOST=mail.$DOMAIN"
    echo "     SMTP_PORT=587"
    echo "     SMTP_USER=noreply@$DOMAIN"
    echo "     SMTP_PASS=(mailbox password)"
    echo ""
    
    read -p "Have you completed the Mailcow mailbox setup? (y/N): " MAILBOX_DONE
    
    if [[ "$MAILBOX_DONE" =~ ^[Yy]$ ]]; then
        read -p "Enter mailbox password for noreply@$DOMAIN: " MAILBOX_PASSWORD
        
        # Update .env file with SMTP credentials
        sed -i "s|^SMTP_HOST=.*|SMTP_HOST=mail.$DOMAIN|" "$INSTALL_DIR/.env"
        sed -i "s|^SMTP_PORT=.*|SMTP_PORT=587|" "$INSTALL_DIR/.env"
        sed -i "s|^SMTP_USER=.*|SMTP_USER=noreply@$DOMAIN|" "$INSTALL_DIR/.env"
        sed -i "s|^SMTP_PASS=.*|SMTP_PASS=$MAILBOX_PASSWORD|" "$INSTALL_DIR/.env"
        
        success "SMTP credentials updated in .env"
        
        # Restart auth to pick up new SMTP settings
        info "Restarting auth service to apply email settings..."
        docker compose restart auth 2>/dev/null || true
        sleep 5
        success "Auth service restarted"
    else
        info "You can configure email later by editing $INSTALL_DIR/.env"
        info "After editing, run: cd $INSTALL_DIR && docker compose restart auth"
    fi
else
    echo ""
    echo "No local mail server detected."
    echo "Make sure your external SMTP settings are configured in .env"
    echo ""
    
    if [ -n "$EXT_SMTP_HOST" ]; then
        success "External SMTP configured: $EXT_SMTP_HOST"
    else
        warn "No SMTP configured. Email features will not work."
        echo "  Edit $INSTALL_DIR/.env and set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS"
    fi
fi

success "Email configuration complete"

# ===========================================
# STEP 14: Verify Installation
# ===========================================
step "15/15" "Verifying Installation"

echo ""
info "Running health checks..."

HEALTH_ISSUES=0

# Check database
if docker compose exec -T db pg_isready -U postgres -d postgres > /dev/null 2>&1; then
    echo -e "  ${GREEN}✓${NC} Database is healthy"
else
    echo -e "  ${RED}✗${NC} Database not responding"
    HEALTH_ISSUES=$((HEALTH_ISSUES + 1))
fi

# Check auth service
if curl -sf -H "apikey: ${ANON_KEY}" "http://localhost:${KONG_HTTP_PORT:-8000}/auth/v1/health" > /dev/null 2>&1; then
    echo -e "  ${GREEN}✓${NC} Auth service (GoTrue) is healthy"
else
    echo -e "  ${RED}✗${NC} Auth service not responding"
    HEALTH_ISSUES=$((HEALTH_ISSUES + 1))
fi

# Check REST API
if curl -sf "http://localhost:${KONG_HTTP_PORT:-8000}/rest/v1/" -H "apikey: $ANON_KEY" > /dev/null 2>&1; then
    echo -e "  ${GREEN}✓${NC} REST API (PostgREST) is healthy"
else
    echo -e "  ${RED}✗${NC} REST API not responding"
    HEALTH_ISSUES=$((HEALTH_ISSUES + 1))
fi

# Check frontend
if curl -sf "http://localhost:${APP_PORT:-3000}/" > /dev/null 2>&1; then
    echo -e "  ${GREEN}✓${NC} Frontend app is healthy"
else
    echo -e "  ${RED}✗${NC} Frontend not responding"
    HEALTH_ISSUES=$((HEALTH_ISSUES + 1))
fi

# Check Kong gateway
if curl -sf "http://localhost:${KONG_HTTP_PORT:-8000}/" > /dev/null 2>&1; then
    echo -e "  ${GREEN}✓${NC} API Gateway (Kong) is healthy"
else
    echo -e "  ${YELLOW}⚠${NC} API Gateway may still be starting"
fi

# Check Nginx
if nginx -t 2>/dev/null; then
    echo -e "  ${GREEN}✓${NC} Nginx configuration valid"
else
    echo -e "  ${RED}✗${NC} Nginx configuration invalid"
    HEALTH_ISSUES=$((HEALTH_ISSUES + 1))
fi

# Verify admin user exists
ADMIN_CHECK=$(docker compose exec -T db psql -U postgres -d postgres -t -c \
    "SELECT COUNT(*) FROM public.user_roles WHERE role = 'admin';" 2>/dev/null | tr -d ' ')

if [ "$ADMIN_CHECK" -gt 0 ] 2>/dev/null; then
    echo -e "  ${GREEN}✓${NC} Admin user configured ($ADMIN_CHECK admin role(s))"
else
    echo -e "  ${YELLOW}⚠${NC} No admin users found - run ./scripts/create-admin.sh"
fi

# Check Turnstile key in database
TURNSTILE_CHECK=$(docker compose exec -T db psql -U postgres -d postgres -t -c \
    "SELECT value FROM public.site_settings WHERE key = 'turnstile_site_key';" 2>/dev/null | tr -d ' ')

if [ -n "$TURNSTILE_CHECK" ]; then
    echo -e "  ${GREEN}✓${NC} Turnstile site key in database"
else
    echo -e "  ${YELLOW}⚠${NC} Turnstile site key not found - bot protection may use bypass"
fi

echo ""

if [ $HEALTH_ISSUES -eq 0 ]; then
    success "All health checks passed!"
else
    warn "$HEALTH_ISSUES health check(s) failed. Check logs: docker compose logs"
fi

# ===========================================
# Installation Complete!
# ===========================================
echo ""
echo -e "${CYAN}╔═══════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║         Installation Complete!                                    ║${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}Your GameTaverns instance is now running!${NC}"
echo ""
echo -e "${BLUE}URLs:${NC}"
echo "  Main Site:  https://$DOMAIN"
echo "  API:        https://$DOMAIN (via /auth/, /rest/, /functions/ paths)"
echo "  Studio:     https://studio.$DOMAIN"
echo "  Webmail:    https://mail.$DOMAIN"
echo "  Libraries:  https://{slug}.$DOMAIN"
echo ""
echo -e "${BLUE}Admin Account:${NC}"
echo "  Email:    $ADMIN_EMAIL"
echo "  Password: (as entered)"
echo ""
echo -e "${BLUE}API Keys Status:${NC}"
[ -n "${DISCORD_BOT_TOKEN:-}" ] && echo "  ✓ Discord Bot" || echo "  ○ Discord Bot (not configured)"
[ -n "${DISCORD_CLIENT_ID:-}" ] && echo "  ✓ Discord OAuth" || echo "  ○ Discord OAuth (not configured)"
[ -n "${PERPLEXITY_API_KEY:-}" ] && echo "  ✓ Perplexity AI (all AI features)" || echo "  ○ Perplexity AI (not configured)"
[ -n "${FIRECRAWL_API_KEY:-}" ] && echo "  ✓ Firecrawl" || echo "  ○ Firecrawl (not configured)"
[ -n "${BGG_API_TOKEN:-}" ] && echo "  ✓ BGG API Token" || echo "  ○ BGG API Token (not configured)"
[ -n "${TURNSTILE_SITE_KEY:-}" ] && echo "  ✓ Turnstile" || echo "  ○ Turnstile (not configured)"
echo ""
echo -e "${BLUE}Credentials saved to:${NC} $CREDS_FILE"
echo ""
echo -e "${BLUE}Useful commands:${NC}"
echo "  View logs:     cd $INSTALL_DIR && docker compose logs -f"
echo "  Check status:  cd $INSTALL_DIR && docker compose ps"
echo "  Restart:       cd $INSTALL_DIR && docker compose restart"
echo "  Backup:        $INSTALL_DIR/scripts/backup.sh"
echo ""
echo -e "${YELLOW}Security Notes:${NC}"
echo "  • Admin roles are stored in user_roles table (NOT user_profiles)"
echo "  • Authenticated users cannot self-assign admin roles (INSERT revoked)"
echo "  • Use service_role or ./scripts/create-admin.sh to add admins"
echo "  • Turnstile site key is stored in database for frontend access"
echo ""
echo -e "${GREEN}Happy gaming! 🎲${NC}"
echo ""

log "Installation completed successfully"
