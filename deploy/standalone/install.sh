#!/bin/bash
#
# Game Haven - Interactive Installer
# Creates a customized .env file for your deployment
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

echo ""
echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║${NC}          ${BOLD}Game Haven - Self-Hosted Installation${NC}            ${CYAN}║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

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
    # - aud: must match GOTRUE_JWT_AUD (docker-compose sets 'authenticated')
    # - sub: a UUID string (commonly all zeros for service tokens)
    # - role: 'anon' or 'service_role'
    # - iss/iat/exp: standard JWT claims
    local payload=$(echo -n "{\"role\":\"$role\",\"iss\":\"supabase\",\"aud\":\"authenticated\",\"sub\":\"00000000-0000-0000-0000-000000000000\",\"iat\":$(date +%s),\"exp\":2524608000}" | openssl base64 -e | tr -d '=' | tr '/+' '_-' | tr -d '\n')
    
    # Signature
    local signature=$(echo -n "${header}.${payload}" | openssl dgst -sha256 -hmac "$secret" -binary | openssl base64 -e | tr -d '=' | tr '/+' '_-' | tr -d '\n')
    
    echo "${header}.${payload}.${signature}"
}

# Escape value for safe use in double-quoted .env strings
# Works with both docker compose (dotenv) AND bash source
escape_env_value() {
    local val="$1"
    # Escape: backslash, double-quote, dollar sign, backtick
    printf '%s' "$val" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' -e 's/\$/\\$/g' -e 's/`/\\`/g'
}

echo -e "${BOLD}━━━ Site Configuration ━━━${NC}"
echo ""

prompt SITE_NAME "Site name" "$DEFAULT_SITE_NAME"
prompt SITE_DESCRIPTION "Site description" "Browse and discover our collection of board games"
prompt SITE_AUTHOR "Site author/owner name" "$SITE_NAME"

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
echo -e "${BOLD}━━━ Generating Secrets ━━━${NC}"
echo ""

echo -e "${CYAN}Generating secure credentials...${NC}"

POSTGRES_PASSWORD=$(generate_secret 32)
JWT_SECRET=$(generate_secret 64)
SECRET_KEY_BASE=$(generate_secret 64)

# Generate proper JWT tokens for API access
ANON_KEY=$(generate_jwt "anon" "$JWT_SECRET")
SERVICE_ROLE_KEY=$(generate_jwt "service_role" "$JWT_SECRET")

echo -e "${GREEN}✓${NC} Postgres password generated"
echo -e "${GREEN}✓${NC} JWT secret generated"
echo -e "${GREEN}✓${NC} API keys generated"

# Create .env file
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
    # Generated secrets are restricted to safe characters (see generate_secret),
    # so keep them unquoted to avoid Docker Compose treating quotes as literal.
    echo "POSTGRES_PASSWORD=${POSTGRES_PASSWORD}"
    echo ""
    echo "# ==================="
    echo "# Authentication"
    echo "# ==================="
    echo "JWT_SECRET=${JWT_SECRET}"
    # NOTE: docker compose .env parsing does NOT reliably strip quotes.
    # Keep JWTs unquoted so Kong key-auth sees the exact same value that
    # scripts (which `source .env`) will send in the `apikey` header.
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
version: "3.8"
services:
  studio:
    profiles: []
  meta:
    profiles: []
EOF
    echo -e "${GREEN}✓${NC} Enabled Supabase Studio"
fi

# Summary
echo ""
echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║${NC}               ${BOLD}${GREEN}Configuration Complete!${NC}                     ${CYAN}║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BOLD}Your Settings:${NC}"
echo -e "  Site Name:     ${GREEN}$SITE_NAME${NC}"
echo -e "  App URL:       ${GREEN}$SITE_URL${NC}"
echo -e "  API URL:       ${GREEN}$API_URL${NC}"
if [ "$ENABLE_STUDIO" = true ]; then
echo -e "  Studio URL:    ${GREEN}http://localhost:$STUDIO_PORT${NC}"
fi
echo ""
echo -e "${BOLD}Features Enabled:${NC}"
[ "$FEATURE_PLAY_LOGS" = true ] && echo -e "  ${GREEN}✓${NC} Play Logs"
[ "$FEATURE_WISHLIST" = true ] && echo -e "  ${GREEN}✓${NC} Wishlist"
[ "$FEATURE_FOR_SALE" = true ] && echo -e "  ${GREEN}✓${NC} For Sale"
[ "$FEATURE_MESSAGING" = true ] && echo -e "  ${GREEN}✓${NC} Messaging"
[ "$FEATURE_COMING_SOON" = true ] && echo -e "  ${GREEN}✓${NC} Coming Soon"
[ "$FEATURE_DEMO_MODE" = true ] && echo -e "  ${GREEN}✓${NC} Demo Mode"
echo ""
echo -e "${BOLD}Next Steps:${NC}"
echo ""
echo -e "  1. Start the stack:"
echo -e "     ${YELLOW}docker compose up -d${NC}"
echo ""
echo -e "  2. Wait for services to initialize (~30 seconds)"
echo ""
echo -e "  3. Create your admin user:"
echo -e "     ${YELLOW}./scripts/create-admin.sh${NC}"
echo ""
echo -e "  4. Access your site at ${GREEN}$SITE_URL${NC}"
echo ""

# Save credentials to a secure file
cat > .credentials << EOF
# KEEP THIS FILE SECURE - Contains sensitive credentials
# Generated: $(date)

Database Password: $POSTGRES_PASSWORD
JWT Secret: $JWT_SECRET
Anon Key: $ANON_KEY
Service Role Key: $SERVICE_ROLE_KEY
EOF
chmod 600 .credentials

echo -e "${YELLOW}⚠ Credentials saved to .credentials - keep this file secure!${NC}"
echo ""
