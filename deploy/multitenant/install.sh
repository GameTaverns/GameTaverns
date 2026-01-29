#!/bin/bash

# ============================================
# GameTaverns Multi-Tenant Installer
# ============================================
# Interactive setup script for self-hosted deployment
# Supports: Fresh Ubuntu, Docker, with optional Cloudflare SSL

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Banner
echo -e "${CYAN}"
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║        GameTaverns Multi-Tenant Installer v1.0            ║"
echo "║              Self-Hosted Board Game Library               ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    echo -e "${YELLOW}⚠ Running as root. It's recommended to run as a regular user with sudo access.${NC}"
fi

# Check Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}✗ Docker not found. Install Docker first:${NC}"
    echo "  curl -fsSL https://get.docker.com | sh"
    echo "  sudo usermod -aG docker \$USER"
    exit 1
fi

if ! command -v docker compose &> /dev/null; then
    echo -e "${RED}✗ Docker Compose not found. Install Docker Compose:${NC}"
    echo "  sudo apt install docker-compose-plugin"
    exit 1
fi

echo -e "${GREEN}✓ Docker and Docker Compose detected${NC}"
echo ""

# ============================================
# Configuration
# ============================================

ENV_FILE=".env"

# Check for existing config
if [ -f "$ENV_FILE" ]; then
    echo -e "${YELLOW}Existing configuration found. Overwrite? (y/N)${NC}"
    read -r OVERWRITE
    if [[ ! "$OVERWRITE" =~ ^[Yy]$ ]]; then
        echo "Using existing configuration."
        source "$ENV_FILE"
    fi
fi

echo -e "${BLUE}=== Site Configuration ===${NC}"
echo ""

# Domain
read -p "Enter your domain (e.g., gametaverns.com): " DOMAIN
DOMAIN=${DOMAIN:-gametaverns.com}

# Site name
read -p "Enter site name [GameTaverns]: " SITE_NAME
SITE_NAME=${SITE_NAME:-GameTaverns}

# Admin email
read -p "Enter admin email (for SSL & notifications): " ADMIN_EMAIL

echo ""
echo -e "${BLUE}=== SSL Configuration ===${NC}"
echo ""
echo "1) Let's Encrypt (automatic, requires ports 80/443 open)"
echo "2) Cloudflare (requires API token, handles wildcards)"
echo "3) Self-signed (for testing only)"
echo "4) None (you'll configure SSL separately)"
read -p "Choose SSL method [1]: " SSL_METHOD
SSL_METHOD=${SSL_METHOD:-1}

CLOUDFLARE_API_TOKEN=""
if [ "$SSL_METHOD" = "2" ]; then
    read -p "Enter Cloudflare API token: " CLOUDFLARE_API_TOKEN
fi

echo ""
echo -e "${BLUE}=== Security ===${NC}"
echo ""

# Generate secrets
JWT_SECRET=$(openssl rand -base64 48 | tr -dc 'a-zA-Z0-9' | head -c 64)
POSTGRES_PASSWORD=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 32)
PII_ENCRYPTION_KEY=$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 32)

echo -e "${GREEN}✓ Generated secure passwords and keys${NC}"

echo ""
echo -e "${BLUE}=== Email Configuration (Optional) ===${NC}"
echo ""
read -p "Configure SMTP for email notifications? (y/N): " CONFIGURE_EMAIL

SMTP_HOST=""
SMTP_PORT="587"
SMTP_USER=""
SMTP_PASS=""
SMTP_FROM=""

if [[ "$CONFIGURE_EMAIL" =~ ^[Yy]$ ]]; then
    read -p "SMTP Host (e.g., smtp.gmail.com): " SMTP_HOST
    read -p "SMTP Port [587]: " SMTP_PORT
    SMTP_PORT=${SMTP_PORT:-587}
    read -p "SMTP Username: " SMTP_USER
    read -s -p "SMTP Password: " SMTP_PASS
    echo ""
    read -p "From Email [noreply@${DOMAIN}]: " SMTP_FROM
    SMTP_FROM=${SMTP_FROM:-noreply@${DOMAIN}}
fi

echo ""
echo -e "${BLUE}=== Discord Integration (Optional) ===${NC}"
echo ""
read -p "Configure Discord bot? (y/N): " CONFIGURE_DISCORD

DISCORD_BOT_TOKEN=""
DISCORD_CLIENT_ID=""
DISCORD_CLIENT_SECRET=""

if [[ "$CONFIGURE_DISCORD" =~ ^[Yy]$ ]]; then
    read -p "Discord Bot Token: " DISCORD_BOT_TOKEN
    read -p "Discord Client ID: " DISCORD_CLIENT_ID
    read -s -p "Discord Client Secret: " DISCORD_CLIENT_SECRET
    echo ""
fi

echo ""
echo -e "${BLUE}=== Cloudflare Turnstile (Optional) ===${NC}"
echo ""
read -p "Configure Turnstile CAPTCHA? (y/N): " CONFIGURE_TURNSTILE

TURNSTILE_SECRET_KEY=""

if [[ "$CONFIGURE_TURNSTILE" =~ ^[Yy]$ ]]; then
    read -p "Turnstile Secret Key: " TURNSTILE_SECRET_KEY
fi

# ============================================
# Generate .env file
# ============================================

echo ""
echo -e "${BLUE}=== Generating Configuration ===${NC}"
echo ""

