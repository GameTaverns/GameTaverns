#!/bin/bash
# =============================================================================
# GameTaverns - Self-Hosted Supabase Installation Script
# Ubuntu 22.04 / 24.04 LTS
# Domain: gametaverns.com (hardcoded)
# =============================================================================

set -e

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

# ===========================================
# Logging
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

# ===========================================
# Pre-flight
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
    error "Please run as root (sudo ./install.sh)"
fi

# Run preflight check
if [ -f "$SCRIPT_DIR/scripts/preflight-check.sh" ]; then
    echo "Running pre-flight checks..."
    bash "$SCRIPT_DIR/scripts/preflight-check.sh" || {
        echo ""
        read -p "Continue despite errors? (y/N): " CONTINUE
        if [[ ! "$CONTINUE" =~ ^[Yy]$ ]]; then
            exit 1
        fi
    }
fi

# ===========================================
# Collect Configuration
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
# API Keys Configuration
# ===========================================
echo ""
echo "=============================================="
echo "  API Keys Configuration"
echo "=============================================="
echo ""
echo -e "${YELLOW}Note: Press Enter to skip any optional keys${NC}"
echo ""

# Discord Integration
echo -e "${BLUE}--- Discord Integration (for notifications & OAuth) ---${NC}"
read -p "Discord Bot Token: " DISCORD_BOT_TOKEN
read -p "Discord Client ID: " DISCORD_CLIENT_ID
read -p "Discord Client Secret: " DISCORD_CLIENT_SECRET

# AI Services
echo ""
echo -e "${BLUE}--- AI Services (for game recommendations & import) ---${NC}"
read -p "Perplexity API Key: " PERPLEXITY_API_KEY
read -p "OpenAI API Key (optional): " OPENAI_API_KEY
read -p "Firecrawl API Key (for URL imports): " FIRECRAWL_API_KEY

# Bot Protection
echo ""
echo -e "${BLUE}--- Cloudflare Turnstile (bot protection) ---${NC}"
read -p "Turnstile Site Key: " TURNSTILE_SITE_KEY
read -p "Turnstile Secret Key: " TURNSTILE_SECRET_KEY

# External SMTP (optional)
echo ""
echo -e "${BLUE}--- External SMTP (leave empty to use built-in mail server) ---${NC}"
read -p "External SMTP Host (optional): " EXT_SMTP_HOST
if [ -n "$EXT_SMTP_HOST" ]; then
    read -p "External SMTP Port [587]: " EXT_SMTP_PORT
    EXT_SMTP_PORT=${EXT_SMTP_PORT:-587}
    read -p "External SMTP User: " EXT_SMTP_USER
    read -s -p "External SMTP Password: " EXT_SMTP_PASS
    echo ""
fi

# ===========================================
# Install Docker
# ===========================================
echo ""
echo "Installing Docker..."

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
    success "Docker already installed"
fi

# ===========================================
# Generate Security Keys
# ===========================================
echo ""
echo "Generating security keys..."

POSTGRES_PASSWORD=$(openssl rand -base64 32 | tr -d '/+=' | head -c 32)
JWT_SECRET=$(openssl rand -base64 64 | tr -d '/+=' | head -c 64)
SECRET_KEY_BASE=$(openssl rand -base64 64 | tr -d '/+=' | head -c 64)
PII_ENCRYPTION_KEY=$(openssl rand -base64 32 | tr -d '/+=' | head -c 32)

# Generate Supabase JWT tokens
# These need to be properly signed JWTs
generate_jwt() {
    local role=$1
    local header='{"alg":"HS256","typ":"JWT"}'
    local payload="{\"role\":\"$role\",\"iss\":\"supabase\",\"iat\":$(date +%s),\"exp\":$(($(date +%s) + 157680000))}"
    
    local header_base64=$(echo -n "$header" | base64 -w 0 | tr '+/' '-_' | tr -d '=')
    local payload_base64=$(echo -n "$payload" | base64 -w 0 | tr '+/' '-_' | tr -d '=')
    local signature=$(echo -n "${header_base64}.${payload_base64}" | openssl dgst -sha256 -hmac "$JWT_SECRET" -binary | base64 -w 0 | tr '+/' '-_' | tr -d '=')
    
    echo "${header_base64}.${payload_base64}.${signature}"
}

ANON_KEY=$(generate_jwt "anon")
SERVICE_ROLE_KEY=$(generate_jwt "service_role")

success "Security keys generated"

# ===========================================
# Setup Directory Structure
# ===========================================
echo ""
echo "Setting up directories..."

mkdir -p "$INSTALL_DIR"
mkdir -p "$INSTALL_DIR/volumes/db/data"
mkdir -p "$INSTALL_DIR/volumes/storage"
mkdir -p "$INSTALL_DIR/volumes/mail/vmail"
mkdir -p "$INSTALL_DIR/volumes/mail/config"
mkdir -p "$INSTALL_DIR/logs"
mkdir -p "$INSTALL_DIR/nginx/ssl"

# Copy deployment files
cp -r "$SCRIPT_DIR"/* "$INSTALL_DIR/"

success "Directory structure created"

# ===========================================
# Generate .env File
# ===========================================
echo ""
echo "Generating configuration..."

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
LIBRARY_SUBDOMAIN_PATTERN=*.${DOMAIN}

# Security Keys (auto-generated)
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

# Auth
DISABLE_SIGNUP=false
ENABLE_EMAIL_SIGNUP=true
ENABLE_EMAIL_AUTOCONFIRM=false
JWT_EXPIRY=3600

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
# API Keys (configured during installation)
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
# Save Credentials
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

Studio URL: https://$DOMAIN:3001
API URL: https://api.$DOMAIN

============================================
KEEP THIS FILE SECURE!
============================================
EOF

chmod 600 "$CREDS_FILE"
success "Credentials saved to $CREDS_FILE"

# ===========================================
# Pull Docker Images
# ===========================================
echo ""
echo "Pulling Docker images (this may take a while)..."

cd "$INSTALL_DIR"
docker compose pull

success "Docker images pulled"

# ===========================================
# Summary
# ===========================================
echo ""
echo "=============================================="
echo -e "${GREEN}  Installation Complete!${NC}"
echo "=============================================="
echo ""
echo "Next steps:"
echo ""
echo "1. Configure DNS:"
echo "   A record: $DOMAIN -> YOUR_SERVER_IP"
echo "   A record: api.$DOMAIN -> YOUR_SERVER_IP"
echo "   A record: mail.$DOMAIN -> YOUR_SERVER_IP"
echo ""
echo "2. Start services:"
echo "   cd $INSTALL_DIR"
echo "   docker compose up -d"
echo ""
echo "3. Set up SSL:"
echo "   ./scripts/setup-ssl.sh"
echo ""
echo "4. Create admin user:"
echo "   ./scripts/create-admin.sh"
echo ""
echo "5. (Optional) Add API keys to .env:"
echo "   nano $INSTALL_DIR/.env"
echo "   docker compose restart functions"
echo ""
echo "Credentials saved to: $CREDS_FILE"
echo ""
