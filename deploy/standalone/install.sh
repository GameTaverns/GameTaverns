#!/bin/bash
#
# Game Haven - One-Click Installer
# Sets up config, starts the stack, runs migrations, and creates admin user
#
# Usage:
#   ./install.sh        - Install v1 (full Supabase stack)
#   ./install.sh --v2   - Install v2 (simplified Express/Node.js stack)
#

set -e

# ==========================================
# CHECK FOR V2 FLAG
# ==========================================

if [ "$1" = "--v2" ] || [ "$1" = "-v2" ]; then
    chmod +x ./install-v2.sh
    exec ./install-v2.sh
    exit 0
fi

# ==========================================
# V1 INSTALLATION (SUPABASE STACK)
# ==========================================

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Defaults
DEFAULT_SITE_NAME="Game Haven"
DEFAULT_APP_PORT="3000"
DEFAULT_STUDIO_PORT="3001"
DEFAULT_POSTGRES_PORT="5432"
DEFAULT_GATEWAY_PORT="8000"

# ==========================================
# HELPER FUNCTIONS (must be defined early)
# ==========================================

# Function to prompt with default
prompt() {
    local var_name=$1
    local prompt_text=$2
    local default_value=$3
    local is_secret=${4:-false}
    
    if [ "$is_secret" = true ]; then
        read -sp "$(echo -e "${BLUE}?${NC} $prompt_text ${YELLOW}[hidden]${NC}: ")" value
        echo ""
    else
        read -p "$(echo -e "${BLUE}?${NC} $prompt_text ${YELLOW}[$default_value]${NC}: ")" value
    fi
    
    eval "$var_name=\"${value:-$default_value}\""
}

# Function for yes/no with default
prompt_yn() {
    local var_name=$1
    local prompt_text=$2
    local default=${3:-y}
    
    if [ "$default" = "y" ]; then
        options="Y/n"
    else
        options="y/N"
    fi
    
    read -p "$(echo -e "${BLUE}?${NC} $prompt_text ${YELLOW}[$options]${NC}: ")" value
    value=${value:-$default}
    
    if [[ "$value" =~ ^[Yy] ]]; then
        eval "$var_name=true"
    else
        eval "$var_name=false"
    fi
}

# Generate secure random string (strip newlines from openssl output)
generate_secret() {
    openssl rand -base64 ${1:-32} | tr -d '/+=\n' | head -c ${1:-32}
}

# Generate JWT (proper HMAC-SHA256 signing)
generate_jwt() {
    local role=$1
    local secret=$2
    
    # Header: {"alg":"HS256","typ":"JWT"}
    local header=$(echo -n '{"alg":"HS256","typ":"JWT"}' | openssl base64 -e | tr -d '=' | tr '/+' '_-' | tr -d '\n')
    
    # Payload with required claims for GoTrue admin endpoints.
    local payload=$(echo -n "{\"role\":\"$role\",\"iss\":\"supabase\",\"aud\":\"authenticated\",\"sub\":\"00000000-0000-0000-0000-000000000000\",\"iat\":$(date +%s),\"exp\":2524608000}" | openssl base64 -e | tr -d '=' | tr '/+' '_-' | tr -d '\n')
    
    # Signature
    local signature=$(echo -n "${header}.${payload}" | openssl dgst -sha256 -hmac "$secret" -binary | openssl base64 -e | tr -d '=' | tr '/+' '_-' | tr -d '\n')
    
    echo "${header}.${payload}.${signature}"
}

# Escape value for safe use in double-quoted .env strings
escape_env_value() {
    local val="$1"
    printf '%s' "$val" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' -e 's/\$/\\$/g' -e 's/`/\\`/g'
}

# ==========================================
# EXISTING INSTALL DETECTION
# ==========================================

EXISTING_ENV=false
if [ -f .env ]; then
    EXISTING_ENV=true
fi

EXISTING_DB_VOLUME=false
if docker volume inspect gamehaven-db >/dev/null 2>&1; then
    EXISTING_DB_VOLUME=true
fi

