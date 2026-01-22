#!/bin/bash
#
# Game Haven - One-Click Installer
# Sets up config, starts the stack, runs migrations, and creates admin user
#

set -e

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
DEFAULT_KONG_PORT="8000"

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
echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║${NC}          ${BOLD}Game Haven - Self-Hosted Installation${NC}            ${CYAN}║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
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
    DEFAULT_KONG_PORT="${KONG_HTTP_PORT:-$DEFAULT_KONG_PORT}"
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
prompt KONG_PORT "API Gateway port" "$DEFAULT_KONG_PORT"

# Build URLs
if [ "$DOMAIN" = "localhost" ]; then
    SITE_URL="http://localhost:$APP_PORT"
    API_URL="http://localhost:$KONG_PORT"
else
    prompt_yn USE_HTTPS "Use HTTPS?" "y"
    if [ "$USE_HTTPS" = true ]; then
        SITE_URL="https://$DOMAIN"
        API_URL="https://api.$DOMAIN"
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
    # These MUST exist if we're reusing. If any are missing, regenerate safely.
    if [ -z "${POSTGRES_PASSWORD:-}" ] || [ -z "${JWT_SECRET:-}" ] || [ -z "${ANON_KEY:-}" ] || [ -z "${SERVICE_ROLE_KEY:-}" ] || [ -z "${SECRET_KEY_BASE:-}" ]; then
        echo -e "${YELLOW}Existing .env is missing one or more required secrets; regenerating all secrets.${NC}"
        REUSE_EXISTING_SECRETS=false
    else
        echo -e "${GREEN}✓${NC} Reusing existing secrets from .env"
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
    echo "KONG_HTTP_PORT=${KONG_PORT}"
    echo ""
    echo "# ==================="
    echo "# Features"
    echo "# ==================="
    echo "FEATURE_PLAY_LOGS=${FEATURE_PLAY_LOGS}"
    echo "FEATURE_WISHLIST=${FEATURE_WISHLIST}"
    echo "FEATURE_FOR_SALE=${FEATURE_FOR_SALE}"
    echo "FEATURE_MESSAGING=${FEATURE_MESSAGING}"
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
    echo "# Additional"
    echo "# ==================="
    echo "ADDITIONAL_REDIRECT_URLS="
} > .env

echo -e "${GREEN}✓${NC} Created .env file"

# Create docker-compose override for studio if enabled
if [ "$ENABLE_STUDIO" = true ]; then
    cat > docker-compose.override.yml << EOF
# Enable Supabase Studio
services:
  studio:
    profiles: []
  meta:
    profiles: []
EOF
    echo -e "${GREEN}✓${NC} Enabled Supabase Studio"
fi

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

# ==========================================
# GENERATE KONG CONFIG
# ==========================================
# Kong declarative config does NOT support environment variable substitution.
# We must generate kong.yml with actual API keys baked in.

echo -e "${CYAN}Generating API gateway configuration...${NC}"

cat > kong.yml << KONGEOF
# Kong API Gateway Configuration for Game Haven
# Generated by install.sh - DO NOT EDIT MANUALLY
# Routes requests to Supabase services

_format_version: "3.0"
_transform: true

consumers:
  - username: anon
    keyauth_credentials:
      - key: ${ANON_KEY}
  - username: service_role
    keyauth_credentials:
      - key: ${SERVICE_ROLE_KEY}

acls:
  - consumer: anon
    group: anon
  - consumer: service_role
    group: admin

services:
  # Auth Service - Health endpoint MUST be open for readiness checks
  - name: auth-v1-open-health
    url: http://auth:9999/health
    routes:
      - name: auth-v1-open-health
        strip_path: true
        paths:
          - /auth/v1/health
    plugins:
      - name: cors

  - name: auth-v1-open
    url: http://auth:9999/verify
    routes:
      - name: auth-v1-open
        strip_path: true
        paths:
          - /auth/v1/verify
    plugins:
      - name: cors

  - name: auth-v1-open-callback
    url: http://auth:9999/callback
    routes:
      - name: auth-v1-open-callback
        strip_path: true
        paths:
          - /auth/v1/callback
    plugins:
      - name: cors

  - name: auth-v1-open-authorize
    url: http://auth:9999/authorize
    routes:
      - name: auth-v1-open-authorize
        strip_path: true
        paths:
          - /auth/v1/authorize
    plugins:
      - name: cors

  # Main auth endpoint (requires API key)
  - name: auth-v1
    url: http://auth:9999
    routes:
      - name: auth-v1
        strip_path: true
        paths:
          - /auth/v1/
    plugins:
      - name: cors
      - name: key-auth
        config:
          hide_credentials: true
          key_names:
            - apikey

  # REST API (PostgREST)
  - name: rest-v1
    url: http://rest:3000
    routes:
      - name: rest-v1
        strip_path: true
        paths:
          - /rest/v1/
    plugins:
      - name: cors
      - name: key-auth
        config:
          hide_credentials: true
          key_names:
            - apikey

  # Realtime
  - name: realtime-v1
    url: http://realtime:4000/socket
    routes:
      - name: realtime-v1
        strip_path: true
        paths:
          - /realtime/v1/
    plugins:
      - name: cors
      - name: key-auth
        config:
          hide_credentials: true
          key_names:
            - apikey

