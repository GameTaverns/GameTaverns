#!/bin/bash
#
# Game Haven v2 - Simplified Stack Installer
# Sets up Express/Node.js backend with PostgreSQL
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
DEFAULT_API_PORT="3001"
DEFAULT_POSTGRES_PORT="5432"

# ==========================================
# HELPER FUNCTIONS
# ==========================================

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

generate_secret() {
    openssl rand -base64 ${1:-32} | tr -d '/+=\n' | head -c ${1:-32}
}

escape_env_value() {
    local val="$1"
    printf '%s' "$val" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' -e 's/\$/\\$/g' -e 's/`/\\`/g'
}

# ==========================================
# BANNER
# ==========================================

echo ""
TITLE="Game Haven v2 - Simplified Stack"
INNER_WIDTH=62
BORDER=$(printf '%*s' "$INNER_WIDTH" '' | tr ' ' '═')
PAD_LEFT=$(( (INNER_WIDTH - ${#TITLE}) / 2 ))
PAD_RIGHT=$(( INNER_WIDTH - ${#TITLE} - PAD_LEFT ))

echo -e "${CYAN}╔${BORDER}╗${NC}"
echo -e "${CYAN}║${NC}$(printf '%*s' "$PAD_LEFT" '')${BOLD}${TITLE}${NC}$(printf '%*s' "$PAD_RIGHT" '')${CYAN}║${NC}"
echo -e "${CYAN}╚${BORDER}╝${NC}"
echo ""
echo -e "${GREEN}This installer sets up the simplified v2 stack:${NC}"
echo -e "  • Express/Node.js API (replaces Supabase Edge Functions)"
echo -e "  • PostgreSQL database"
echo -e "  • Nginx frontend"
echo -e "  • Only 3 containers total"
echo ""

# ==========================================
# EXISTING INSTALL DETECTION
# ==========================================

EXISTING_ENV=false
if [ -f .env ]; then
    EXISTING_ENV=true
fi

EXISTING_DB_VOLUME=false
if docker volume inspect gamehaven-db-v2 >/dev/null 2>&1; then
    EXISTING_DB_VOLUME=true
fi

REUSE_EXISTING_SECRETS=false
if [ "$EXISTING_ENV" = true ] || [ "$EXISTING_DB_VOLUME" = true ]; then
    echo -e "${YELLOW}${BOLD}Existing v2 installation detected.${NC}"
    if [ "$EXISTING_DB_VOLUME" = true ]; then
        echo -e "${YELLOW}- Found docker volume: gamehaven-db-v2${NC}"
    fi
    if [ "$EXISTING_ENV" = true ]; then
        echo -e "${YELLOW}- Found .env in this directory${NC}"
    fi
    echo ""
    prompt_yn REUSE_EXISTING_SECRETS "Reuse existing secrets and keep the current database?" "y"
    echo ""
fi

# ==========================================
# COLLECT CONFIGURATION
# ==========================================

echo -e "${BOLD}━━━ Site Configuration ━━━${NC}"
echo ""

if [ "$REUSE_EXISTING_SECRETS" = true ] && [ -f .env ]; then
    source .env
    DEFAULT_SITE_NAME="${SITE_NAME:-$DEFAULT_SITE_NAME}"
    DEFAULT_APP_PORT="${APP_PORT:-$DEFAULT_APP_PORT}"
    DEFAULT_API_PORT="${API_PORT:-$DEFAULT_API_PORT}"
    DEFAULT_POSTGRES_PORT="${POSTGRES_PORT:-$DEFAULT_POSTGRES_PORT}"
fi

prompt SITE_NAME "Site name" "$DEFAULT_SITE_NAME"
prompt SITE_DESCRIPTION "Site description" "${SITE_DESCRIPTION:-Browse and discover our collection of board games}"

echo ""
echo -e "${BOLD}━━━ Domain & Ports ━━━${NC}"
echo ""

prompt DOMAIN "Domain (or localhost for local dev)" "localhost"
prompt APP_PORT "Frontend port" "$DEFAULT_APP_PORT"
prompt API_PORT "API port" "$DEFAULT_API_PORT"
prompt POSTGRES_PORT "PostgreSQL port" "$DEFAULT_POSTGRES_PORT"

# Build URLs
if [ "$DOMAIN" = "localhost" ]; then
    SITE_URL="http://localhost:$APP_PORT"
    API_URL="http://localhost:$API_PORT"
else
    prompt_yn USE_HTTPS "Use HTTPS?" "y"
    if [ "$USE_HTTPS" = true ]; then
        SITE_URL="https://$DOMAIN"
        API_URL="https://$DOMAIN/api"
    else
        SITE_URL="http://$DOMAIN:$APP_PORT"
        API_URL="http://$DOMAIN:$API_PORT"
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
prompt_yn FEATURE_DEMO_MODE "Enable Demo Mode (uses mock data)?" "n"

echo ""
echo -e "${BOLD}━━━ Email Configuration (Optional) ━━━${NC}"
echo ""
echo -e "${CYAN}Configure SMTP for notifications. Leave blank to skip.${NC}"
echo ""

prompt SMTP_HOST "SMTP host" ""

if [ -n "$SMTP_HOST" ]; then
    prompt SMTP_PORT "SMTP port" "587"
    prompt SMTP_USER "SMTP username" ""
    prompt SMTP_PASS "SMTP password" "" true
    prompt SMTP_FROM "From email address" "noreply@$DOMAIN"
else
    SMTP_PORT=""
    SMTP_USER=""
    SMTP_PASS=""
    SMTP_FROM=""
    echo -e "${YELLOW}Skipping email configuration.${NC}"
fi

echo ""
echo -e "${BOLD}━━━ AI Configuration (Optional - BYOK) ━━━${NC}"
echo ""
echo -e "${CYAN}Add your own AI API key for description generation.${NC}"
echo ""

prompt AI_PROVIDER "AI provider (openai/gemini, or blank to skip)" ""

if [ -n "$AI_PROVIDER" ]; then
    prompt AI_API_KEY "AI API key" "" true
else
    AI_API_KEY=""
    echo -e "${YELLOW}Skipping AI configuration.${NC}"
fi

echo ""
echo -e "${BOLD}━━━ Admin Account ━━━${NC}"
echo ""
echo -e "${CYAN}Create the first admin account:${NC}"
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

if [ "$REUSE_EXISTING_SECRETS" = true ] && [ -f .env ]; then
    source .env
    if [ -z "${POSTGRES_PASSWORD:-}" ] || [ -z "${JWT_SECRET:-}" ]; then
        echo -e "${YELLOW}Missing secrets in .env; regenerating...${NC}"
        REUSE_EXISTING_SECRETS=false
    else
        echo -e "${GREEN}✓${NC} Reusing existing secrets"
    fi
fi

if [ "$REUSE_EXISTING_SECRETS" != true ]; then
    POSTGRES_PASSWORD=$(generate_secret 32)
    JWT_SECRET=$(generate_secret 64)
    echo -e "${GREEN}✓${NC} Postgres password generated"
    echo -e "${GREEN}✓${NC} JWT secret generated"
fi

# ==========================================
# CREATE .ENV FILE
# ==========================================

echo ""
echo -e "${BOLD}━━━ Creating Configuration ━━━${NC}"
echo ""

ESC_SITE_NAME=$(escape_env_value "$SITE_NAME")
ESC_SITE_DESCRIPTION=$(escape_env_value "$SITE_DESCRIPTION")
ESC_SMTP_PASS=$(escape_env_value "$SMTP_PASS")
ESC_AI_API_KEY=$(escape_env_value "$AI_API_KEY")

{
    echo "# ============================================"
    echo "# Game Haven v2 - Generated Configuration"
    echo "# Generated: $(date)"
    echo "# ============================================"
    echo ""
    echo "# ==================="
    echo "# Site Settings"
    echo "# ==================="
    echo "SITE_NAME=\"${ESC_SITE_NAME}\""
    echo "SITE_DESCRIPTION=\"${ESC_SITE_DESCRIPTION}\""
    echo "SITE_URL=\"${SITE_URL}\""
    echo ""
    echo "# ==================="
    echo "# Ports"
    echo "# ==================="
    echo "APP_PORT=${APP_PORT}"
    echo "API_PORT=${API_PORT}"
    echo "POSTGRES_PORT=${POSTGRES_PORT}"
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
    echo ""
    echo "# ==================="
    echo "# Features"
    echo "# ==================="
    echo "FEATURE_PLAY_LOGS=${FEATURE_PLAY_LOGS}"
    echo "FEATURE_WISHLIST=${FEATURE_WISHLIST}"
    echo "FEATURE_FOR_SALE=${FEATURE_FOR_SALE}"
    echo "FEATURE_MESSAGING=${FEATURE_MESSAGING}"
    echo "FEATURE_RATINGS=${FEATURE_RATINGS}"
    echo "FEATURE_DEMO_MODE=${FEATURE_DEMO_MODE}"
    echo ""
    echo "# ==================="
    echo "# Email (SMTP)"
    echo "# ==================="
    echo "SMTP_HOST=\"${SMTP_HOST}\""
    echo "SMTP_PORT=\"${SMTP_PORT}\""
    echo "SMTP_USER=\"${SMTP_USER}\""
    echo "SMTP_PASS=\"${ESC_SMTP_PASS}\""
    echo "SMTP_FROM=\"${SMTP_FROM}\""
    echo ""
    echo "# ==================="
    echo "# AI (BYOK)"
    echo "# ==================="
    echo "AI_PROVIDER=\"${AI_PROVIDER}\""
    echo "AI_API_KEY=\"${ESC_AI_API_KEY}\""
} > .env

echo -e "${GREEN}✓${NC} Created .env file"

# Save credentials
{
    echo "# KEEP THIS FILE SECURE"
    echo "# Generated: $(date)"
    echo ""
    echo "Database Password: $POSTGRES_PASSWORD"
    echo "JWT Secret: $JWT_SECRET"
    echo ""
    echo "Admin Email: $ADMIN_EMAIL"
    echo "Admin Password: $ADMIN_PASSWORD"
} > .credentials
chmod 600 .credentials
echo -e "${GREEN}✓${NC} Saved credentials to .credentials"

# ==========================================
# START SERVICES
# ==========================================

echo ""
echo -e "${BOLD}━━━ Starting Services ━━━${NC}"
echo ""

echo -e "${CYAN}Starting v2 stack (3 containers)...${NC}"
docker compose -f docker-compose-v2.yml up -d --build

# ==========================================
# WAIT FOR DATABASE
# ==========================================

echo ""
echo -e "${CYAN}Waiting for database to be ready...${NC}"

for i in {1..60}; do
    if docker exec gamehaven-db-v2 pg_isready -U postgres -d gamehaven >/dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} Database is ready"
        break
    fi
    
    if [ $i -eq 60 ]; then
        echo -e "${RED}Error: Database failed to start${NC}"
        docker compose -f docker-compose-v2.yml logs db
        exit 1
    fi
    
    echo "  Waiting for database... ($i/60)"
    sleep 2
done

# ==========================================
# WAIT FOR API
# ==========================================

echo ""
echo -e "${CYAN}Waiting for API to be ready...${NC}"

for i in {1..60}; do
    if curl -fsS --max-time 2 "http://localhost:${API_PORT}/health" >/dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} API is ready"
        break
    fi
    
    if [ $i -eq 60 ]; then
        echo -e "${RED}Error: API failed to start${NC}"
        docker compose -f docker-compose-v2.yml logs api
        exit 1
    fi
    
    echo "  Waiting for API... ($i/60)"
    sleep 2
done

# ==========================================
# CREATE ADMIN USER
# ==========================================

echo ""
echo -e "${BOLD}━━━ Creating Admin User ━━━${NC}"
echo ""

# Use the create-admin-v2.sh script with environment variables
export ADMIN_EMAIL ADMIN_PASSWORD
./scripts/create-admin-v2.sh --non-interactive

echo -e "${GREEN}✓${NC} Admin user created"

# ==========================================
# NGINX SETUP (OPTIONAL)
# ==========================================

if [ "$DOMAIN" != "localhost" ]; then
    echo ""
    prompt_yn SETUP_NGINX "Setup Nginx reverse proxy with SSL for $DOMAIN?" "y"
    
    if [ "$SETUP_NGINX" = true ]; then
        chmod +x ./scripts/setup-nginx.sh
        API_PORT=$API_PORT APP_PORT=$APP_PORT DOMAIN=$DOMAIN ./scripts/setup-nginx.sh
    fi
fi

# ==========================================
# COMPLETE
# ==========================================

echo ""
echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║${NC}             ${BOLD}${GREEN}v2 Installation Complete!${NC}                      ${CYAN}║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BOLD}Your Game Haven v2 is ready!${NC}"
echo ""
echo -e "  ${BOLD}App URL:${NC}     ${GREEN}$SITE_URL${NC}"
echo -e "  ${BOLD}API URL:${NC}     ${GREEN}$API_URL${NC}"
echo ""
echo -e "  ${BOLD}Admin Login:${NC}"
echo -e "    Email:     ${GREEN}$ADMIN_EMAIL${NC}"
echo -e "    Password:  ${GREEN}(saved in .credentials)${NC}"
echo ""
echo -e "${BOLD}Useful Commands:${NC}"
echo -e "  View logs:      ${YELLOW}docker compose -f docker-compose-v2.yml logs -f${NC}"
echo -e "  Stop services:  ${YELLOW}docker compose -f docker-compose-v2.yml down${NC}"
echo -e "  Restart:        ${YELLOW}docker compose -f docker-compose-v2.yml restart${NC}"
echo -e "  Backup DB:      ${YELLOW}./scripts/backup.sh${NC}"
echo ""
echo -e "${YELLOW}⚠ Credentials saved to .credentials - keep this file secure!${NC}"
echo ""
