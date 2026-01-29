#!/bin/bash
#
# GameTaverns Native Installation Script
# For Ubuntu 24.04 LTS
#
# Usage: sudo ./install.sh
#
# This script installs and configures:
# - PostgreSQL 16
# - Node.js 22 LTS
# - PM2 process manager
# - Nginx reverse proxy
# - Postfix mail server
# - Dovecot (optional, for receiving mail)
#

set -e

# ═══════════════════════════════════════════════════════════════════
# Configuration
# ═══════════════════════════════════════════════════════════════════

INSTALL_DIR="/opt/gametaverns"
APP_USER="gametaverns"
DB_NAME="gametaverns"
DB_USER="gametaverns"
NODE_VERSION="22"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ═══════════════════════════════════════════════════════════════════
# Helper Functions
# ═══════════════════════════════════════════════════════════════════

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[OK]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "This script must be run as root (sudo)"
        exit 1
    fi
}

check_ubuntu() {
    if ! grep -q "Ubuntu 24" /etc/os-release 2>/dev/null; then
        log_warn "This script is designed for Ubuntu 24.04 LTS"
        read -p "Continue anyway? (y/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
}

generate_password() {
    openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 24
}

generate_secret() {
    openssl rand -base64 32
}

generate_hex_key() {
    openssl rand -hex 32
}

# ═══════════════════════════════════════════════════════════════════
# Installation Functions
# ═══════════════════════════════════════════════════════════════════

install_system_deps() {
    log_info "Updating system packages..."
    apt-get update
    apt-get upgrade -y

    log_info "Installing system dependencies..."
    apt-get install -y \
        curl \
        wget \
        git \
        build-essential \
        software-properties-common \
        gnupg \
        lsb-release \
        ca-certificates \
        ufw \
        fail2ban \
        unzip \
        htop

    log_success "System dependencies installed"
}

install_postgresql() {
    log_info "Installing PostgreSQL 16..."

    # Add PostgreSQL repository
    sh -c 'echo "deb https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
    wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | apt-key add -
    apt-get update

    apt-get install -y postgresql-16 postgresql-contrib-16

    # Start and enable PostgreSQL
    systemctl enable postgresql
    systemctl start postgresql

    log_success "PostgreSQL 16 installed"
}

configure_postgresql() {
    log_info "Configuring PostgreSQL..."

    # Generate password
    DB_PASSWORD=$(generate_password)

    # Create database and user
    sudo -u postgres psql <<EOF
-- Create user
CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';

-- Create database
CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};

