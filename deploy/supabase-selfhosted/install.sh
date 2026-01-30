#!/bin/bash
# =============================================================================
# GameTaverns - Self-Hosted Supabase Installation Script
# Ubuntu 22.04 / 24.04 LTS
# Domain: gametaverns.com (hardcoded)
# =============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

INSTALL_DIR="/opt/gametaverns"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="/var/log/gametaverns-install.log"

# Hardcoded domain
DOMAIN="gametaverns.com"
SITE_NAME="GameTaverns"

# Initialize log file
mkdir -p "$(dirname "$LOG_FILE")"
touch "$LOG_FILE"

# ===========================================
# Logging Functions
# ===========================================
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}ERROR: $1${NC}" | tee -a "$LOG_FILE"
    exit 1
}

warn() {
    echo -e "${YELLOW}WARNING: $1${NC}" | tee -a "$LOG_FILE"
}

success() {
    echo -e "${GREEN}✓ $1${NC}" | tee -a "$LOG_FILE"
}

info() {
    echo -e "${BLUE}ℹ $1${NC}" | tee -a "$LOG_FILE"
}

# ===========================================
# Pre-flight Checks
# ===========================================
echo ""
echo "=============================================="
echo "  GameTaverns Self-Hosted Installer"
echo "  Supabase Edition"
echo "  Domain: $DOMAIN"
echo "=============================================="
echo ""

# Check root
if [ "$EUID" -ne 0 ]; then
    error "Please run as root: sudo ./install.sh"
fi

# Check minimum RAM (2GB)
TOTAL_RAM_KB=$(grep MemTotal /proc/meminfo | awk '{print $2}')
TOTAL_RAM_GB=$((TOTAL_RAM_KB / 1024 / 1024))
if [ "$TOTAL_RAM_GB" -lt 2 ]; then
    warn "System has less than 2GB RAM. Recommended: 4GB+ for production."
fi

# Check disk space (10GB minimum)
FREE_DISK_GB=$(df / | tail -1 | awk '{print int($4/1024/1024)}')
if [ "$FREE_DISK_GB" -lt 10 ]; then
    warn "Less than 10GB free disk space. Recommended: 20GB+"
fi