echo ""
TITLE="Game Haven - Self-Hosted Installation"
INNER_WIDTH=62
BORDER=$(printf '%*s' "$INNER_WIDTH" '' | tr ' ' '═')
PAD_LEFT=$(( (INNER_WIDTH - ${#TITLE}) / 2 ))
PAD_RIGHT=$(( INNER_WIDTH - ${#TITLE} - PAD_LEFT ))

echo -e "${CYAN}╔${BORDER}╗${NC}"
echo -e "${CYAN}║${NC}$(printf '%*s' "$PAD_LEFT" '')${BOLD}${TITLE}${NC}$(printf '%*s' "$PAD_RIGHT" '')${CYAN}║${NC}"
echo -e "${CYAN}╚${BORDER}╝${NC}"
echo ""

# If we detect an existing install, default to reusing secrets.
# Changing POSTGRES_PASSWORD/JWT_SECRET while keeping the existing DB volume
# will break auth/rest connectivity.
REUSE_EXISTING_SECRETS=false
if [ "$EXISTING_ENV" = true ] || [ "$EXISTING_DB_VOLUME" = true ]; then
    echo -e "${YELLOW}${BOLD}Existing installation detected.${NC}"
    if [ "$EXISTING_DB_VOLUME" = true ]; then
        echo -e "${YELLOW}- Found docker volume: gamehaven-db${NC}"
    fi
    if [ "$EXISTING_ENV" = true ]; then
        echo -e "${YELLOW}- Found .env in this directory${NC}"
    fi
    echo -e "${YELLOW}Re-running install with NEW secrets while keeping the existing DB volume will prevent the auth service from starting.${NC}"
    echo ""
    prompt_yn REUSE_EXISTING_SECRETS "Reuse existing secrets (.env) and keep the current database?" "y"
    echo ""
fi

# ==========================================
# COLLECT CONFIGURATION
# ==========================================

echo -e "${BOLD}━━━ Site Configuration ━━━${NC}"
echo ""

# If reusing secrets, also reuse the previous site config as defaults.
if [ "$REUSE_EXISTING_SECRETS" = true ] && [ -f .env ]; then
    # shellcheck disable=SC1091
    source .env
    DEFAULT_SITE_NAME="${SITE_NAME:-$DEFAULT_SITE_NAME}"
    DEFAULT_APP_PORT="${APP_PORT:-$DEFAULT_APP_PORT}"
    DEFAULT_STUDIO_PORT="${STUDIO_PORT:-$DEFAULT_STUDIO_PORT}"
    DEFAULT_POSTGRES_PORT="${POSTGRES_PORT:-$DEFAULT_POSTGRES_PORT}"
    DEFAULT_GATEWAY_PORT="${GATEWAY_PORT:-${KONG_HTTP_PORT:-$DEFAULT_GATEWAY_PORT}}"
fi

prompt SITE_NAME "Site name" "$DEFAULT_SITE_NAME"
prompt SITE_DESCRIPTION "Site description" "${SITE_DESCRIPTION:-Browse and discover our collection of board games}"
prompt SITE_AUTHOR "Site author/owner name" "${SITE_AUTHOR:-$SITE_NAME}"

echo ""
echo -e "${BOLD}━━━ Domain & Ports ━━━${NC}"
echo ""

prompt DOMAIN "Domain (or localhost for local dev)" "localhost"
prompt APP_PORT "Application port" "$DEFAULT_APP_PORT"
prompt STUDIO_PORT "Admin Studio port (optional)" "$DEFAULT_STUDIO_PORT"
prompt POSTGRES_PORT "PostgreSQL port" "$DEFAULT_POSTGRES_PORT"
prompt GATEWAY_PORT "API Gateway port" "$DEFAULT_GATEWAY_PORT"

# Build URLs
if [ "$DOMAIN" = "localhost" ]; then
    SITE_URL="http://localhost:$APP_PORT"
    API_URL="http://localhost:$GATEWAY_PORT"
else
    prompt_yn USE_HTTPS "Use HTTPS?" "y"
    if [ "$USE_HTTPS" = true ]; then
        SITE_URL="https://$DOMAIN"
        # IMPORTANT: Our Nginx setup proxies the API gateway at /api on the same domain.
        # Using https://api.<domain> requires separate DNS + separate vhost config.
        API_URL="https://$DOMAIN/api"
    else
        SITE_URL="http://$DOMAIN:$APP_PORT"
        API_URL="http://$DOMAIN:$KONG_PORT"
    fi
fi

echo ""
echo -e "${BOLD}━━━ Features ━━━${NC}"
echo ""
echo -e "${CYAN}Toggle features for your installation:${NC}"
echo ""

prompt_yn FEATURE_PLAY_LOGS "Enable Play Logs (track game sessions)?" "y"
prompt_yn FEATURE_WISHLIST "Enable Wishlist (visitors can vote for games)?" "y"
prompt_yn FEATURE_FOR_SALE "Enable For Sale section?" "y"
prompt_yn FEATURE_MESSAGING "Enable Contact Seller messaging?" "y"
prompt_yn FEATURE_RATINGS "Enable Ratings (visitors can rate games)?" "y"
prompt_yn FEATURE_COMING_SOON "Enable Coming Soon section?" "y"
prompt_yn FEATURE_DEMO_MODE "Enable Demo Mode (uses mock data)?" "n"

echo ""
echo -e "${BOLD}━━━ Email Configuration (Optional) ━━━${NC}"
echo ""
echo -e "${CYAN}Configure SMTP for password reset and notifications.${NC}"
echo -e "${CYAN}Leave blank to skip email configuration.${NC}"
echo ""

prompt SMTP_HOST "SMTP host" ""

if [ -n "$SMTP_HOST" ]; then
    prompt SMTP_PORT "SMTP port" "587"
    prompt SMTP_USER "SMTP username" ""
    prompt SMTP_PASS "SMTP password" "" true
    prompt SMTP_FROM "From email address" "noreply@$DOMAIN"
    MAILER_AUTOCONFIRM=false
else
    SMTP_PORT=""
    SMTP_USER=""
    SMTP_PASS=""
    SMTP_FROM=""
    MAILER_AUTOCONFIRM=true
    echo -e "${YELLOW}Skipping email - users will be auto-confirmed.${NC}"
fi

echo ""
echo -e "${BOLD}━━━ AI Configuration (Optional, BYOK) ━━━${NC}"
echo ""
echo -e "${CYAN}Configure AI for BGG data extraction and description condensing.${NC}"
echo -e "${CYAN}Bring Your Own Key - supports multiple providers.${NC}"
echo ""

# Initialize all AI keys as empty
PERPLEXITY_API_KEY=""
OPENAI_API_KEY=""
ANTHROPIC_API_KEY=""
GOOGLE_AI_API_KEY=""

echo -e "${BOLD}Select AI Provider:${NC}"
echo ""
echo -e "  ${CYAN}1)${NC} Perplexity (recommended - pplx-...)"
echo -e "  ${CYAN}2)${NC} OpenAI (sk-...)"
echo -e "  ${CYAN}3)${NC} Anthropic Claude (sk-ant-...)"
echo -e "  ${CYAN}4)${NC} Google Gemini (AIza...)"
echo -e "  ${CYAN}5)${NC} Skip - no AI features"
echo ""

read -p "$(echo -e "${BLUE}?${NC} Choose provider ${YELLOW}[1-5]${NC}: ")" AI_CHOICE

case "$AI_CHOICE" in
    1)
        prompt PERPLEXITY_API_KEY "Perplexity API key" "" true
        if [ -n "$PERPLEXITY_API_KEY" ]; then
            echo -e "${GREEN}✓${NC} Perplexity AI configured"
        fi
        ;;
    2)
        prompt OPENAI_API_KEY "OpenAI API key" "" true
        if [ -n "$OPENAI_API_KEY" ]; then
            echo -e "${GREEN}✓${NC} OpenAI configured"
        fi
        ;;
    3)
        prompt ANTHROPIC_API_KEY "Anthropic API key" "" true
        if [ -n "$ANTHROPIC_API_KEY" ]; then
            echo -e "${GREEN}✓${NC} Anthropic Claude configured"
        fi
        ;;
    4)
        prompt GOOGLE_AI_API_KEY "Google AI API key" "" true
        if [ -n "$GOOGLE_AI_API_KEY" ]; then
            echo -e "${GREEN}✓${NC} Google Gemini configured"
        fi
        ;;
    *)
        echo -e "${YELLOW}Skipping AI - BGG imports will have basic data only.${NC}"
        ;;
esac

echo ""
echo -e "${BOLD}━━━ Admin Studio ━━━${NC}"
echo ""

prompt_yn ENABLE_STUDIO "Enable Supabase Studio (database admin UI)?" "y"

echo ""
echo -e "${BOLD}━━━ Admin Account ━━━${NC}"
echo ""
echo -e "${CYAN}Create the first admin account for your site:${NC}"
echo ""

prompt ADMIN_EMAIL "Admin email" ""
while [ -z "$ADMIN_EMAIL" ]; do
    echo -e "${RED}Admin email is required${NC}"
    prompt ADMIN_EMAIL "Admin email" ""
done

prompt ADMIN_PASSWORD "Admin password (min 6 chars)" "" true
while [ ${#ADMIN_PASSWORD} -lt 6 ]; do
    echo -e "${RED}Password must be at least 6 characters${NC}"
    prompt ADMIN_PASSWORD "Admin password (min 6 chars)" "" true
done

# ==========================================
# GENERATE SECRETS
# ==========================================

echo ""
echo -e "${BOLD}━━━ Generating Secrets ━━━${NC}"
echo ""

echo -e "${CYAN}Preparing secure credentials...${NC}"

if [ "$REUSE_EXISTING_SECRETS" = true ] && [ -f .env ]; then
    # shellcheck disable=SC1091
    source .env
    # Strip any surrounding quotes from keys (common .env issue)
    JWT_SECRET=$(echo "$JWT_SECRET" | tr -d '"')
    ANON_KEY=$(echo "$ANON_KEY" | tr -d '"')
    SERVICE_ROLE_KEY=$(echo "$SERVICE_ROLE_KEY" | tr -d '"')
    POSTGRES_PASSWORD=$(echo "$POSTGRES_PASSWORD" | tr -d '"')
    SECRET_KEY_BASE=$(echo "$SECRET_KEY_BASE" | tr -d '"')
    
    # These MUST exist if we're reusing. If any are missing, regenerate safely.
    if [ -z "${POSTGRES_PASSWORD:-}" ] || [ -z "${JWT_SECRET:-}" ] || [ -z "${ANON_KEY:-}" ] || [ -z "${SERVICE_ROLE_KEY:-}" ] || [ -z "${SECRET_KEY_BASE:-}" ]; then
        echo -e "${YELLOW}Existing .env is missing one or more required secrets; regenerating all secrets.${NC}"
        REUSE_EXISTING_SECRETS=false
    else
        # Validate that ANON_KEY and SERVICE_ROLE_KEY are signed with current JWT_SECRET
        # by regenerating them and comparing. If they don't match, regenerate.
        EXPECTED_ANON=$(generate_jwt "anon" "$JWT_SECRET")
        # JWTs have timestamps, so compare only header+payload structure
        ANON_PARTS=$(echo "$ANON_KEY" | cut -d. -f1-2)
        EXPECTED_PARTS=$(echo "$EXPECTED_ANON" | cut -d. -f1-2)
        
        if [ "$ANON_PARTS" != "$EXPECTED_PARTS" ]; then
            echo -e "${YELLOW}API keys don't match JWT_SECRET. Regenerating keys...${NC}"
            ANON_KEY=$(generate_jwt "anon" "$JWT_SECRET")
            SERVICE_ROLE_KEY=$(generate_jwt "service_role" "$JWT_SECRET")
            echo -e "${GREEN}✓${NC} API keys regenerated from existing JWT_SECRET"
        else
            echo -e "${GREEN}✓${NC} Reusing existing secrets from .env"
        fi
    fi
fi

if [ "$REUSE_EXISTING_SECRETS" != true ]; then
    POSTGRES_PASSWORD=$(generate_secret 32)
    JWT_SECRET=$(generate_secret 64)
    SECRET_KEY_BASE=$(generate_secret 64)

    # Generate proper JWT tokens for API access
    ANON_KEY=$(generate_jwt "anon" "$JWT_SECRET")
    SERVICE_ROLE_KEY=$(generate_jwt "service_role" "$JWT_SECRET")

    echo -e "${GREEN}✓${NC} Postgres password generated"
    echo -e "${GREEN}✓${NC} JWT secret generated"
    echo -e "${GREEN}✓${NC} API keys generated"
fi

# ==========================================
# CREATE .ENV FILE
# ==========================================

echo ""
echo -e "${BOLD}━━━ Creating Configuration ━━━${NC}"
echo ""

# Escape values for safe use in .env
ESC_SITE_NAME=$(escape_env_value "$SITE_NAME")
ESC_SITE_DESCRIPTION=$(escape_env_value "$SITE_DESCRIPTION")
ESC_SITE_AUTHOR=$(escape_env_value "$SITE_AUTHOR")
ESC_SMTP_PASS=$(escape_env_value "$SMTP_PASS")

# Write .env file with proper quoting
{
    echo "# ============================================"
    echo "# Game Haven - Generated Configuration"
    echo "# Generated: $(date)"
    echo "# ============================================"
    echo ""
    echo "# ==================="
    echo "# Site Settings"
    echo "# ==================="
    echo "SITE_NAME=\"${ESC_SITE_NAME}\""
    echo "SITE_DESCRIPTION=\"${ESC_SITE_DESCRIPTION}\""
    echo "SITE_AUTHOR=\"${ESC_SITE_AUTHOR}\""
    echo "SITE_URL=\"${SITE_URL}\""
    echo "API_EXTERNAL_URL=\"${API_URL}\""
    echo ""
    echo "# ==================="
    echo "# Ports"
    echo "# ==================="
    echo "APP_PORT=${APP_PORT}"
    echo "STUDIO_PORT=${STUDIO_PORT}"
    echo "POSTGRES_PORT=${POSTGRES_PORT}"
    echo "GATEWAY_PORT=${GATEWAY_PORT}"
    echo ""
    echo "# ==================="
    echo "# Features"
    echo "# ==================="
    echo "FEATURE_PLAY_LOGS=${FEATURE_PLAY_LOGS}"
    echo "FEATURE_WISHLIST=${FEATURE_WISHLIST}"
    echo "FEATURE_FOR_SALE=${FEATURE_FOR_SALE}"
    echo "FEATURE_MESSAGING=${FEATURE_MESSAGING}"
    echo "FEATURE_RATINGS=${FEATURE_RATINGS}"
    echo "FEATURE_COMING_SOON=${FEATURE_COMING_SOON}"
    echo "FEATURE_DEMO_MODE=${FEATURE_DEMO_MODE}"
    echo ""
    echo "# ==================="
    echo "# Database"
    echo "# ==================="
    echo "POSTGRES_PASSWORD=${POSTGRES_PASSWORD}"
    echo ""
    echo "# ==================="
    echo "# Authentication"
    echo "# ==================="
    echo "JWT_SECRET=${JWT_SECRET}"
    echo "ANON_KEY=${ANON_KEY}"
    echo "SERVICE_ROLE_KEY=${SERVICE_ROLE_KEY}"
    echo "SECRET_KEY_BASE=${SECRET_KEY_BASE}"
    echo "MAILER_AUTOCONFIRM=${MAILER_AUTOCONFIRM}"
    echo "DISABLE_SIGNUP=false"
    echo ""
    echo "# ==================="
    echo "# Email (SMTP)"
    echo "# ==================="
    echo "SMTP_HOST=\"${SMTP_HOST}\""
    echo "SMTP_PORT=\"${SMTP_PORT}\""
    echo "SMTP_USER=\"${SMTP_USER}\""
    echo "SMTP_PASS=\"${ESC_SMTP_PASS}\""
    echo "SMTP_ADMIN_EMAIL=\"${SMTP_FROM}\""
    echo ""
    echo "# ==================="
    echo "# AI (BYOK - Bring Your Own Key)"
    echo "# ==================="
    echo "PERPLEXITY_API_KEY=\"${PERPLEXITY_API_KEY}\""
    echo "OPENAI_API_KEY=\"${OPENAI_API_KEY}\""
    echo "ANTHROPIC_API_KEY=\"${ANTHROPIC_API_KEY}\""
    echo "GOOGLE_AI_API_KEY=\"${GOOGLE_AI_API_KEY}\""
    echo ""
    echo "# ==================="
    echo "# Additional"
    echo "# ==================="
    echo "ADDITIONAL_REDIRECT_URLS="
} > .env

echo -e "${GREEN}✓${NC} Created .env file"

###############################################################################
# docker-compose.override.yml
#
# Optional overrides for Studio and other services.
###############################################################################

cat > docker-compose.override.yml << EOF
# Generated by install.sh - DO NOT EDIT
services: {}
EOF

# If Studio is enabled, enable the Studio services.
if [ "$ENABLE_STUDIO" = true ]; then
    cat > docker-compose.override.yml << EOF
# Generated by install.sh - DO NOT EDIT
services:
  studio:
    profiles: []
  meta:
    profiles: []
EOF
    echo -e "${GREEN}✓${NC} Enabled Supabase Studio"
fi

echo -e "${GREEN}✓${NC} Wrote docker-compose.override.yml"

# Save credentials to a secure file
{
    echo "# KEEP THIS FILE SECURE - Contains sensitive credentials"
    echo "# Generated: $(date)"
    echo ""
    echo "Database Password: $POSTGRES_PASSWORD"
    echo "JWT Secret: $JWT_SECRET"
    echo "Anon Key: $ANON_KEY"
    echo "Service Role Key: $SERVICE_ROLE_KEY"
    echo ""
    echo "Admin Email: $ADMIN_EMAIL"
    echo "Admin Password: $ADMIN_PASSWORD"
} > .credentials
chmod 600 .credentials

echo -e "${GREEN}✓${NC} Saved credentials to .credentials"

# Note: Kong has been replaced by Nginx gateway (gateway.conf).
# No additional configuration generation needed - the gateway.conf
# is static and mounted directly into the container.

# ==========================================
# COPY EDGE FUNCTIONS
# ==========================================
# The edge-runtime container mounts ./functions. Copy from repo.

echo ""
echo -e "${CYAN}Copying edge functions...${NC}"

# Create functions directory if it doesn't exist
mkdir -p ./functions

# Copy all edge functions from repo
if [ -d "../../supabase/functions" ]; then
    cp -r ../../supabase/functions/* ./functions/
    echo -e "${GREEN}✓${NC} Copied edge functions to ./functions/"
else
    echo -e "${YELLOW}Warning: supabase/functions not found. Edge functions may not work.${NC}"
fi

# ==========================================
# START DATABASE FIRST (Two-Stage Startup)
# ==========================================
# We must start the DB alone, configure passwords, then start other services.
# This prevents the "dependency is unhealthy" race condition.

echo ""
echo -e "${BOLD}━━━ Starting Database ━━━${NC}"
echo ""

echo -e "${CYAN}Starting PostgreSQL...${NC}"
docker compose up -d db

# ==========================================
# WAIT FOR DATABASE
# ==========================================

echo ""
echo -e "${CYAN}Waiting for database to be ready...${NC}"

for i in {1..90}; do
    if docker exec gamehaven-db pg_isready -U supabase_admin -d postgres >/dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} Database is ready (pg_isready)"
        break
    fi
    
    if [ $i -eq 90 ]; then
        echo -e "${RED}Error: Database failed to start${NC}"
        echo -e "Run: ${YELLOW}docker logs gamehaven-db${NC}"
        exit 1
    fi
    
    echo "  Waiting for database... ($i/90)"
    sleep 2
done

# pg_isready passes before the Unix socket is fully available.
# Wait until we can actually run a query using TCP (not Unix socket).
echo -e "${CYAN}Waiting for database to accept connections...${NC}"
for j in {1..30}; do
    # Use -h localhost to force TCP connection instead of Unix socket
    if docker exec gamehaven-db psql -h localhost -U supabase_admin -d postgres -c "SELECT 1;" >/dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} Database accepting connections"
        break
    fi
    
    if [ $j -eq 30 ]; then
        echo -e "${RED}Error: Database not accepting connections${NC}"
        echo -e "Run: ${YELLOW}docker logs gamehaven-db${NC}"
        exit 1
    fi
    
    echo "  Waiting for connections... ($j/30)"
    sleep 2
done

# ==========================================
# SETUP DATABASE PASSWORDS
# ==========================================

echo ""
echo -e "${CYAN}Configuring database roles and passwords...${NC}"

# Escape single quotes in password for SQL
ESCAPED_PW=$(printf '%s' "$POSTGRES_PASSWORD" | sed "s/'/''/g")

# Set passwords for internal Supabase roles BEFORE starting auth/rest
# Also create auth and storage schemas that GoTrue and Storage expect
# Write SQL to a temp file to avoid heredoc/escaping issues with docker exec
cat > /tmp/init-roles.sql << 'EOSQL'
-- =====================================================
-- Game Haven Standalone: Database Role Initialization
-- =====================================================

-- Step 1: Create all required roles if they don't exist
DO $$
BEGIN
  RAISE NOTICE 'Step 1: Creating roles...';
  
  -- GoTrue migrations expect a role literally named 'postgres' to exist.
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'postgres') THEN
    CREATE ROLE postgres WITH LOGIN SUPERUSER CREATEDB CREATEROLE;
    RAISE NOTICE 'Created role: postgres';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
    CREATE ROLE supabase_auth_admin WITH LOGIN SUPERUSER CREATEDB CREATEROLE;
    RAISE NOTICE 'Created role: supabase_auth_admin';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticator') THEN
    CREATE ROLE authenticator WITH LOGIN NOINHERIT;
    RAISE NOTICE 'Created role: authenticator';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_storage_admin') THEN
    CREATE ROLE supabase_storage_admin WITH LOGIN CREATEDB CREATEROLE;
    RAISE NOTICE 'Created role: supabase_storage_admin';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
    RAISE NOTICE 'Created role: anon';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
    RAISE NOTICE 'Created role: authenticated';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
    RAISE NOTICE 'Created role: service_role';
  END IF;
  
  RAISE NOTICE 'Step 1 complete.';
END
$$;

-- Step 2: Set passwords (placeholder replaced by sed)
-- PLACEHOLDER_PASSWORD_COMMANDS

-- Step 3: Ensure role attributes are correct
DO $$
BEGIN
  RAISE NOTICE 'Step 3: Configuring role attributes...';
  ALTER ROLE supabase_auth_admin WITH SUPERUSER CREATEDB CREATEROLE;
  ALTER ROLE supabase_storage_admin WITH CREATEDB CREATEROLE;
  RAISE NOTICE 'Step 3 complete.';
END
$$;

-- Step 4: Create schemas
DO $$
BEGIN
  RAISE NOTICE 'Step 4: Creating schemas...';
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'auth') THEN
    CREATE SCHEMA auth AUTHORIZATION supabase_auth_admin;
    RAISE NOTICE 'Created schema: auth';
  ELSE
    ALTER SCHEMA auth OWNER TO supabase_auth_admin;
    RAISE NOTICE 'Schema auth already exists, set owner to supabase_auth_admin';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'storage') THEN
    CREATE SCHEMA storage AUTHORIZATION supabase_storage_admin;
    RAISE NOTICE 'Created schema: storage';
  ELSE
    ALTER SCHEMA storage OWNER TO supabase_storage_admin;
    RAISE NOTICE 'Schema storage already exists, set owner to supabase_storage_admin';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'extensions') THEN
    CREATE SCHEMA extensions;
    RAISE NOTICE 'Created schema: extensions';
  END IF;
  
  RAISE NOTICE 'Step 4 complete.';
END
$$;

-- Step 5: Grant schema permissions
DO $$
BEGIN
  RAISE NOTICE 'Step 5: Granting schema permissions...';
  GRANT ALL ON SCHEMA auth TO supabase_auth_admin;
  GRANT ALL ON SCHEMA storage TO supabase_storage_admin;
  GRANT ALL ON SCHEMA public TO supabase_auth_admin;
  GRANT ALL ON SCHEMA public TO supabase_storage_admin;
  GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
  RAISE NOTICE 'Step 5 complete.';
END
$$;

-- Step 6: Grant role memberships (with error handling for duplicates)
DO $$
BEGIN
  RAISE NOTICE 'Step 6: Granting role memberships...';
  
  BEGIN EXECUTE 'GRANT anon TO supabase_auth_admin'; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN EXECUTE 'GRANT authenticated TO supabase_auth_admin'; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN EXECUTE 'GRANT service_role TO supabase_auth_admin'; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN EXECUTE 'GRANT anon TO authenticator'; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN EXECUTE 'GRANT authenticated TO authenticator'; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN EXECUTE 'GRANT service_role TO authenticator'; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN EXECUTE 'GRANT anon TO supabase_admin'; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN EXECUTE 'GRANT authenticated TO supabase_admin'; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN EXECUTE 'GRANT service_role TO supabase_admin'; EXCEPTION WHEN duplicate_object THEN NULL; END;
  
  RAISE NOTICE 'Step 6 complete.';
END
$$;

-- Step 7: Set search_path for GoTrue
DO $$
BEGIN
  RAISE NOTICE 'Step 7: Setting search_path for supabase_auth_admin...';
  ALTER ROLE supabase_auth_admin SET search_path TO auth, public, extensions;
  RAISE NOTICE 'Step 7 complete.';
END
$$;

DO $$ BEGIN RAISE NOTICE 'All role initialization steps completed successfully.'; END $$;
EOSQL

# Replace placeholder with actual password commands (avoids escaping issues in heredoc)
sed -i "s|-- PLACEHOLDER_PASSWORD_COMMANDS|ALTER ROLE postgres WITH PASSWORD '${ESCAPED_PW}';\nALTER ROLE supabase_auth_admin WITH PASSWORD '${ESCAPED_PW}';\nALTER ROLE authenticator WITH PASSWORD '${ESCAPED_PW}';\nALTER ROLE supabase_storage_admin WITH PASSWORD '${ESCAPED_PW}';|" /tmp/init-roles.sql

# Copy SQL file into container and execute
docker cp /tmp/init-roles.sql gamehaven-db:/tmp/init-roles.sql

# Run SQL and capture output/errors.
# IMPORTANT: this script uses `set -e` globally; command substitution will cause
# an immediate exit on non-zero status before we can inspect `$?`.
echo -e "${CYAN}Running role init SQL...${NC}"
set +e
# Use -h localhost to force TCP connection instead of Unix socket
SQL_OUTPUT=$(docker exec gamehaven-db psql -h localhost -v ON_ERROR_STOP=1 -U supabase_admin -d postgres -f /tmp/init-roles.sql 2>&1)
SQL_EXIT_CODE=$?
set -e

if [ $SQL_EXIT_CODE -ne 0 ]; then
    echo -e "${RED}Error: Failed to configure database roles${NC}"
    echo -e "${YELLOW}SQL Output:${NC}"
    echo "$SQL_OUTPUT"
    echo ""
    echo -e "Check database logs: ${YELLOW}docker logs gamehaven-db${NC}"
    rm -f /tmp/init-roles.sql
    exit 1
fi

echo "$SQL_OUTPUT"

rm -f /tmp/init-roles.sql

echo -e "${GREEN}✓${NC} Database roles and passwords configured"

# ==========================================
# START REMAINING SERVICES
# ==========================================

echo ""
echo -e "${BOLD}━━━ Starting Application Services ━━━${NC}"
echo ""

echo -e "${CYAN}Starting auth, rest, realtime, kong, app...${NC}"
docker compose up -d

# ==========================================
# WAIT FOR AUTH SERVICE
# ==========================================

echo ""
echo -e "${CYAN}Waiting for auth service to be ready...${NC}"

AUTH_HEALTH_URL="http://localhost:${GATEWAY_PORT}/auth/v1/health"

for i in {1..60}; do
    if curl -fsS --max-time 2 "$AUTH_HEALTH_URL" >/dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} Auth service is ready"
        break
    fi
    
    if [ $i -eq 60 ]; then
        echo -e "${RED}Error: Auth service failed to start${NC}"
        echo -e "\n${YELLOW}Auth container status:${NC}"
        docker compose ps auth || true
        echo -e "\n${YELLOW}Last 50 lines of auth logs:${NC}"
        docker logs gamehaven-auth --tail=50 || true
        echo -e "\n${YELLOW}Tip: Run ./scripts/fix-db-passwords.sh if password mismatch is suspected${NC}"
        exit 1
    fi
    
    echo "  Waiting for auth... ($i/60)"
    sleep 2
done

# ==========================================
# VERIFY AUTH DB MIGRATIONS COMPLETED
# ==========================================

echo ""
echo -e "${CYAN}Verifying auth database tables...${NC}"

# Auth health can be up before DB migrations are fully complete.
# The admin user creation endpoint requires auth.users to exist.
for i in {1..60}; do
    # Use -h localhost to force TCP connection instead of Unix socket
    if docker exec -i gamehaven-db psql -h localhost -v ON_ERROR_STOP=1 -U supabase_admin -d postgres -tAc "SELECT 1 FROM auth.users LIMIT 1;" >/dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} Auth tables are ready"
        break
    fi

    if [ $i -eq 60 ]; then
        echo -e "${RED}Error: Auth tables not ready (auth.users missing or inaccessible)${NC}"
        echo -e "\n${YELLOW}Last 120 lines of auth logs:${NC}"
        docker logs gamehaven-auth --tail=120 || true
        echo -e "\n${YELLOW}Last 80 lines of db logs:${NC}"
        docker logs gamehaven-db --tail=80 || true
        echo -e "\n${YELLOW}Tip: If this is a permissions issue, run:${NC} ${YELLOW}./scripts/fix-auth-permissions.sh${NC}"
        exit 1
    fi

    echo "  Waiting for auth DB migrations... ($i/60)"
    sleep 2
done

# ==========================================
# FIX FOR STUDIO/GOTRUE VERSION MISMATCH
# ==========================================
# Newer Supabase Studio expects auth.users.is_anonymous, but GoTrue v2.132.3
# does not create this column. Add it now if missing.

echo ""
echo -e "${CYAN}Checking auth schema compatibility...${NC}"

NEED_IS_ANONYMOUS=$(docker exec -i gamehaven-db psql -h localhost -U supabase_admin -d postgres -tAc "
  SELECT CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'is_anonymous'
  ) THEN 'no' ELSE 'yes' END;
" 2>/dev/null | tr -d '[:space:]')

if [ "$NEED_IS_ANONYMOUS" = "yes" ]; then
    echo -e "  Adding missing ${YELLOW}is_anonymous${NC} column to auth.users..."
    docker exec -i gamehaven-db psql -h localhost -U supabase_admin -d postgres -c \
      "ALTER TABLE auth.users ADD COLUMN is_anonymous boolean NOT NULL DEFAULT false;" 2>/dev/null || true
    echo -e "${GREEN}✓${NC} Added is_anonymous column"
else
    echo -e "${GREEN}✓${NC} Auth schema is compatible"
fi

# ==========================================
# RUN APPLICATION MIGRATIONS
# ==========================================

echo ""
echo -e "${BOLD}━━━ Running Database Migrations ━━━${NC}"
echo ""

# The 00-init-users.sql runs automatically via docker-entrypoint-initdb.d on first init.
# Apply the app schema AFTER auth is up so the auth schema + JWT roles are present.

echo -e "${CYAN}Applying application schema...${NC}"

# Run the application schema migration manually to ensure it's applied
# (handles both fresh installs and existing volumes)
docker exec -i gamehaven-db psql -h localhost -v ON_ERROR_STOP=1 -U supabase_admin -d postgres < ./migrations/01-app-schema.sql

echo -e "${GREEN}✓${NC} Application schema ready"

# ==========================================
# CREATE ADMIN USER (skip if exists)
# ==========================================

echo ""
echo -e "${BOLD}━━━ Creating Admin User ━━━${NC}"
echo ""

# Check if admin user already exists
EXISTING_USER=$(docker exec -i gamehaven-db psql -h localhost -U supabase_admin -d postgres -tAc \
    "SELECT id FROM auth.users WHERE email = '${ADMIN_EMAIL}' LIMIT 1;" 2>/dev/null || echo "")

if [ -n "$EXISTING_USER" ]; then
    echo -e "${GREEN}✓${NC} Admin user already exists (${ADMIN_EMAIL}), skipping creation"
    USER_ID="$EXISTING_USER"
else
    echo -e "${CYAN}Creating admin account...${NC}"

    # Create user via GoTrue API (retry once after fixing auth permissions)
    create_admin_user() {
      curl -s -X POST "http://localhost:${GATEWAY_PORT}/auth/v1/admin/users" \
          -H "Content-Type: application/json" \
          -H "apikey: ${SERVICE_ROLE_KEY}" \
          -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
          -d "{
              \"email\": \"${ADMIN_EMAIL}\",
              \"password\": \"${ADMIN_PASSWORD}\",
              \"email_confirm\": true
          }"
    }

    RESPONSE=$(create_admin_user)

    # Extract user ID
    USER_ID=$(echo $RESPONSE | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

    if [ -z "$USER_ID" ]; then
        # Check if user already exists (created via another method)
        if echo "$RESPONSE" | grep -qi "already been registered\|duplicate\|already exists"; then
            echo -e "${GREEN}✓${NC} Admin user already exists"
            USER_ID=$(docker exec -i gamehaven-db psql -h localhost -U supabase_admin -d postgres -tAc \
                "SELECT id FROM auth.users WHERE email = '${ADMIN_EMAIL}' LIMIT 1;" 2>/dev/null || echo "")
        # If GoTrue is up but can't query the DB yet, try the permissions fix once.
        elif echo "$RESPONSE" | grep -q '"msg":"Database error checking email"'; then
            echo -e "${YELLOW}Auth returned 'Database error checking email'. Attempting permission repair + retry...${NC}"
            if [ -f ./scripts/fix-auth-permissions.sh ]; then
                chmod +x ./scripts/fix-auth-permissions.sh 2>/dev/null || true
                ./scripts/fix-auth-permissions.sh || true
            fi
            RESPONSE=$(create_admin_user)
            USER_ID=$(echo $RESPONSE | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
        fi

        if [ -n "$USER_ID" ]; then
            echo -e "${GREEN}✓${NC} User created: $USER_ID"
        else
            echo -e "${RED}Error creating admin user. Response:${NC}"
            echo "$RESPONSE"

            echo ""
            echo -e "${YELLOW}Auth logs (last 200 lines):${NC}"
            docker logs gamehaven-auth --tail=200 || true

            echo ""
            echo -e "${YELLOW}DB logs (last 120 lines):${NC}"
            docker logs gamehaven-db --tail=120 || true

            echo ""
            echo -e "${YELLOW}You can try manually later with:${NC}"
            echo -e "  ${YELLOW}./scripts/create-admin.sh${NC}"
            exit 1
        fi
    else
        echo -e "${GREEN}✓${NC} User created: $USER_ID"
    fi
fi

if [ -z "$USER_ID" ]; then
    echo -e "${RED}Error: Admin user creation failed unexpectedly${NC}"
    exit 1
fi

# Assign admin role
echo -e "${CYAN}Assigning admin role...${NC}"

# Use a superuser role to avoid RLS/privilege issues and verify the insert.
docker exec -i gamehaven-db psql -v ON_ERROR_STOP=1 -U postgres -d postgres << EOF
INSERT INTO public.user_roles (user_id, role)
VALUES ('${USER_ID}', 'admin'::public.app_role)
ON CONFLICT (user_id, role) DO NOTHING;

\echo 'Verifying admin role...'
SELECT role FROM public.user_roles WHERE user_id = '${USER_ID}' AND role = 'admin'::public.app_role;
EOF

echo -e "${GREEN}✓${NC} Admin role assigned (verified)"

# ==========================================
# NGINX REVERSE PROXY SETUP (OPTIONAL)
# ==========================================

if [ "$DOMAIN" != "localhost" ]; then
    echo ""
    prompt_yn SETUP_NGINX "Setup Nginx reverse proxy with SSL for $DOMAIN?" "y"
    
    if [ "$SETUP_NGINX" = true ]; then
        chmod +x ./scripts/setup-nginx.sh
        ./scripts/setup-nginx.sh
    fi
fi

# ==========================================
# COMPLETE
# ==========================================

echo ""
echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║${NC}             ${BOLD}${GREEN}Installation Complete!${NC}                        ${CYAN}║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BOLD}Your Game Haven is ready!${NC}"
echo ""
echo -e "  ${BOLD}App URL:${NC}     ${GREEN}$SITE_URL${NC}"
if [ "$ENABLE_STUDIO" = true ]; then
echo -e "  ${BOLD}Studio URL:${NC}  ${GREEN}http://localhost:$STUDIO_PORT${NC}"
fi
echo ""
echo -e "  ${BOLD}Admin Login:${NC}"
echo -e "    Email:     ${GREEN}$ADMIN_EMAIL${NC}"
echo -e "    Password:  ${GREEN}(saved in .credentials)${NC}"
echo ""
echo -e "${BOLD}Useful Commands:${NC}"
echo -e "  View logs:      ${YELLOW}docker compose logs -f${NC}"
echo -e "  Stop services:  ${YELLOW}docker compose down${NC}"
echo -e "  Restart:        ${YELLOW}docker compose restart${NC}"
echo -e "  Backup DB:      ${YELLOW}./scripts/backup.sh${NC}"
if [ "$DOMAIN" != "localhost" ] && [ "$SETUP_NGINX" != true ]; then
echo -e "  Setup nginx:    ${YELLOW}./scripts/setup-nginx.sh${NC}"
fi
echo ""
echo -e "${YELLOW}⚠ Credentials saved to .credentials - keep this file secure!${NC}"
echo ""