-- Connect to database and set up extensions
\c ${DB_NAME}

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- Grant schema permissions
GRANT ALL ON SCHEMA public TO ${DB_USER};
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ${DB_USER};
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ${DB_USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ${DB_USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ${DB_USER};
EOF

    # Configure PostgreSQL for local connections
    PG_HBA="/etc/postgresql/16/main/pg_hba.conf"
    if ! grep -q "gametaverns" "$PG_HBA"; then
        echo "local   ${DB_NAME}   ${DB_USER}   scram-sha-256" >> "$PG_HBA"
    fi

    # Restart PostgreSQL
    systemctl restart postgresql

    log_success "PostgreSQL configured"
    echo "Database password: ${DB_PASSWORD}" >> /tmp/gametaverns-install.log
}

install_nodejs() {
    log_info "Installing Node.js ${NODE_VERSION}..."

    # Install Node.js via NodeSource
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
    apt-get install -y nodejs

    # Install PM2 globally
    npm install -g pm2

    # Enable PM2 startup
    pm2 startup systemd -u root --hp /root

    log_success "Node.js ${NODE_VERSION} and PM2 installed"
}

install_nginx() {
    log_info "Installing Nginx..."

    apt-get install -y nginx

    # Enable and start Nginx
    systemctl enable nginx
    systemctl start nginx

    log_success "Nginx installed"
}

install_postfix() {
    log_info "Installing Postfix mail server..."

    # Pre-configure Postfix for non-interactive install
    debconf-set-selections <<< "postfix postfix/mailname string $(hostname -f)"
    debconf-set-selections <<< "postfix postfix/main_mailer_type string 'Internet Site'"

    apt-get install -y postfix mailutils

    log_success "Postfix installed"
}

configure_postfix() {
    log_info "Configuring Postfix..."

    # Get domain from user or use hostname
    read -p "Enter your mail domain (e.g., gametaverns.com): " MAIL_DOMAIN
    MAIL_DOMAIN=${MAIL_DOMAIN:-$(hostname -d)}

    # Configure main.cf
    cat > /etc/postfix/main.cf <<EOF
# Postfix configuration for GameTaverns
smtpd_banner = \$myhostname ESMTP
biff = no

# TLS parameters
smtpd_use_tls = yes
smtpd_tls_cert_file = /etc/ssl/certs/ssl-cert-snakeoil.pem
smtpd_tls_key_file = /etc/ssl/private/ssl-cert-snakeoil.key
smtpd_tls_security_level = may
smtp_tls_security_level = may

# Network settings
myhostname = mail.${MAIL_DOMAIN}
mydomain = ${MAIL_DOMAIN}
myorigin = \$mydomain
mydestination = \$myhostname, \$mydomain, localhost.\$mydomain, localhost
mynetworks = 127.0.0.0/8 [::ffff:127.0.0.0]/104 [::1]/128

# Mailbox settings
home_mailbox = Maildir/
mailbox_size_limit = 0
recipient_delimiter = +

# Interface
inet_interfaces = all
inet_protocols = all

# Security
smtpd_helo_required = yes
smtpd_recipient_restrictions =
    permit_mynetworks,
    permit_sasl_authenticated,
    reject_unauth_destination

# Message size limit (25MB)
message_size_limit = 26214400
EOF

    # Restart Postfix
    systemctl restart postfix

    log_success "Postfix configured for ${MAIL_DOMAIN}"
}

create_app_user() {
    log_info "Creating application user..."

    if ! id "${APP_USER}" &>/dev/null; then
        useradd -r -m -d /opt/gametaverns -s /bin/bash ${APP_USER}
    fi

    log_success "Application user created"
}

setup_directories() {
    log_info "Setting up directories..."

    # Create directories
    mkdir -p ${INSTALL_DIR}/{app,server,uploads,backups,logs}
    mkdir -p ${INSTALL_DIR}/uploads/{library-logos,game-images}

    # Set permissions
    chown -R ${APP_USER}:${APP_USER} ${INSTALL_DIR}
    chmod -R 755 ${INSTALL_DIR}

    log_success "Directories created"
}

configure_nginx() {
    log_info "Configuring Nginx..."

    read -p "Enter your domain (e.g., gametaverns.com): " DOMAIN
    DOMAIN=${DOMAIN:-gametaverns.com}

    # Create Nginx configuration
    cat > /etc/nginx/sites-available/gametaverns <<EOF
# GameTaverns - Nginx Configuration
# Handles multi-tenant subdomain routing

# Rate limiting zone
limit_req_zone \$binary_remote_addr zone=api_limit:10m rate=10r/s;
limit_req_zone \$binary_remote_addr zone=login_limit:10m rate=5r/m;

# Upstream for API
upstream gametaverns_api {
    server 127.0.0.1:3001;
    keepalive 64;
}

# Main server block (handles all subdomains)
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN} *.${DOMAIN};

    # Logging
    access_log /var/log/nginx/gametaverns-access.log;
    error_log /var/log/nginx/gametaverns-error.log;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml application/json application/javascript application/xml+rss application/atom+xml image/svg+xml;

    # API routes
    location /api/ {
        limit_req zone=api_limit burst=20 nodelay;
        
        proxy_pass http://gametaverns_api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # Health check
    location /health {
        proxy_pass http://gametaverns_api/health;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
    }

    # Rate-limited login endpoint
    location /api/auth/login {
        limit_req zone=login_limit burst=3 nodelay;
        
        proxy_pass http://gametaverns_api;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # User uploads (logos, images)
    location /uploads/ {
        alias ${INSTALL_DIR}/uploads/;
        expires 30d;
        add_header Cache-Control "public, immutable";
        try_files \$uri =404;
    }

    # Static frontend files
    location / {
        root ${INSTALL_DIR}/app;
        index index.html;
        try_files \$uri \$uri/ /index.html;
        
        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
}
EOF

    # Enable site
    ln -sf /etc/nginx/sites-available/gametaverns /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default

    # Test and reload
    nginx -t
    systemctl reload nginx

    log_success "Nginx configured for ${DOMAIN}"
    echo "Domain: ${DOMAIN}" >> /tmp/gametaverns-install.log
}

clone_repository() {
    log_info "Cloning GameTaverns repository..."

    # Check if already cloned
    if [[ -d "${INSTALL_DIR}/.git" ]]; then
        log_info "Repository already exists, pulling latest..."
        cd ${INSTALL_DIR}
        git pull origin main
    else
        # Clone fresh
        git clone https://github.com/GameTaverns/GameTaverns.git ${INSTALL_DIR}
    fi

    chown -R ${APP_USER}:${APP_USER} ${INSTALL_DIR}

    log_success "Repository ready"
}

build_frontend() {
    log_info "Building frontend..."

    cd ${INSTALL_DIR}

    # Install frontend dependencies
    sudo -u ${APP_USER} npm ci

    # Build frontend with production settings
    sudo -u ${APP_USER} npm run build

    # Copy build to app directory
    cp -r dist/* ${INSTALL_DIR}/app/

    # Set permissions
    chown -R ${APP_USER}:${APP_USER} ${INSTALL_DIR}/app

    log_success "Frontend built"
}

build_backend() {
    log_info "Building backend..."

    cd ${INSTALL_DIR}/server

    # Install dependencies
    npm ci

    # Build TypeScript
    npm run build

    log_success "Backend built"
}

create_env_file() {
    log_info "Creating environment file..."

    # Read values from install log
    DB_PASSWORD=$(grep "Database password:" /tmp/gametaverns-install.log | cut -d: -f2 | tr -d ' ')
    DOMAIN=$(grep "Domain:" /tmp/gametaverns-install.log | cut -d: -f2 | tr -d ' ')
    
    JWT_SECRET=$(generate_secret)
    PII_KEY=$(generate_hex_key)

    cat > ${INSTALL_DIR}/.env <<EOF
# ============================================
# GameTaverns Configuration
# Generated by installer on $(date)
# ============================================

# Database
DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@localhost:5432/${DB_NAME}

# Security (auto-generated - keep these secure!)
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=7d
PII_ENCRYPTION_KEY=${PII_KEY}

# Server
PORT=3001
NODE_ENV=production
STANDALONE=true

# Site
SITE_URL=https://${DOMAIN}
SITE_NAME=GameTaverns
CORS_ORIGINS=https://${DOMAIN},https://*.${DOMAIN}

# Email (local Postfix - no auth needed for localhost)
SMTP_HOST=localhost
SMTP_PORT=25
SMTP_SECURE=false
SMTP_FROM=GameTaverns <noreply@${DOMAIN}>

# Uploads
UPLOAD_DIR=${INSTALL_DIR}/uploads

# Logging
LOG_LEVEL=info
LOG_DIR=${INSTALL_DIR}/logs

# Features (all enabled by default)
FEATURE_PLAY_LOGS=true
FEATURE_WISHLIST=true
FEATURE_FOR_SALE=true
FEATURE_MESSAGING=true
FEATURE_RATINGS=true
FEATURE_EVENTS=true
FEATURE_POLLS=true

# ============================================
# AI SERVICES (Required for game URL import)
# ============================================
# Get Perplexity key: https://www.perplexity.ai/settings/api
PERPLEXITY_API_KEY=

# Get Firecrawl key: https://firecrawl.dev/
FIRECRAWL_API_KEY=

# Alternative (if no Perplexity key):
# OPENAI_API_KEY=

# ============================================
# DISCORD INTEGRATION (Optional)
# ============================================
# DISCORD_BOT_TOKEN=
# DISCORD_CLIENT_ID=
# DISCORD_CLIENT_SECRET=

# ============================================
# SECURITY (Optional)
# ============================================
# Cloudflare Turnstile for bot protection
# TURNSTILE_SECRET_KEY=

# Platform admin emails (comma-separated)
PLATFORM_ADMINS=admin@${DOMAIN}
EOF

    chown ${APP_USER}:${APP_USER} ${INSTALL_DIR}/.env
    chmod 600 ${INSTALL_DIR}/.env

    log_success "Environment file created"
}

run_migrations() {
    log_info "Running database migrations..."

    cd ${INSTALL_DIR}

    # Run the schema migration as postgres user (has permissions)
    sudo -u postgres psql -d ${DB_NAME} -f ${INSTALL_DIR}/deploy/native/migrations/01-schema.sql

    # Grant permissions to app user for all new objects
    sudo -u postgres psql -d ${DB_NAME} <<EOF
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ${DB_USER};
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ${DB_USER};
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO ${DB_USER};
EOF

    log_success "Database migrations complete"
}

setup_pm2() {
    log_info "Setting up PM2 process manager..."

    # Create PM2 ecosystem file
    cat > ${INSTALL_DIR}/ecosystem.config.js <<EOF
module.exports = {
  apps: [{
    name: 'gametaverns-api',
    cwd: '${INSTALL_DIR}/server',
    script: 'dist/index.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    env_file: '${INSTALL_DIR}/.env',
    error_file: '${INSTALL_DIR}/logs/api-error.log',
    out_file: '${INSTALL_DIR}/logs/api-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    max_memory_restart: '500M',
    watch: false,
    autorestart: true,
    max_restarts: 10,
    restart_delay: 4000
  }]
};
EOF

    chown ${APP_USER}:${APP_USER} ${INSTALL_DIR}/ecosystem.config.js

    # Start with PM2
    cd ${INSTALL_DIR}
    sudo -u ${APP_USER} pm2 start ecosystem.config.js
    pm2 save

    log_success "PM2 configured and started"
}

configure_firewall() {
    log_info "Configuring firewall..."

    # Enable UFW
    ufw --force enable

    # Allow SSH
    ufw allow 22/tcp

    # Allow HTTP/HTTPS
    ufw allow 80/tcp
    ufw allow 443/tcp

    # Allow SMTP (for email)
    ufw allow 25/tcp

    # Reload
    ufw reload

    log_success "Firewall configured"
}

setup_fail2ban() {
    log_info "Configuring fail2ban..."

    # Create jail for SSH
    cat > /etc/fail2ban/jail.local <<EOF
[sshd]
enabled = true
port = 22
filter = sshd
logpath = /var/log/auth.log
maxretry = 5
bantime = 3600

[nginx-http-auth]
enabled = true
port = http,https
filter = nginx-http-auth
logpath = /var/log/nginx/gametaverns-error.log
maxretry = 5
bantime = 3600
EOF

    systemctl restart fail2ban

    log_success "fail2ban configured"
}

cleanup() {
    log_info "Cleaning up..."

    rm -f /tmp/gametaverns-install.log
    apt-get autoremove -y
    apt-get clean

    log_success "Cleanup complete"
}

print_summary() {
    echo ""
    echo "═══════════════════════════════════════════════════════════════════"
    echo -e "${GREEN}GameTaverns Installation Complete!${NC}"
    echo "═══════════════════════════════════════════════════════════════════"
    echo ""
    echo "Installation directory: ${INSTALL_DIR}"
    echo ""
    echo "Next steps:"
    echo "  1. Edit ${INSTALL_DIR}/.env and add your API keys"
    echo "  2. Configure Cloudflare DNS to point to this server"
    echo "  3. Create the first admin user:"
    echo "     ${INSTALL_DIR}/deploy/native/scripts/create-admin.sh"
    echo ""
    echo "Useful commands:"
    echo "  View API logs:      pm2 logs gametaverns-api"
    echo "  Restart API:        pm2 restart gametaverns-api"
    echo "  Nginx status:       systemctl status nginx"
    echo "  Database backup:    ${INSTALL_DIR}/deploy/native/scripts/backup.sh"
    echo ""
    echo "Documentation: https://docs.gametaverns.com"
    echo "═══════════════════════════════════════════════════════════════════"
}

# ═══════════════════════════════════════════════════════════════════
# Main Installation Flow
# ═══════════════════════════════════════════════════════════════════

main() {
    echo ""
    echo "╔═══════════════════════════════════════════════════════════════════╗"
    echo "║         GameTaverns Native Installation                          ║"
    echo "║         Ubuntu 24.04 LTS                                         ║"
    echo "╚═══════════════════════════════════════════════════════════════════╝"
    echo ""

    check_root
    check_ubuntu

    log_info "Starting installation..."
    echo "" > /tmp/gametaverns-install.log

    # System setup
    install_system_deps
    create_app_user
    setup_directories

    # Database
    install_postgresql
    configure_postgresql

    # Runtime
    install_nodejs
    install_nginx
    install_postfix
    configure_postfix

    # Application - clone FIRST, then build
    clone_repository
    create_env_file
    run_migrations
    build_frontend
    build_backend

    # Configuration
    configure_nginx
    setup_pm2

    # Security
    configure_firewall
    setup_fail2ban

    # Cleanup
    cleanup

    # Done
    print_summary
}

# Run main function
main "$@"