plugins:
  - name: cors
    config:
      origins:
        - "*"
      methods:
        - GET
        - POST
        - PUT
        - PATCH
        - DELETE
        - OPTIONS
      headers:
        - Accept
        - Accept-Version
        - Authorization
        - Content-Length
        - Content-Type
        - Date
        - X-Auth-Token
        - apikey
        - Prefer
      exposed_headers:
        - Content-Range
      credentials: true
      max_age: 3600
KONGEOF

echo -e "${GREEN}✓${NC} Generated kong.yml with API keys"

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
        echo -e "${GREEN}✓${NC} Database is ready"
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

# Give postgres a moment to finish init scripts
sleep 3

# ==========================================
# SETUP DATABASE PASSWORDS
# ==========================================

echo ""
echo -e "${CYAN}Configuring database roles and passwords...${NC}"

# Escape single quotes in password for SQL
ESCAPED_PW=$(printf '%s' "$POSTGRES_PASSWORD" | sed "s/'/''/g")

# Set passwords for internal Supabase roles BEFORE starting auth/rest
docker exec -i gamehaven-db psql -U supabase_admin -d postgres << EOSQL
-- Ensure internal roles exist (in case 00-init-users.sql didn't create them)
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
    CREATE ROLE supabase_auth_admin WITH LOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticator') THEN
    CREATE ROLE authenticator WITH LOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_storage_admin') THEN
    CREATE ROLE supabase_storage_admin WITH LOGIN;
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
END
\$\$;

-- Set passwords for internal roles (must match .env POSTGRES_PASSWORD)
ALTER ROLE supabase_auth_admin WITH PASSWORD '${ESCAPED_PW}';
ALTER ROLE authenticator WITH PASSWORD '${ESCAPED_PW}';
ALTER ROLE supabase_storage_admin WITH PASSWORD '${ESCAPED_PW}';

-- Ensure supabase_auth_admin has SUPERUSER for migrations
ALTER ROLE supabase_auth_admin WITH SUPERUSER CREATEDB CREATEROLE;
ALTER ROLE supabase_storage_admin WITH CREATEDB CREATEROLE;

-- Ensure schema permissions
GRANT ALL ON SCHEMA public TO supabase_auth_admin;
GRANT ALL ON SCHEMA public TO supabase_storage_admin;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- Ensure role grants for PostgREST
GRANT anon TO authenticator;
GRANT authenticated TO authenticator;
GRANT service_role TO authenticator;
GRANT anon TO supabase_admin;
GRANT authenticated TO supabase_admin;
GRANT service_role TO supabase_admin;
EOSQL

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

AUTH_HEALTH_URL="http://localhost:${KONG_PORT}/auth/v1/health"

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
docker exec -i gamehaven-db psql -v ON_ERROR_STOP=1 -U supabase_admin -d postgres < ./migrations/01-app-schema.sql

echo -e "${GREEN}✓${NC} Application schema ready"

# ==========================================
# CREATE ADMIN USER
# ==========================================

echo ""
echo -e "${BOLD}━━━ Creating Admin User ━━━${NC}"
echo ""

echo -e "${CYAN}Creating admin account...${NC}"

# Create user via GoTrue API
RESPONSE=$(curl -s -X POST "http://localhost:${KONG_PORT}/auth/v1/admin/users" \
    -H "Content-Type: application/json" \
    -H "apikey: ${SERVICE_ROLE_KEY}" \
    -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
    -d "{
        \"email\": \"${ADMIN_EMAIL}\",
        \"password\": \"${ADMIN_PASSWORD}\",
        \"email_confirm\": true
    }")

# Extract user ID
USER_ID=$(echo $RESPONSE | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$USER_ID" ]; then
    echo -e "${RED}Error creating admin user. Response:${NC}"
    echo "$RESPONSE"
    echo ""
    echo -e "${YELLOW}You can try manually later with:${NC}"
    echo -e "  ${YELLOW}./scripts/create-admin.sh${NC}"
    exit 1
fi

echo -e "${GREEN}✓${NC} User created: $USER_ID"

# Assign admin role
echo -e "${CYAN}Assigning admin role...${NC}"

docker exec -i gamehaven-db psql -U supabase_admin -d postgres << EOF
INSERT INTO public.user_roles (user_id, role)
VALUES ('${USER_ID}', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;
EOF

echo -e "${GREEN}✓${NC} Admin role assigned"

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
