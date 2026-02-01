#!/bin/bash
# =============================================================================
# GameTaverns - Complete Self-Hosted Installation Script
# Ubuntu 22.04 / 24.04 LTS
# Domain: gametaverns.com (hardcoded)
# Version: 2.2.0 - 5-Tier Role Hierarchy
# 
# This script handles EVERYTHING:
#   ✓ Docker verification
#   ✓ Security key generation
#   ✓ API key configuration (Discord, Perplexity, Turnstile, etc.)
#   ✓ Database setup & migrations
#   ✓ Frontend build
#   ✓ Mail server configuration
#   ✓ SSL certificate setup
#   ✓ Admin user creation
#
# Pre-requisites:
#   Run bootstrap.sh first to install Docker, Nginx, etc.
#   Or run: curl -fsSL https://...bootstrap.sh | sudo bash
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
echo -e "${CYAN}║         GameTaverns Self-Hosted Installer                         ║${NC}"
echo -e "${CYAN}║         Complete Setup - Database to Admin                        ║${NC}"
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
# STEP 1: Collect All Configuration
# ===========================================
step "1/10" "Collecting Configuration"

echo ""
echo -e "${BLUE}=== Admin Configuration ===${NC}"
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

read -p "Timezone [America/New_York]: " TIMEZONE
TIMEZONE=${TIMEZONE:-America/New_York}

echo ""
echo -e "${BLUE}=== Discord Integration ===${NC}"
echo "Create app at: https://discord.com/developers/applications"
echo -e "${YELLOW}(Press Enter to skip optional keys)${NC}"
read -p "Discord Bot Token: " DISCORD_BOT_TOKEN
DISCORD_BOT_TOKEN=${DISCORD_BOT_TOKEN:-}
read -p "Discord Client ID: " DISCORD_CLIENT_ID
DISCORD_CLIENT_ID=${DISCORD_CLIENT_ID:-}
read -p "Discord Client Secret: " DISCORD_CLIENT_SECRET
DISCORD_CLIENT_SECRET=${DISCORD_CLIENT_SECRET:-}

echo ""
echo -e "${BLUE}=== AI Services (Perplexity powers all AI features) ===${NC}"
echo "Perplexity (https://www.perplexity.ai/settings/api) - RECOMMENDED for all AI"
read -p "Perplexity API Key: " PERPLEXITY_API_KEY
PERPLEXITY_API_KEY=${PERPLEXITY_API_KEY:-}
echo "Firecrawl (https://www.firecrawl.dev/) - for URL-based game imports"
read -p "Firecrawl API Key: " FIRECRAWL_API_KEY
FIRECRAWL_API_KEY=${FIRECRAWL_API_KEY:-}

echo ""
echo -e "${BLUE}=== BoardGameGeek Integration ===${NC}"
echo "BGG API Token (optional) - for authenticated collection imports"
read -p "BGG API Token: " BGG_API_TOKEN
BGG_API_TOKEN=${BGG_API_TOKEN:-}

echo ""
echo -e "${BLUE}=== Cloudflare Turnstile (Bot Protection) ===${NC}"
echo "Get keys at: https://dash.cloudflare.com/?to=/:account/turnstile"
read -p "Turnstile Site Key: " TURNSTILE_SITE_KEY
TURNSTILE_SITE_KEY=${TURNSTILE_SITE_KEY:-}
read -p "Turnstile Secret Key: " TURNSTILE_SECRET_KEY
TURNSTILE_SECRET_KEY=${TURNSTILE_SECRET_KEY:-}

echo ""
echo -e "${BLUE}=== External SMTP (optional) ===${NC}"
echo "Leave empty to use built-in mail server"
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

success "Configuration collected"

# ===========================================
# STEP 2: Generate Security Keys
# ===========================================
step "2/10" "Generating Security Keys"

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
step "3/10" "Setting Up Directories"

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
step "4/10" "Generating Configuration"

cat > "$INSTALL_DIR/.env" << EOF
############################################################
# GameTaverns Self-Hosted Configuration
# Generated: $(date)
# Domain: $DOMAIN
############################################################

# Domain & URLs
DOMAIN=$DOMAIN
SITE_URL=https://$DOMAIN
API_EXTERNAL_URL=https://api.$DOMAIN
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
SOGO_PORT=9001

# Auth Configuration
DISABLE_SIGNUP=false
ENABLE_EMAIL_SIGNUP=true
ENABLE_EMAIL_AUTOCONFIRM=false
JWT_EXPIRY=3600
ADDITIONAL_REDIRECT_URLS=