cat > "$ENV_FILE" << EOF
# GameTaverns Multi-Tenant Configuration
# Generated: $(date -Iseconds)

# ===================
# Core Settings
# ===================
DOMAIN=${DOMAIN}
SITE_NAME=${SITE_NAME}
SITE_URL=https://${DOMAIN}
CORS_ORIGINS=https://${DOMAIN},https://*.${DOMAIN}
ADMIN_EMAIL=${ADMIN_EMAIL}

# ===================
# Database
# ===================
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_PORT=5432

# ===================
# Security
# ===================
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=7d
PII_ENCRYPTION_KEY=${PII_ENCRYPTION_KEY}

# ===================
# SSL
# ===================
SSL_METHOD=${SSL_METHOD}
CLOUDFLARE_API_TOKEN=${CLOUDFLARE_API_TOKEN}

# ===================
# Email (SMTP)
# ===================
SMTP_HOST=${SMTP_HOST}
SMTP_PORT=${SMTP_PORT}
SMTP_USER=${SMTP_USER}
SMTP_PASS=${SMTP_PASS}
SMTP_FROM=${SMTP_FROM}

# ===================
# Discord (Optional)
# ===================
DISCORD_BOT_TOKEN=${DISCORD_BOT_TOKEN}
DISCORD_CLIENT_ID=${DISCORD_CLIENT_ID}
DISCORD_CLIENT_SECRET=${DISCORD_CLIENT_SECRET}

# ===================
# Turnstile (Optional)
# ===================
TURNSTILE_SECRET_KEY=${TURNSTILE_SECRET_KEY}

# ===================
# Platform Admins
# ===================
PLATFORM_ADMINS=${ADMIN_EMAIL}

# ===================
# Ports
# ===================
APP_PORT=80
API_PORT=3001
EOF

echo -e "${GREEN}✓ Configuration saved to ${ENV_FILE}${NC}"

# ============================================
# Create directories
# ============================================

mkdir -p nginx/ssl
mkdir -p backups

# ============================================
# SSL Setup
# ============================================

if [ "$SSL_METHOD" = "1" ]; then
    echo ""
    echo -e "${BLUE}=== Setting up Let's Encrypt ===${NC}"
    echo ""
    
    # Create initial self-signed cert for nginx to start
    if [ ! -f "nginx/ssl/fullchain.pem" ]; then
        echo "Creating temporary self-signed certificate..."
        openssl req -x509 -nodes -newkey rsa:4096 \
            -days 1 \
            -keyout nginx/ssl/privkey.pem \
            -out nginx/ssl/fullchain.pem \
            -subj "/CN=localhost"
    fi
    
    echo -e "${YELLOW}After starting the stack, run:${NC}"
    echo "  ./scripts/setup-ssl.sh"
    
elif [ "$SSL_METHOD" = "2" ]; then
    echo ""
    echo -e "${BLUE}=== Setting up Cloudflare SSL ===${NC}"
    echo ""
    
    # Create Cloudflare credentials file
    cat > nginx/ssl/cloudflare.ini << EOF
dns_cloudflare_api_token = ${CLOUDFLARE_API_TOKEN}
EOF
    chmod 600 nginx/ssl/cloudflare.ini
    
    echo -e "${YELLOW}After starting the stack, run:${NC}"
    echo "  ./scripts/setup-ssl-cloudflare.sh"
    
elif [ "$SSL_METHOD" = "3" ]; then
    echo ""
    echo -e "${YELLOW}Creating self-signed certificate (for testing only)${NC}"
    
    openssl req -x509 -nodes -newkey rsa:4096 \
        -days 365 \
        -keyout nginx/ssl/privkey.pem \
        -out nginx/ssl/fullchain.pem \
        -subj "/CN=${DOMAIN}"
    
    echo -e "${GREEN}✓ Self-signed certificate created${NC}"
fi

# ============================================
# Summary
# ============================================

echo ""
echo -e "${CYAN}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║                    Installation Complete                   ║${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}Configuration saved to: ${ENV_FILE}${NC}"
echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo ""
echo "  1. Start the stack:"
echo -e "     ${YELLOW}docker compose up -d${NC}"
echo ""
echo "  2. Wait for services to be healthy:"
echo -e "     ${YELLOW}docker compose ps${NC}"
echo ""
echo "  3. Create your first admin user:"
echo -e "     ${YELLOW}./scripts/create-admin.sh${NC}"
echo ""
echo "  4. Access your site:"
echo -e "     ${GREEN}https://${DOMAIN}${NC}"
echo ""

if [ "$SSL_METHOD" = "1" ] || [ "$SSL_METHOD" = "2" ]; then
    echo -e "${YELLOW}Don't forget to set up SSL:${NC}"
    if [ "$SSL_METHOD" = "1" ]; then
        echo -e "     ${YELLOW}./scripts/setup-ssl.sh${NC}"
    else
        echo -e "     ${YELLOW}./scripts/setup-ssl-cloudflare.sh${NC}"
    fi
    echo ""
fi

echo -e "${BLUE}Useful Commands:${NC}"
echo ""
echo "  View logs:        docker compose logs -f"
echo "  Stop services:    docker compose down"
echo "  Backup database:  ./scripts/backup.sh"
echo "  Restore backup:   ./scripts/restore.sh <backup-file>"
echo ""
echo -e "${GREEN}Happy gaming! 🎲${NC}"