# Run preflight check if exists
if [ -f "$SCRIPT_DIR/scripts/preflight-check.sh" ]; then
    info "Running pre-flight checks..."
    if ! bash "$SCRIPT_DIR/scripts/preflight-check.sh"; then
        echo ""
        read -p "Continue despite warnings? (y/N): " CONTINUE
        if [[ ! "$CONTINUE" =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
fi

# ===========================================
# Collect Admin Configuration
# ===========================================
echo ""
echo "=============================================="
echo "  Admin Configuration"
echo "=============================================="
echo ""

read -p "Enter admin email [admin@$DOMAIN]: " ADMIN_EMAIL
ADMIN_EMAIL=${ADMIN_EMAIL:-admin@$DOMAIN}

read -p "Timezone [America/New_York]: " TIMEZONE
TIMEZONE=${TIMEZONE:-America/New_York}

# ===========================================
# Collect API Keys
# ===========================================
echo ""
echo "=============================================="
echo "  API Keys Configuration"
echo "=============================================="
echo ""
echo -e "${YELLOW}Note: Press Enter to skip optional keys${NC}"
echo ""

# Discord Integration
echo -e "${BLUE}--- Discord Integration ---${NC}"
echo "Create app at: https://discord.com/developers/applications"
read -p "Discord Bot Token: " DISCORD_BOT_TOKEN
DISCORD_BOT_TOKEN=${DISCORD_BOT_TOKEN:-}
read -p "Discord Client ID: " DISCORD_CLIENT_ID
DISCORD_CLIENT_ID=${DISCORD_CLIENT_ID:-}
read -p "Discord Client Secret: " DISCORD_CLIENT_SECRET
DISCORD_CLIENT_SECRET=${DISCORD_CLIENT_SECRET:-}

# AI Services
echo ""
echo -e "${BLUE}--- AI Services ---${NC}"
echo "Perplexity (https://www.perplexity.ai/settings/api)"
read -p "Perplexity API Key: " PERPLEXITY_API_KEY
PERPLEXITY_API_KEY=${PERPLEXITY_API_KEY:-}
echo "OpenAI (https://platform.openai.com/api-keys) - optional"
read -p "OpenAI API Key: " OPENAI_API_KEY
OPENAI_API_KEY=${OPENAI_API_KEY:-}
echo "Firecrawl (https://www.firecrawl.dev/) - for URL imports"
read -p "Firecrawl API Key: " FIRECRAWL_API_KEY
FIRECRAWL_API_KEY=${FIRECRAWL_API_KEY:-}

# Bot Protection
echo ""
echo -e "${BLUE}--- Cloudflare Turnstile ---${NC}"
echo "Get keys at: https://dash.cloudflare.com/?to=/:account/turnstile"
read -p "Turnstile Site Key: " TURNSTILE_SITE_KEY
TURNSTILE_SITE_KEY=${TURNSTILE_SITE_KEY:-}
read -p "Turnstile Secret Key: " TURNSTILE_SECRET_KEY
TURNSTILE_SECRET_KEY=${TURNSTILE_SECRET_KEY:-}

# External SMTP (optional)
echo ""
echo -e "${BLUE}--- External SMTP (optional) ---${NC}"
echo "Leave empty to use built-in mail server"
read -p "External SMTP Host: " EXT_SMTP_HOST
EXT_SMTP_HOST=${EXT_SMTP_HOST:-}
if [ -n "$EXT_SMTP_HOST" ]; then
    read -p "External SMTP Port [587]: " EXT_SMTP_PORT
    EXT_SMTP_PORT=${EXT_SMTP_PORT:-587}
    read -p "External SMTP User: " EXT_SMTP_USER
    EXT_SMTP_USER=${EXT_SMTP_USER:-}
    read -s -p "External SMTP Password: " EXT_SMTP_PASS
    EXT_SMTP_PASS=${EXT_SMTP_PASS:-}
    echo ""
else
    EXT_SMTP_PORT=""
    EXT_SMTP_USER=""
    EXT_SMTP_PASS=""
fi

# ===========================================
# Install Docker
# ===========================================
echo ""
info "Checking Docker installation..."

if ! command -v docker &> /dev/null; then
    log "Installing Docker..."
    
    # Remove old versions
    apt-get remove -y docker docker-engine docker.io containerd runc 2>/dev/null || true
    
    # Install prerequisites
    apt-get update
    apt-get install -y \
        apt-transport-https \
        ca-certificates \
        curl \
        gnupg \
        lsb-release
    
    # Add Docker GPG key
    mkdir -p /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    
    # Add Docker repo
    echo \
        "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
        $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    # Install Docker
    apt-get update
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
    
    # Start Docker
    systemctl enable docker
    systemctl start docker
    
    success "Docker installed"
else
    success "Docker already installed: $(docker --version)"
fi

# Verify Docker Compose
if ! docker compose version &> /dev/null; then
    error "Docker Compose plugin not found. Please install docker-compose-plugin."
fi
success "Docker Compose: $(docker compose version --short)"

# ===========================================
# Generate Security Keys
# ===========================================
echo ""
info "Generating security keys..."

# Generate secure random strings
POSTGRES_PASSWORD=$(openssl rand -base64 32 | tr -d '/+=' | head -c 32)
JWT_SECRET=$(openssl rand -base64 64 | tr -d '/+=' | head -c 64)
SECRET_KEY_BASE=$(openssl rand -base64 64 | tr -d '/+=' | head -c 64)
PII_ENCRYPTION_KEY=$(openssl rand -base64 32 | tr -d '/+=' | head -c 32)

# Generate Supabase JWT tokens using proper base64url encoding
generate_jwt() {
    local role=$1
    local now=$(date +%s)
    local exp=$((now + 157680000)) # 5 years
    
    # Header
    local header='{"alg":"HS256","typ":"JWT"}'
    local header_b64=$(echo -n "$header" | openssl base64 -e | tr -d '\n=' | tr '+/' '-_')
    
    # Payload
    local payload="{\"role\":\"$role\",\"iss\":\"supabase\",\"iat\":$now,\"exp\":$exp}"
    local payload_b64=$(echo -n "$payload" | openssl base64 -e | tr -d '\n=' | tr '+/' '-_')
    
    # Signature
    local sig=$(echo -n "${header_b64}.${payload_b64}" | openssl dgst -sha256 -hmac "$JWT_SECRET" -binary | openssl base64 -e | tr -d '\n=' | tr '+/' '-_')
    
    echo "${header_b64}.${payload_b64}.${sig}"
}

ANON_KEY=$(generate_jwt "anon")
SERVICE_ROLE_KEY=$(generate_jwt "service_role")

success "Security keys generated"

# ===========================================
# Setup Directory Structure
# ===========================================
echo ""
info "Setting up directories..."

mkdir -p "$INSTALL_DIR"
mkdir -p "$INSTALL_DIR/logs"
mkdir -p "$INSTALL_DIR/nginx/ssl"
mkdir -p "$INSTALL_DIR/backups"

# Copy deployment files
cp -r "$SCRIPT_DIR"/* "$INSTALL_DIR/"
chmod +x "$INSTALL_DIR/scripts"/*.sh 2>/dev/null || true

# Copy source files needed for builds
# The script should be run from the project root (where package.json is)
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"
if [ -f "$PROJECT_ROOT/package.json" ]; then
    info "Copying application source files..."
    
    # Copy frontend source
    cp -r "$PROJECT_ROOT/src" "$INSTALL_DIR/"
    cp -r "$PROJECT_ROOT/public" "$INSTALL_DIR/"
    # Copy package files first
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
    
    # Optional config files - create empty if missing
    cp "$PROJECT_ROOT/components.json" "$INSTALL_DIR/" 2>/dev/null || echo '{}' > "$INSTALL_DIR/components.json"
    cp "$PROJECT_ROOT/eslint.config.js" "$INSTALL_DIR/" 2>/dev/null || true
    
    # Copy edge functions
    mkdir -p "$INSTALL_DIR/supabase"
    if [ -d "$PROJECT_ROOT/supabase/functions" ]; then
        cp -r "$PROJECT_ROOT/supabase/functions" "$INSTALL_DIR/supabase/"
        success "Edge functions copied"
    else
        warn "No edge functions found at $PROJECT_ROOT/supabase/functions"
    fi
    
    # Copy supabase config (needed for edge functions)
    cp "$PROJECT_ROOT/supabase/config.toml" "$INSTALL_DIR/supabase/" 2>/dev/null || true
    
    success "Application source files copied"
else
    error "Could not find project root at $PROJECT_ROOT - run install.sh from the deploy/supabase-selfhosted directory within the cloned repo"
fi

success "Directory structure created at $INSTALL_DIR"

# ===========================================
# Generate .env File
# ===========================================
echo ""
info "Generating configuration..."

cat > "$INSTALL_DIR/.env" << EOF
############################################################
# GameTaverns Self-Hosted Configuration
# Generated: $(date)
# Domain: $DOMAIN (hardcoded)
############################################################

# Domain & URLs (hardcoded for gametaverns.com)
DOMAIN=$DOMAIN
SITE_URL=https://$DOMAIN
API_EXTERNAL_URL=https://api.$DOMAIN
STUDIO_URL=https://studio.$DOMAIN
MAIL_DOMAIN=$DOMAIN

# Wildcard subdomain for libraries (*.gametaverns.com)
LIBRARY_SUBDOMAIN_PATTERN=*.$DOMAIN

# Security Keys (auto-generated - DO NOT SHARE)
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
JWT_SECRET=$JWT_SECRET
ANON_KEY=$ANON_KEY
SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY
SECRET_KEY_BASE=$SECRET_KEY_BASE
PII_ENCRYPTION_KEY=$PII_ENCRYPTION_KEY

# Site Branding
SITE_NAME=$SITE_NAME
SITE_DESCRIPTION=Browse and discover our collection of board games

# Ports (internal)
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
SMTP_HOST=${EXT_SMTP_HOST:-mail}
SMTP_PORT=${EXT_SMTP_PORT:-587}
SMTP_USER=${EXT_SMTP_USER:-}
SMTP_PASS=${EXT_SMTP_PASS:-}
SMTP_ADMIN_EMAIL=$ADMIN_EMAIL
SMTP_SENDER_NAME=$SITE_NAME
SMTP_FROM=noreply@$DOMAIN

# Timezone
TIMEZONE=$TIMEZONE

# ===========================================
# External API Keys
# ===========================================

# Discord Integration
DISCORD_BOT_TOKEN=${DISCORD_BOT_TOKEN:-}
DISCORD_CLIENT_ID=${DISCORD_CLIENT_ID:-}
DISCORD_CLIENT_SECRET=${DISCORD_CLIENT_SECRET:-}

# AI Services
PERPLEXITY_API_KEY=${PERPLEXITY_API_KEY:-}
OPENAI_API_KEY=${OPENAI_API_KEY:-}
FIRECRAWL_API_KEY=${FIRECRAWL_API_KEY:-}

# Bot Protection (Cloudflare Turnstile)
TURNSTILE_SITE_KEY=${TURNSTILE_SITE_KEY:-}
TURNSTILE_SECRET_KEY=${TURNSTILE_SECRET_KEY:-}
EOF

chmod 600 "$INSTALL_DIR/.env"
success "Configuration file created"

# ===========================================
# Save Credentials to Secure File
# ===========================================
CREDS_FILE="/root/gametaverns-credentials.txt"
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
success "Credentials saved to $CREDS_FILE"

# ===========================================
# Render Kong Configuration with API Keys
# ===========================================
echo ""
info "Rendering Kong configuration..."

# Replace placeholders with actual keys using sed
# This handles the API keys that Kong needs for authentication
sed -i \
    -e "s|ANON_KEY_PLACEHOLDER|${ANON_KEY}|g" \
    -e "s|SERVICE_ROLE_KEY_PLACEHOLDER|${SERVICE_ROLE_KEY}|g" \
    "$INSTALL_DIR/kong.yml"

success "Kong configuration rendered with API keys"

# ===========================================
# Pull Docker Images
# ===========================================
echo ""
info "Pulling Docker images (this may take several minutes)..."

cd "$INSTALL_DIR"
docker compose pull 2>&1 | tee -a "$LOG_FILE"

success "Docker images pulled"

# ===========================================
# Build Frontend Container
# ===========================================
echo ""
info "Building frontend application..."

docker compose build app 2>&1 | tee -a "$LOG_FILE"

success "Frontend built"

# ===========================================
# Start Services
# ===========================================
echo ""
info "Starting all services..."

docker compose up -d 2>&1 | tee -a "$LOG_FILE"

# Wait for database health
echo ""
info "Waiting for database to be ready..."
MAX_RETRIES=60
RETRY_COUNT=0

while ! docker compose exec -T db pg_isready -U supabase_admin -d postgres > /dev/null 2>&1; do
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
        error "Database failed to start after $MAX_RETRIES attempts. Check logs: docker compose logs db"
    fi
    echo "  Waiting for database... ($RETRY_COUNT/$MAX_RETRIES)"
    sleep 3
done

success "Database is ready"

# Give PostgreSQL time to fully initialize roles
sleep 5

# ===========================================
# Run Database Migrations Manually
# ===========================================
echo ""
info "Running database migrations..."

# Note: Migrations in /docker-entrypoint-initdb.d only run on fresh DB
# For existing installations, we run them manually

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
)

MIGRATION_ERRORS=0
for migration in "${MIGRATION_FILES[@]}"; do
    if [ -f "$INSTALL_DIR/migrations/$migration" ]; then
        echo "  Running: $migration"
        if docker compose exec -T db psql -U supabase_admin -d postgres -f "/docker-entrypoint-initdb.d/$migration" >> "$LOG_FILE" 2>&1; then
            success "  $migration"
        else
            warn "  $migration may have had issues (often OK for IF NOT EXISTS)"
            MIGRATION_ERRORS=$((MIGRATION_ERRORS + 1))
        fi
    else
        warn "  $migration not found, skipping"
    fi
done

if [ $MIGRATION_ERRORS -gt 0 ]; then
    warn "Some migrations had warnings - this is often normal for 'already exists' errors"
fi

success "Database migrations complete"

# ===========================================
# Verify Installation
# ===========================================
echo ""
info "Verifying installation..."

# Wait for services to stabilize
sleep 10

# Check all containers are running
FAILED_CONTAINERS=$(docker compose ps --format '{{.Name}} {{.Status}}' 2>/dev/null | grep -v "Up" | grep -v "NAME" || true)
if [ -n "$FAILED_CONTAINERS" ]; then
    warn "Some containers may still be starting:"
    echo "$FAILED_CONTAINERS"
else
    success "All containers running"
fi

# Verify critical tables exist
echo ""
info "Verifying database schema..."
TABLES_CHECK=$(docker compose exec -T db psql -U supabase_admin -d postgres -t -c "SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('user_profiles', 'libraries', 'games', 'library_settings');" 2>/dev/null | tr -d ' ')
if [ "$TABLES_CHECK" = "4" ]; then
    success "Core database tables created"
else
    warn "Some tables may be missing. Check: docker compose exec db psql -U supabase_admin -d postgres -c '\\dt public.*'"
fi

# ===========================================
# Print Summary
# ===========================================
echo ""
echo "=============================================="
echo -e "${GREEN}  Installation Complete!${NC}"
echo "=============================================="
echo ""
echo "Your GameTaverns instance is now running!"
echo ""
echo "Next steps:"
echo ""
echo "1. Configure DNS (if not already done):"
echo "   A record: @     -> YOUR_SERVER_IP"
echo "   A record: *     -> YOUR_SERVER_IP (for tenant subdomains)"
echo "   A record: api   -> YOUR_SERVER_IP"
echo "   A record: mail  -> YOUR_SERVER_IP"
echo "   A record: studio -> YOUR_SERVER_IP"
echo ""
echo "2. Set up SSL certificates:"
echo "   cd $INSTALL_DIR"
echo "   sudo ./scripts/setup-ssl.sh"
echo ""
echo "3. Create your admin user:"
echo "   sudo ./scripts/create-admin.sh"
echo ""
echo "=============================================="
echo "  URLs (after SSL setup)"
echo "=============================================="
echo ""
echo "  Main Site:  https://$DOMAIN"
echo "  API:        https://api.$DOMAIN"
echo "  Studio:     https://studio.$DOMAIN"
echo "  Webmail:    https://mail.$DOMAIN"
echo ""
echo "  Libraries:  https://{slug}.$DOMAIN"
echo "              e.g., https://tzolak.$DOMAIN"
echo ""
echo "=============================================="
echo "  API Keys Status"
echo "=============================================="
[ -n "${DISCORD_BOT_TOKEN:-}" ] && echo "  ✓ Discord Bot" || echo "  ✗ Discord Bot (not configured)"
[ -n "${DISCORD_CLIENT_ID:-}" ] && echo "  ✓ Discord OAuth" || echo "  ✗ Discord OAuth (not configured)"
[ -n "${PERPLEXITY_API_KEY:-}" ] && echo "  ✓ Perplexity AI" || echo "  ✗ Perplexity AI (not configured)"
[ -n "${FIRECRAWL_API_KEY:-}" ] && echo "  ✓ Firecrawl" || echo "  ✗ Firecrawl (not configured)"
[ -n "${TURNSTILE_SITE_KEY:-}" ] && echo "  ✓ Turnstile Bot Protection" || echo "  ✗ Turnstile (not configured)"
echo ""
echo "To update API keys later:"
echo "  nano $INSTALL_DIR/.env"
echo "  docker compose restart functions"
echo ""
echo "Credentials saved to: $CREDS_FILE"
echo ""
echo "Useful commands:"
echo "  View logs:     docker compose logs -f"
echo "  Check status:  docker compose ps"
echo "  Restart all:   docker compose restart"
echo ""
log "Installation completed successfully"