# SMTP Configuration
SMTP_HOST=${EXT_SMTP_HOST:-mail}
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

URLs:
  Main Site: https://$DOMAIN
  API: https://api.$DOMAIN
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
step "5/10" "Pulling Docker Images"

cd "$INSTALL_DIR"
docker compose pull 2>&1 | tee -a "$LOG_FILE"

success "Docker images pulled"

# ===========================================
# STEP 6: Build Frontend
# ===========================================
step "6/10" "Building Frontend"

docker compose build app 2>&1 | tee -a "$LOG_FILE"

success "Frontend built"

# ===========================================
# STEP 7: Start Services
# ===========================================
step "7/10" "Starting Services"

docker compose up -d 2>&1 | tee -a "$LOG_FILE"

# Wait for database
info "Waiting for database to be ready..."
MAX_RETRIES=60
RETRY_COUNT=0

while ! docker compose exec -T db pg_isready -U supabase_admin -d postgres > /dev/null 2>&1; do
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
        error "Database failed to start. Check: docker compose logs db"
    fi
    echo "  Waiting for database... ($RETRY_COUNT/$MAX_RETRIES)"
    sleep 3
done

success "Database is ready"

# Give PostgreSQL time to fully initialize
sleep 5

# ===========================================
# CRITICAL: Fix role passwords before other services connect
# ===========================================
info "Setting up database role passwords..."

# Escape single quotes in password for SQL
ESCAPED_PW=$(printf '%s' "$POSTGRES_PASSWORD" | sed "s/'/''/g")

docker compose exec -T db psql -U supabase_admin -d postgres << EOSQL >> "$LOG_FILE" 2>&1
-- Create roles if they don't exist
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticator') THEN
    CREATE ROLE authenticator WITH LOGIN NOINHERIT;
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
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
    CREATE ROLE supabase_auth_admin WITH LOGIN SUPERUSER CREATEDB CREATEROLE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_storage_admin') THEN
    CREATE ROLE supabase_storage_admin WITH LOGIN CREATEDB CREATEROLE;
  END IF;
END
\$\$;

-- Set passwords for all login roles
ALTER ROLE authenticator WITH LOGIN PASSWORD '${ESCAPED_PW}';
ALTER ROLE supabase_auth_admin WITH PASSWORD '${ESCAPED_PW}';
ALTER ROLE supabase_storage_admin WITH PASSWORD '${ESCAPED_PW}';
ALTER ROLE supabase_admin WITH PASSWORD '${ESCAPED_PW}';

-- Grant role switching permissions
GRANT anon TO authenticator;
GRANT authenticated TO authenticator;
GRANT service_role TO authenticator;
GRANT anon TO supabase_admin;
GRANT authenticated TO supabase_admin;
GRANT service_role TO supabase_admin;

-- Grant schema usage
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON SCHEMA public TO supabase_auth_admin;
GRANT ALL ON SCHEMA public TO supabase_storage_admin;

-- Ensure supabase_auth_admin has necessary permissions for GoTrue migrations
ALTER ROLE supabase_auth_admin WITH SUPERUSER CREATEDB CREATEROLE;
EOSQL

success "Database role passwords configured"

# Wait for other services now that DB roles are configured
info "Waiting for services to connect..."
sleep 10

# ===========================================
# STEP 8: Run Database Migrations
# ===========================================
step "8/10" "Running Database Migrations"

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
    "14-sogo-database.sql"
)

for migration in "${MIGRATION_FILES[@]}"; do
    if [ -f "$INSTALL_DIR/migrations/$migration" ]; then
        echo -n "  $migration ... "
        if docker compose exec -T db psql -U supabase_admin -d postgres -f "/docker-entrypoint-initdb.d/$migration" >> "$LOG_FILE" 2>&1; then
            echo -e "${GREEN}✓${NC}"
        else
            echo -e "${YELLOW}⚠${NC}"
        fi
    fi
done

success "Database migrations complete"

# ===========================================
# STEP 9: Setup SSL Certificates
# ===========================================
step "9/10" "Setting Up SSL"

# Check if certbot is available
if command -v certbot &> /dev/null; then
    echo ""
    echo "SSL certificates can be obtained via Let's Encrypt."
    echo "This requires DNS to be configured and ports 80/443 open."
    echo ""
    read -p "Configure SSL now? (y/N): " SETUP_SSL
    
    if [[ "$SETUP_SSL" =~ ^[Yy]$ ]]; then
        # Check for Cloudflare DNS plugin for wildcard support
        if [ -f /etc/letsencrypt/cloudflare.ini ] || command -v certbot &> /dev/null; then
            echo ""
            echo "For wildcard certificates (*.${DOMAIN}), you need Cloudflare DNS."
            read -p "Use Cloudflare DNS for wildcards? (y/N): " USE_CLOUDFLARE
            
            if [[ "$USE_CLOUDFLARE" =~ ^[Yy]$ ]]; then
                # Install Cloudflare plugin if not present
                apt-get install -y python3-certbot-dns-cloudflare 2>/dev/null || pip3 install certbot-dns-cloudflare
                
                read -p "Enter Cloudflare API Token: " CF_API_TOKEN
                mkdir -p /etc/letsencrypt
                cat > /etc/letsencrypt/cloudflare.ini << EOF
dns_cloudflare_api_token = $CF_API_TOKEN
EOF
                chmod 600 /etc/letsencrypt/cloudflare.ini
                
                # Get wildcard cert
                certbot certonly \
                    --dns-cloudflare \
                    --dns-cloudflare-credentials /etc/letsencrypt/cloudflare.ini \
                    -d "$DOMAIN" \
                    -d "*.$DOMAIN" \
                    --email "$ADMIN_EMAIL" \
                    --agree-tos \
                    --non-interactive
                
                # Copy certs to nginx
                cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem "$INSTALL_DIR/nginx/ssl/"
                cp /etc/letsencrypt/live/$DOMAIN/privkey.pem "$INSTALL_DIR/nginx/ssl/"
                
                success "Wildcard SSL certificates obtained"
            else
                # Standard certs (no wildcard)
                certbot certonly --nginx \
                    -d "$DOMAIN" \
                    -d "www.$DOMAIN" \
                    -d "api.$DOMAIN" \
                    -d "mail.$DOMAIN" \
                    -d "studio.$DOMAIN" \
                    --email "$ADMIN_EMAIL" \
                    --agree-tos \
                    --non-interactive
                
                cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem "$INSTALL_DIR/nginx/ssl/"
                cp /etc/letsencrypt/live/$DOMAIN/privkey.pem "$INSTALL_DIR/nginx/ssl/"
                
                success "SSL certificates obtained"
            fi
        fi
    else
        # Create self-signed for now
        info "Creating temporary self-signed certificate..."
        openssl req -x509 -nodes -newkey rsa:4096 \
            -days 365 \
            -keyout "$INSTALL_DIR/nginx/ssl/privkey.pem" \
            -out "$INSTALL_DIR/nginx/ssl/fullchain.pem" \
            -subj "/CN=$DOMAIN"
        
        warn "Using self-signed certificate. Run ./scripts/setup-ssl.sh later for Let's Encrypt."
    fi
else
    warn "Certbot not found. Install with: apt install certbot python3-certbot-nginx"
    
    # Create self-signed
    openssl req -x509 -nodes -newkey rsa:4096 \
        -days 365 \
        -keyout "$INSTALL_DIR/nginx/ssl/privkey.pem" \
        -out "$INSTALL_DIR/nginx/ssl/fullchain.pem" \
        -subj "/CN=$DOMAIN"
fi

# Restart nginx to pick up certs
systemctl reload nginx 2>/dev/null || true

success "SSL configuration complete"

# ===========================================
# STEP 10: Create Admin User
# ===========================================
step "10/10" "Creating Admin User"

# Wait for auth service
info "Waiting for auth service..."
MAX_RETRIES=90
RETRY_COUNT=0

while ! curl -sf "http://localhost:${KONG_HTTP_PORT:-8000}/auth/v1/health" > /dev/null 2>&1; do
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
        
        # Add admin role
        docker compose exec -T db psql -U supabase_admin -d postgres -c \
            "INSERT INTO public.user_roles (user_id, role) VALUES ('$USER_ID', 'admin') ON CONFLICT DO NOTHING;" 2>/dev/null || true
        
        success "Admin role assigned"
    else
        warn "Could not create admin user automatically. Run: ./scripts/create-admin.sh"
        echo "Response: $RESPONSE" >> "$LOG_FILE"
    fi
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
echo "  API:        https://api.$DOMAIN"
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
echo -e "${GREEN}Happy gaming! 🎲${NC}"
echo ""

log "Installation completed successfully"
