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
# - Postfix + Dovecot mail server (send & receive)
# - Roundcube webmail interface
#

set -eE  # Exit on error, inherit ERR trap

# ═══════════════════════════════════════════════════════════════════
# Configuration
# ═══════════════════════════════════════════════════════════════════

INSTALL_DIR="/opt/gametaverns"
APP_USER="gametaverns"
DB_NAME="gametaverns"
DB_USER="gametaverns"
NODE_VERSION="22"
LOG_FILE="/var/log/gametaverns-install.log"
CREDENTIALS_FILE="/root/gametaverns-credentials.txt"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# ═══════════════════════════════════════════════════════════════════
# Error Handling & Logging
# ═══════════════════════════════════════════════════════════════════

# Initialize log file
init_logging() {
    mkdir -p "$(dirname "$LOG_FILE")"
    echo "════════════════════════════════════════════════════════════════" > "$LOG_FILE"
    echo "GameTaverns Installation Log - $(date)" >> "$LOG_FILE"
    echo "════════════════════════════════════════════════════════════════" >> "$LOG_FILE"
    echo "" >> "$LOG_FILE"
}

# Log to both console and file
log() {
    local level="$1"
    local message="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    # Log to file with full details
    echo "[$timestamp] [$level] $message" >> "$LOG_FILE"
    
    # Log to console with colors
    case "$level" in
        INFO)
            echo -e "${BLUE}[INFO]${NC} $message"
            ;;
        OK)
            echo -e "${GREEN}[OK]${NC} $message"
            ;;
        WARN)
            echo -e "${YELLOW}[WARN]${NC} $message"
            ;;
        ERROR)
            echo -e "${RED}[ERROR]${NC} $message"
            ;;
        DEBUG)
            echo -e "${CYAN}[DEBUG]${NC} $message"
            ;;
        STEP)
            echo -e "${BOLD}${BLUE}══► $message${NC}"
            echo "" >> "$LOG_FILE"
            echo "══► $message" >> "$LOG_FILE"
            ;;
    esac
}

log_info() { log "INFO" "$1"; }
log_success() { log "OK" "$1"; }
log_warn() { log "WARN" "$1"; }
log_error() { log "ERROR" "$1"; }
log_debug() { log "DEBUG" "$1"; }
log_step() { log "STEP" "$1"; }

# Capture command output and log it
run_cmd() {
    local cmd="$*"
    log_debug "Running: $cmd"
    
    # Create temp files for stdout and stderr
    local stdout_file=$(mktemp)
    local stderr_file=$(mktemp)
    
    if eval "$cmd" > "$stdout_file" 2> "$stderr_file"; then
        local stdout=$(cat "$stdout_file")
        local stderr=$(cat "$stderr_file")
        
        if [[ -n "$stdout" ]]; then
            echo "$stdout" >> "$LOG_FILE"
        fi
        if [[ -n "$stderr" ]]; then
            echo "[STDERR] $stderr" >> "$LOG_FILE"
        fi
        
        rm -f "$stdout_file" "$stderr_file"
        return 0
    else
        local exit_code=$?
        local stdout=$(cat "$stdout_file")
        local stderr=$(cat "$stderr_file")
        
        log_error "Command failed with exit code $exit_code: $cmd"
        if [[ -n "$stdout" ]]; then
            log_error "STDOUT: $stdout"
        fi
        if [[ -n "$stderr" ]]; then
            log_error "STDERR: $stderr"
        fi
        
        rm -f "$stdout_file" "$stderr_file"
        return $exit_code
    fi
}

# Error trap handler
error_handler() {
    local line_no=$1
    local error_code=$2
    local last_command="${BASH_COMMAND}"
    
    echo "" >> "$LOG_FILE"
    echo "════════════════════════════════════════════════════════════════" >> "$LOG_FILE"
    echo "FATAL ERROR OCCURRED" >> "$LOG_FILE"
    echo "════════════════════════════════════════════════════════════════" >> "$LOG_FILE"
    echo "Line: $line_no" >> "$LOG_FILE"
    echo "Exit Code: $error_code" >> "$LOG_FILE"
    echo "Command: $last_command" >> "$LOG_FILE"
    echo "Time: $(date)" >> "$LOG_FILE"
    echo "" >> "$LOG_FILE"
    
    echo ""
    echo -e "${RED}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║  INSTALLATION FAILED                                           ║${NC}"
    echo -e "${RED}╚════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${RED}Error on line $line_no: $last_command${NC}"
    echo -e "${RED}Exit code: $error_code${NC}"
    echo ""
    echo -e "${YELLOW}Full log available at: ${LOG_FILE}${NC}"
    echo -e "${YELLOW}Last 20 lines of log:${NC}"
    echo ""
    tail -20 "$LOG_FILE"
    echo ""
    
    exit $error_code
}

# Set trap for errors
trap 'error_handler ${LINENO} $?' ERR

# ═══════════════════════════════════════════════════════════════════
# Helper Functions
# ═══════════════════════════════════════════════════════════════════

check_root() {
    log_info "Checking root privileges..."
    if [[ $EUID -ne 0 ]]; then
        log_error "This script must be run as root (sudo)"
        exit 1
    fi
    log_success "Running as root"
}

check_ubuntu() {
    log_info "Checking Ubuntu version..."
    if ! grep -q "Ubuntu 24" /etc/os-release 2>/dev/null; then
        log_warn "This script is designed for Ubuntu 24.04 LTS"
        log_warn "Detected: $(cat /etc/os-release | grep PRETTY_NAME | cut -d'"' -f2)"
        read -p "Continue anyway? (y/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_error "Installation cancelled by user"
            exit 1
        fi
    else
        log_success "Ubuntu 24.04 LTS detected"
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

save_credential() {
    local name="$1"
    local value="$2"
    echo "$name=$value" >> "$CREDENTIALS_FILE"
    log_debug "Saved credential: $name"
}

# ═══════════════════════════════════════════════════════════════════
# Installation Functions
# ═══════════════════════════════════════════════════════════════════

install_system_deps() {
    log_step "Installing System Dependencies"
    
    log_info "Updating package lists..."
    run_cmd "apt-get update"
    
    log_info "Upgrading existing packages..."
    run_cmd "DEBIAN_FRONTEND=noninteractive apt-get upgrade -y"

    log_info "Installing core dependencies..."
    run_cmd "DEBIAN_FRONTEND=noninteractive apt-get install -y \
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
        htop \
        openssl \
        certbot \
        python3-certbot-nginx"

    log_success "System dependencies installed"
}

install_cockpit() {
    log_step "Installing Cockpit Web Console (Server Management GUI)"
    
    log_info "Installing Cockpit and modules..."
    run_cmd "DEBIAN_FRONTEND=noninteractive apt-get install -y \
        cockpit \
        cockpit-storaged \
        cockpit-networkmanager \
        cockpit-packagekit \
        cockpit-pcp"
    
    log_info "Enabling Cockpit service..."
    run_cmd "systemctl enable --now cockpit.socket"
    
    # Configure Cockpit to allow root login (needed for PM2/service management)
    log_info "Configuring Cockpit settings..."
    mkdir -p /etc/cockpit
    cat > /etc/cockpit/cockpit.conf <<EOF
[WebService]
Origins = https://${DOMAIN:-localhost}:9090 wss://${DOMAIN:-localhost}:9090
ProtocolHeader = X-Forwarded-Proto
AllowUnencrypted = false

[Session]
IdleTimeout = 60
EOF

    # Open Cockpit port in UFW if active
    if ufw status | grep -q "active"; then
        log_info "Opening Cockpit port (9090) in firewall..."
        run_cmd "ufw allow 9090/tcp"
    fi
    
    log_success "Cockpit installed - Access at https://your-server:9090"
}

install_postgresql() {
    log_step "Installing PostgreSQL 16"

    log_info "Adding PostgreSQL repository..."
    if [[ ! -f /etc/apt/sources.list.d/pgdg.list ]]; then
        run_cmd "sh -c 'echo \"deb https://apt.postgresql.org/pub/repos/apt \$(lsb_release -cs)-pgdg main\" > /etc/apt/sources.list.d/pgdg.list'"
        run_cmd "wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | apt-key add -"
        run_cmd "apt-get update"
    else
        log_info "PostgreSQL repository already configured"
    fi

    log_info "Installing PostgreSQL 16..."
    run_cmd "DEBIAN_FRONTEND=noninteractive apt-get install -y postgresql-16 postgresql-contrib-16"

    log_info "Starting PostgreSQL service..."
    run_cmd "systemctl enable postgresql"
    run_cmd "systemctl start postgresql"

    # Verify PostgreSQL is running
    if systemctl is-active --quiet postgresql; then
        log_success "PostgreSQL 16 installed and running"
    else
        log_error "PostgreSQL failed to start"
        run_cmd "systemctl status postgresql"
        exit 1
    fi
}

configure_postgresql() {
    log_step "Configuring PostgreSQL Database"

    # Generate password
    DB_PASSWORD=$(generate_password)
    save_credential "DB_PASSWORD" "$DB_PASSWORD"

    log_info "Creating database user '${DB_USER}'..."
    
    # Check if user already exists
    if sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | grep -q 1; then
        log_info "User ${DB_USER} already exists, updating password..."
        sudo -u postgres psql -c "ALTER USER ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';" >> "$LOG_FILE" 2>&1
    else
        sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';" >> "$LOG_FILE" 2>&1
    fi

    log_info "Creating database '${DB_NAME}'..."
    
    # Check if database already exists
    if sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1; then
        log_info "Database ${DB_NAME} already exists"
    else
        sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};" >> "$LOG_FILE" 2>&1
    fi

    log_info "Configuring database extensions and permissions..."
    sudo -u postgres psql -d ${DB_NAME} <<EOF >> "$LOG_FILE" 2>&1
-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "unaccent";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};
GRANT ALL ON SCHEMA public TO ${DB_USER};
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ${DB_USER};
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ${DB_USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ${DB_USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ${DB_USER};
EOF

    # Configure pg_hba.conf for local connections
    PG_HBA="/etc/postgresql/16/main/pg_hba.conf"
    if ! grep -q "gametaverns" "$PG_HBA"; then
        log_info "Configuring PostgreSQL authentication..."
        echo "local   ${DB_NAME}   ${DB_USER}   scram-sha-256" >> "$PG_HBA"
        run_cmd "systemctl restart postgresql"
    fi

    # Verify connection
    log_info "Verifying database connection..."
    if PGPASSWORD="${DB_PASSWORD}" psql -h localhost -U ${DB_USER} -d ${DB_NAME} -c "SELECT 1;" > /dev/null 2>&1; then
        log_success "PostgreSQL configured and connection verified"
    else
        log_error "Failed to connect to database"
        exit 1
    fi
}

install_nodejs() {
    log_step "Installing Node.js ${NODE_VERSION}"

    log_info "Adding NodeSource repository..."
    if [[ ! -f /etc/apt/sources.list.d/nodesource.list ]]; then
        run_cmd "curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -"
    else
        log_info "NodeSource repository already configured"
    fi

    log_info "Installing Node.js..."
    run_cmd "DEBIAN_FRONTEND=noninteractive apt-get install -y nodejs"

    # Verify Node.js
    NODE_VER=$(node --version 2>/dev/null || echo "not installed")
    log_info "Node.js version: $NODE_VER"

    log_info "Installing PM2 globally..."
    run_cmd "npm install -g pm2"

    log_info "Configuring PM2 startup..."
    run_cmd "pm2 startup systemd -u root --hp /root"

    log_success "Node.js ${NODE_VERSION} and PM2 installed"
}

install_nginx() {
    log_step "Installing Nginx"

    log_info "Installing Nginx..."
    run_cmd "DEBIAN_FRONTEND=noninteractive apt-get install -y nginx"

    log_info "Starting Nginx service..."
    run_cmd "systemctl enable nginx"
    run_cmd "systemctl start nginx"

    if systemctl is-active --quiet nginx; then
        log_success "Nginx installed and running"
    else
        log_error "Nginx failed to start"
        exit 1
    fi
}

install_mail_server() {
    log_step "Installing Mail Server (Postfix + Dovecot)"

    # Get mail domain
    echo ""
    read -p "Enter your mail domain (e.g., gametaverns.com): " MAIL_DOMAIN
    MAIL_DOMAIN=${MAIL_DOMAIN:-gametaverns.com}
    save_credential "MAIL_DOMAIN" "$MAIL_DOMAIN"

    log_info "Installing Postfix (MTA)..."
    
    # Pre-configure Postfix
    debconf-set-selections <<< "postfix postfix/mailname string mail.${MAIL_DOMAIN}"
    debconf-set-selections <<< "postfix postfix/main_mailer_type string 'Internet Site'"
    
    run_cmd "DEBIAN_FRONTEND=noninteractive apt-get install -y postfix postfix-policyd-spf-python"

    log_info "Installing Dovecot (IMAP/POP3)..."
    run_cmd "DEBIAN_FRONTEND=noninteractive apt-get install -y dovecot-core dovecot-imapd dovecot-pop3d dovecot-lmtpd"

    log_success "Mail server packages installed"
}

configure_postfix() {
    log_step "Configuring Postfix (Outgoing Mail)"

    log_info "Creating Postfix main.cf..."
    cat > /etc/postfix/main.cf <<EOF
# ════════════════════════════════════════════════════════════════
# GameTaverns Postfix Configuration
# Generated: $(date)
# ════════════════════════════════════════════════════════════════

# Basic settings
smtpd_banner = \$myhostname ESMTP
biff = no
append_dot_mydomain = no
readme_directory = no
compatibility_level = 3.6

# TLS parameters (outgoing)
smtp_tls_security_level = may
smtp_tls_CApath = /etc/ssl/certs
smtp_tls_session_cache_database = btree:\${data_directory}/smtp_scache

# TLS parameters (incoming)
smtpd_tls_cert_file = /etc/ssl/certs/ssl-cert-snakeoil.pem
smtpd_tls_key_file = /etc/ssl/private/ssl-cert-snakeoil.key
smtpd_tls_security_level = may
smtpd_tls_session_cache_database = btree:\${data_directory}/smtpd_scache

# Network settings
myhostname = mail.${MAIL_DOMAIN}
mydomain = ${MAIL_DOMAIN}
myorigin = \$mydomain
mydestination = \$myhostname, \$mydomain, localhost.\$mydomain, localhost
mynetworks = 127.0.0.0/8 [::ffff:127.0.0.0]/104 [::1]/128

# Virtual mailbox settings
virtual_mailbox_domains = ${MAIL_DOMAIN}
virtual_mailbox_base = /var/mail/vhosts
virtual_mailbox_maps = hash:/etc/postfix/vmailbox
virtual_alias_maps = hash:/etc/postfix/virtual
virtual_minimum_uid = 100
virtual_uid_maps = static:5000
virtual_gid_maps = static:5000
virtual_transport = lmtp:unix:private/dovecot-lmtp

# Mailbox settings
mailbox_size_limit = 0
recipient_delimiter = +
inet_interfaces = all
inet_protocols = all

# Security restrictions
smtpd_helo_required = yes
smtpd_delay_reject = yes

smtpd_recipient_restrictions =
    permit_mynetworks,
    permit_sasl_authenticated,
    reject_unauth_destination,
    reject_invalid_hostname,
    reject_non_fqdn_hostname,
    reject_non_fqdn_sender,
    reject_non_fqdn_recipient,
    reject_unknown_sender_domain,
    reject_unknown_recipient_domain,
    reject_rbl_client zen.spamhaus.org

smtpd_sender_restrictions =
    permit_mynetworks,
    permit_sasl_authenticated,
    reject_unknown_sender_domain

# SASL authentication (for sending mail)
smtpd_sasl_type = dovecot
smtpd_sasl_path = private/auth
smtpd_sasl_auth_enable = yes
smtpd_sasl_security_options = noanonymous
smtpd_sasl_local_domain = \$myhostname

# Message limits
message_size_limit = 52428800
mailbox_size_limit = 0

# Queue settings
maximal_queue_lifetime = 5d
bounce_queue_lifetime = 5d
EOF

    log_info "Creating virtual mailbox directory..."
    mkdir -p /var/mail/vhosts/${MAIL_DOMAIN}
    
    # Create vmail user if not exists
    if ! id "vmail" &>/dev/null; then
        groupadd -g 5000 vmail
        useradd -g vmail -u 5000 vmail -d /var/mail -m
    fi
    
    chown -R vmail:vmail /var/mail/vhosts

    log_info "Creating virtual mailbox maps..."
    cat > /etc/postfix/vmailbox <<EOF
# Virtual mailboxes for ${MAIL_DOMAIN}
admin@${MAIL_DOMAIN}     ${MAIL_DOMAIN}/admin/
legal@${MAIL_DOMAIN}     ${MAIL_DOMAIN}/legal/
noreply@${MAIL_DOMAIN}   ${MAIL_DOMAIN}/noreply/
support@${MAIL_DOMAIN}   ${MAIL_DOMAIN}/support/
EOF

    log_info "Creating virtual alias maps..."
    cat > /etc/postfix/virtual <<EOF
# Aliases for ${MAIL_DOMAIN}
postmaster@${MAIL_DOMAIN}    admin@${MAIL_DOMAIN}
abuse@${MAIL_DOMAIN}         admin@${MAIL_DOMAIN}
webmaster@${MAIL_DOMAIN}     admin@${MAIL_DOMAIN}
hostmaster@${MAIL_DOMAIN}    admin@${MAIL_DOMAIN}
EOF

    run_cmd "postmap /etc/postfix/vmailbox"
    run_cmd "postmap /etc/postfix/virtual"

    log_success "Postfix configured"
}

configure_dovecot() {
    log_step "Configuring Dovecot (Incoming Mail)"

    log_info "Creating Dovecot configuration..."
    
    # Main dovecot config
    cat > /etc/dovecot/dovecot.conf <<EOF
# ════════════════════════════════════════════════════════════════
# GameTaverns Dovecot Configuration
# Generated: $(date)
# ════════════════════════════════════════════════════════════════

protocols = imap pop3 lmtp
listen = *, ::

# Logging
log_path = /var/log/dovecot.log
info_log_path = /var/log/dovecot-info.log
debug_log_path = /var/log/dovecot-debug.log

# Mail location
mail_location = maildir:/var/mail/vhosts/%d/%n

# SSL/TLS
ssl = yes
ssl_cert = </etc/ssl/certs/ssl-cert-snakeoil.pem
ssl_key = </etc/ssl/private/ssl-cert-snakeoil.key
ssl_min_protocol = TLSv1.2

# Authentication
auth_mechanisms = plain login
disable_plaintext_auth = no

# User database
passdb {
    driver = passwd-file
    args = scheme=SHA512-CRYPT username_format=%u /etc/dovecot/users
}

userdb {
    driver = static
    args = uid=vmail gid=vmail home=/var/mail/vhosts/%d/%n
}

# LMTP for Postfix delivery
service lmtp {
    unix_listener /var/spool/postfix/private/dovecot-lmtp {
        mode = 0600
        user = postfix
        group = postfix
    }
}

# Auth service for Postfix SASL
service auth {
    unix_listener /var/spool/postfix/private/auth {
        mode = 0660
        user = postfix
        group = postfix
    }
    unix_listener auth-userdb {
        mode = 0600
        user = vmail
    }
}

# Namespace
namespace inbox {
    inbox = yes
    separator = /
    
    mailbox Drafts {
        auto = subscribe
        special_use = \\Drafts
    }
    mailbox Sent {
        auto = subscribe
        special_use = \\Sent
    }
    mailbox Trash {
        auto = subscribe
        special_use = \\Trash
    }
    mailbox Junk {
        auto = subscribe
        special_use = \\Junk
    }
}

# Protocol settings
protocol imap {
    mail_max_userip_connections = 20
}

protocol pop3 {
    mail_max_userip_connections = 10
}
EOF

    log_info "Creating mail user accounts..."
    
    # Generate passwords for mail accounts
    ADMIN_MAIL_PASS=$(generate_password)
    LEGAL_MAIL_PASS=$(generate_password)
    SUPPORT_MAIL_PASS=$(generate_password)
    NOREPLY_MAIL_PASS=$(generate_password)
    
    save_credential "MAIL_ADMIN_PASSWORD" "$ADMIN_MAIL_PASS"
    save_credential "MAIL_LEGAL_PASSWORD" "$LEGAL_MAIL_PASS"
    save_credential "MAIL_SUPPORT_PASSWORD" "$SUPPORT_MAIL_PASS"
    save_credential "MAIL_NOREPLY_PASSWORD" "$NOREPLY_MAIL_PASS"

    # Create password file with SHA512-CRYPT hashes
    cat > /etc/dovecot/users <<EOF
admin@${MAIL_DOMAIN}:$(doveadm pw -s SHA512-CRYPT -p "${ADMIN_MAIL_PASS}")
legal@${MAIL_DOMAIN}:$(doveadm pw -s SHA512-CRYPT -p "${LEGAL_MAIL_PASS}")
support@${MAIL_DOMAIN}:$(doveadm pw -s SHA512-CRYPT -p "${SUPPORT_MAIL_PASS}")
noreply@${MAIL_DOMAIN}:$(doveadm pw -s SHA512-CRYPT -p "${NOREPLY_MAIL_PASS}")
EOF

    chmod 600 /etc/dovecot/users

    # Create mailbox directories
    for user in admin legal support noreply; do
        mkdir -p /var/mail/vhosts/${MAIL_DOMAIN}/${user}/{cur,new,tmp}
        chown -R vmail:vmail /var/mail/vhosts/${MAIL_DOMAIN}/${user}
    done

    log_info "Restarting mail services..."
    run_cmd "systemctl restart postfix"
    run_cmd "systemctl restart dovecot"
    run_cmd "systemctl enable postfix"
    run_cmd "systemctl enable dovecot"

    if systemctl is-active --quiet postfix && systemctl is-active --quiet dovecot; then
        log_success "Dovecot configured and mail services running"
    else
        log_error "Mail services failed to start"
        log_error "Postfix status: $(systemctl is-active postfix)"
        log_error "Dovecot status: $(systemctl is-active dovecot)"
        exit 1
    fi
}

install_roundcube() {
    log_step "Installing Roundcube Webmail"

    log_info "Installing Roundcube dependencies..."
    run_cmd "DEBIAN_FRONTEND=noninteractive apt-get install -y \
        roundcube \
        roundcube-plugins \
        roundcube-plugins-extra \
        php-fpm \
        php-mysql \
        php-xml \
        php-mbstring \
        php-intl \
        php-zip \
        php-gd \
        php-curl \
        php-imagick"

    log_info "Configuring Roundcube..."
    
    # Get PHP version
    PHP_VERSION=$(php -v | head -n1 | cut -d' ' -f2 | cut -d'.' -f1,2)
    log_debug "PHP version detected: $PHP_VERSION"

    # Generate Roundcube des_key
    ROUNDCUBE_KEY=$(generate_password)
    save_credential "ROUNDCUBE_DES_KEY" "$ROUNDCUBE_KEY"

    # Configure Roundcube
    cat > /etc/roundcube/config.inc.php <<EOF
<?php
/**
 * GameTaverns Roundcube Configuration
 * Generated: $(date)
 */

\$config = [];

// Database connection
\$config['db_dsnw'] = 'sqlite:////var/lib/roundcube/roundcube.db?mode=0640';

// IMAP settings
\$config['imap_host'] = 'localhost:143';
\$config['imap_auth_type'] = 'PLAIN';
\$config['imap_conn_options'] = [
    'ssl' => [
        'verify_peer' => false,
        'verify_peer_name' => false,
    ],
];

// SMTP settings
\$config['smtp_host'] = 'localhost:25';
\$config['smtp_auth_type'] = 'PLAIN';
\$config['smtp_user'] = '%u';
\$config['smtp_pass'] = '%p';
\$config['smtp_conn_options'] = [
    'ssl' => [
        'verify_peer' => false,
        'verify_peer_name' => false,
    ],
];

// Security
\$config['des_key'] = '${ROUNDCUBE_KEY}';
\$config['enable_installer'] = false;
\$config['ip_check'] = true;
\$config['session_lifetime'] = 30;
\$config['password_charset'] = 'UTF-8';

// User interface
\$config['product_name'] = 'GameTaverns Mail';
\$config['support_url'] = 'https://${MAIL_DOMAIN}/support';
\$config['skin'] = 'elastic';
\$config['language'] = 'en_US';
\$config['timezone'] = 'auto';
\$config['date_format'] = 'Y-m-d';
\$config['time_format'] = 'H:i';

// Logging
\$config['log_driver'] = 'file';
\$config['log_dir'] = '/var/log/roundcube/';

// Plugins
\$config['plugins'] = [
    'archive',
    'zipdownload',
    'newmail_notifier',
    'managesieve',
    'emoticons',
];

// Addressbook
\$config['address_book_type'] = 'sql';
\$config['autocomplete_addressbooks'] = ['sql'];

// Compose settings
\$config['default_charset'] = 'UTF-8';
\$config['htmleditor'] = 0;
\$config['mime_param_folding'] = 0;

// Display settings  
\$config['list_cols'] = ['subject', 'from', 'date', 'size'];
\$config['default_list_mode'] = 'list';
\$config['mail_pagesize'] = 50;
\$config['preview_pane'] = true;
EOF

    # Create log directory
    mkdir -p /var/log/roundcube
    chown www-data:www-data /var/log/roundcube

    # Ensure SQLite database directory exists
    mkdir -p /var/lib/roundcube
    chown www-data:www-data /var/lib/roundcube

    log_success "Roundcube installed"
}

configure_nginx_roundcube() {
    log_step "Configuring Nginx for Roundcube"

    PHP_VERSION=$(php -v | head -n1 | cut -d' ' -f2 | cut -d'.' -f1,2)

    log_info "Creating Roundcube Nginx config..."
    cat > /etc/nginx/sites-available/roundcube <<EOF
# Roundcube Webmail
server {
    listen 80;
    server_name mail.${MAIL_DOMAIN};

    root /var/lib/roundcube/public_html;
    index index.php;

    # Logging
    access_log /var/log/nginx/roundcube-access.log;
    error_log /var/log/nginx/roundcube-error.log;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    location / {
        try_files \$uri \$uri/ /index.php?\$query_string;
    }

    location ~ \.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/var/run/php/php${PHP_VERSION}-fpm.sock;
        fastcgi_param SCRIPT_FILENAME \$document_root\$fastcgi_script_name;
        include fastcgi_params;
    }

    # Deny access to sensitive files
    location ~ /\. {
        deny all;
    }
    
    location ~ ^/(README|INSTALL|LICENSE|CHANGELOG|UPGRADING)$ {
        deny all;
    }
    
    location ~ ^/(bin|SQL|config|temp|logs)/ {
        deny all;
    }
}
EOF

    ln -sf /etc/nginx/sites-available/roundcube /etc/nginx/sites-enabled/

    log_info "Restarting PHP-FPM and Nginx..."
    run_cmd "systemctl restart php${PHP_VERSION}-fpm"
    run_cmd "nginx -t"
    run_cmd "systemctl reload nginx"

    log_success "Roundcube Nginx configured"
}

create_app_user() {
    log_step "Creating Application User"

    if ! id "${APP_USER}" &>/dev/null; then
        log_info "Creating user '${APP_USER}'..."
        useradd -r -m -d /opt/gametaverns -s /bin/bash ${APP_USER}
        log_success "Application user created"
    else
        log_info "User '${APP_USER}' already exists"
    fi
}

setup_directories() {
    log_step "Setting Up Directories"

    log_info "Creating directory structure..."
    mkdir -p ${INSTALL_DIR}/{app,server,uploads,backups,logs}
    mkdir -p ${INSTALL_DIR}/uploads/{library-logos,game-images}

    log_info "Setting permissions..."
    chown -R ${APP_USER}:${APP_USER} ${INSTALL_DIR}
    chmod -R 755 ${INSTALL_DIR}

    log_success "Directories created at ${INSTALL_DIR}"
}

clone_repository() {
    log_step "Cloning GameTaverns Repository"

    if [[ -d "${INSTALL_DIR}/.git" ]]; then
        log_info "Repository already exists, pulling latest..."
        cd ${INSTALL_DIR}
        run_cmd "git fetch origin"
        run_cmd "git reset --hard origin/main"
    else
        log_info "Cloning fresh repository..."
        # Clone to temp first, then move contents
        if [[ -d "/tmp/gametaverns-clone" ]]; then
            rm -rf /tmp/gametaverns-clone
        fi
        run_cmd "git clone https://github.com/GameTaverns/GameTaverns.git /tmp/gametaverns-clone"
        
        # Move contents to install dir
        cp -r /tmp/gametaverns-clone/. ${INSTALL_DIR}/
        rm -rf /tmp/gametaverns-clone
    fi

    chown -R ${APP_USER}:${APP_USER} ${INSTALL_DIR}

    log_success "Repository ready at ${INSTALL_DIR}"
}

configure_nginx() {
    log_step "Configuring Nginx for GameTaverns"

    echo ""
    read -p "Enter your primary domain (e.g., gametaverns.com): " DOMAIN
    DOMAIN=${DOMAIN:-gametaverns.com}
    save_credential "DOMAIN" "$DOMAIN"

    log_info "Creating Nginx configuration..."
    cat > /etc/nginx/sites-available/gametaverns <<EOF
# ════════════════════════════════════════════════════════════════
# GameTaverns - Nginx Configuration
# Handles multi-tenant subdomain routing
# Generated: $(date)
# ════════════════════════════════════════════════════════════════

# Rate limiting zones
limit_req_zone \$binary_remote_addr zone=api_limit:10m rate=10r/s;
limit_req_zone \$binary_remote_addr zone=login_limit:10m rate=5r/m;
limit_req_zone \$binary_remote_addr zone=general:10m rate=30r/s;

# Connection limiting
limit_conn_zone \$binary_remote_addr zone=conn_limit:10m;

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

    # Connection limits
    limit_conn conn_limit 20;

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
        
        # Buffer settings
        proxy_buffer_size 128k;
        proxy_buffers 4 256k;
        proxy_busy_buffers_size 256k;
    }

    # Rate-limited auth endpoints
    location /api/auth/login {
        limit_req zone=login_limit burst=3 nodelay;
        
        proxy_pass http://gametaverns_api;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /api/auth/signup {
        limit_req zone=login_limit burst=3 nodelay;
        
        proxy_pass http://gametaverns_api;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Health check
    location /health {
        proxy_pass http://gametaverns_api/health;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
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
        limit_req zone=general burst=50 nodelay;
        
        root ${INSTALL_DIR}/app;
        index index.html;
        try_files \$uri \$uri/ /index.html;
        
        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }

        # Don't cache HTML
        location ~* \.html$ {
            expires -1;
            add_header Cache-Control "no-store, no-cache, must-revalidate";
        }
    }
}
EOF

    ln -sf /etc/nginx/sites-available/gametaverns /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default

    log_info "Testing Nginx configuration..."
    if nginx -t 2>&1 | tee -a "$LOG_FILE"; then
        run_cmd "systemctl reload nginx"
        log_success "Nginx configured for ${DOMAIN}"
    else
        log_error "Nginx configuration test failed"
        exit 1
    fi
}

create_env_file() {
    log_step "Creating Environment File"

    # Read saved credentials
    source "$CREDENTIALS_FILE" 2>/dev/null || true
    
    JWT_SECRET=$(generate_secret)
    PII_KEY=$(generate_hex_key)
    
    save_credential "JWT_SECRET" "$JWT_SECRET"
    save_credential "PII_ENCRYPTION_KEY" "$PII_KEY"

    log_info "Creating .env file..."
    cat > ${INSTALL_DIR}/.env <<EOF
# ════════════════════════════════════════════════════════════════
# GameTaverns Configuration
# Generated: $(date)
# ════════════════════════════════════════════════════════════════

# ──────────────────────────────────────────────────────────────────
# DATABASE
# ──────────────────────────────────────────────────────────────────
DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@localhost:5432/${DB_NAME}

# ──────────────────────────────────────────────────────────────────
# SECURITY (Auto-generated - DO NOT SHARE!)
# ──────────────────────────────────────────────────────────────────
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=7d
PII_ENCRYPTION_KEY=${PII_KEY}

# ──────────────────────────────────────────────────────────────────
# SERVER
# ──────────────────────────────────────────────────────────────────
PORT=3001
NODE_ENV=production
STANDALONE=true
LOG_LEVEL=info

# ──────────────────────────────────────────────────────────────────
# SITE
# ──────────────────────────────────────────────────────────────────
SITE_URL=https://${DOMAIN}
SITE_NAME=GameTaverns
CORS_ORIGINS=https://${DOMAIN},https://*.${DOMAIN}

# ──────────────────────────────────────────────────────────────────
# EMAIL (Local Postfix)
# ──────────────────────────────────────────────────────────────────
SMTP_HOST=localhost
SMTP_PORT=25
SMTP_SECURE=false
SMTP_FROM=GameTaverns <noreply@${MAIL_DOMAIN}>

# ──────────────────────────────────────────────────────────────────
# UPLOADS
# ──────────────────────────────────────────────────────────────────
UPLOAD_DIR=${INSTALL_DIR}/uploads
MAX_FILE_SIZE=10485760

# ──────────────────────────────────────────────────────────────────
# LOGGING
# ──────────────────────────────────────────────────────────────────
LOG_DIR=${INSTALL_DIR}/logs

# ──────────────────────────────────────────────────────────────────
# FEATURES (All enabled by default)
# ──────────────────────────────────────────────────────────────────
FEATURE_PLAY_LOGS=true
FEATURE_WISHLIST=true
FEATURE_FOR_SALE=true
FEATURE_MESSAGING=true
FEATURE_RATINGS=true
FEATURE_EVENTS=true
FEATURE_POLLS=true

# ════════════════════════════════════════════════════════════════
# OPTIONAL: AI SERVICES (Required for game URL import)
# ════════════════════════════════════════════════════════════════
# Get Perplexity key: https://www.perplexity.ai/settings/api
PERPLEXITY_API_KEY=

# Get Firecrawl key: https://firecrawl.dev/
FIRECRAWL_API_KEY=

# Alternative (if no Perplexity key):
# OPENAI_API_KEY=

# ════════════════════════════════════════════════════════════════
# OPTIONAL: DISCORD INTEGRATION
# ════════════════════════════════════════════════════════════════
# DISCORD_BOT_TOKEN=
# DISCORD_CLIENT_ID=
# DISCORD_CLIENT_SECRET=

# ════════════════════════════════════════════════════════════════
# OPTIONAL: CLOUDFLARE TURNSTILE (Bot protection)
# ════════════════════════════════════════════════════════════════
# TURNSTILE_SECRET_KEY=

# ════════════════════════════════════════════════════════════════
# PLATFORM ADMINS
# ════════════════════════════════════════════════════════════════
PLATFORM_ADMINS=admin@${DOMAIN}
EOF

    chown ${APP_USER}:${APP_USER} ${INSTALL_DIR}/.env
    chmod 600 ${INSTALL_DIR}/.env

    log_success "Environment file created"
}

run_migrations() {
    log_step "Running Database Migrations"

    cd ${INSTALL_DIR}

    if [[ ! -f "${INSTALL_DIR}/deploy/native/migrations/01-schema.sql" ]]; then
        log_error "Migration file not found: ${INSTALL_DIR}/deploy/native/migrations/01-schema.sql"
        exit 1
    fi

    log_info "Applying database schema..."
    sudo -u postgres psql -d ${DB_NAME} -f ${INSTALL_DIR}/deploy/native/migrations/01-schema.sql >> "$LOG_FILE" 2>&1

    log_info "Granting final permissions..."
    sudo -u postgres psql -d ${DB_NAME} <<EOF >> "$LOG_FILE" 2>&1
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ${DB_USER};
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ${DB_USER};
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO ${DB_USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ${DB_USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ${DB_USER};
EOF

    # Verify tables were created
    TABLE_COUNT=$(sudo -u postgres psql -d ${DB_NAME} -tAc "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'")
    log_info "Tables created: $TABLE_COUNT"

    if [[ "$TABLE_COUNT" -lt 10 ]]; then
        log_error "Expected more tables to be created. Migration may have failed."
        exit 1
    fi

    log_success "Database migrations complete"
}

build_frontend() {
    log_step "Building Frontend"

    cd ${INSTALL_DIR}

    log_info "Installing frontend dependencies..."
    sudo -u ${APP_USER} npm ci >> "$LOG_FILE" 2>&1

    log_info "Building frontend (this may take a few minutes)..."
    sudo -u ${APP_USER} npm run build >> "$LOG_FILE" 2>&1

    if [[ -d "${INSTALL_DIR}/dist" ]]; then
        log_info "Copying build to app directory..."
        cp -r dist/* ${INSTALL_DIR}/app/
        chown -R ${APP_USER}:${APP_USER} ${INSTALL_DIR}/app
        log_success "Frontend built successfully"
    else
        log_error "Frontend build failed - dist directory not found"
        exit 1
    fi
}

build_backend() {
    log_step "Building Backend"

    cd ${INSTALL_DIR}/server

    log_info "Installing backend dependencies..."
    npm ci >> "$LOG_FILE" 2>&1

    log_info "Building TypeScript..."
    npm run build >> "$LOG_FILE" 2>&1

    if [[ -d "${INSTALL_DIR}/server/dist" ]]; then
        log_success "Backend built successfully"
    else
        log_error "Backend build failed - dist directory not found"
        exit 1
    fi
}

setup_pm2() {
    log_step "Setting Up PM2 Process Manager"

    log_info "Creating PM2 ecosystem file..."
    cat > ${INSTALL_DIR}/ecosystem.config.js <<EOF
module.exports = {
  apps: [{
    name: 'gametaverns-api',
    cwd: '${INSTALL_DIR}/server',
    script: 'dist/index.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production'
    },
    error_file: '${INSTALL_DIR}/logs/api-error.log',
    out_file: '${INSTALL_DIR}/logs/api-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    max_memory_restart: '500M',
    watch: false,
    autorestart: true,
    max_restarts: 10,
    restart_delay: 4000,
    exp_backoff_restart_delay: 100
  }]
};
EOF

    chown ${APP_USER}:${APP_USER} ${INSTALL_DIR}/ecosystem.config.js

    log_info "Starting application with PM2..."
    cd ${INSTALL_DIR}
    pm2 start ecosystem.config.js >> "$LOG_FILE" 2>&1
    pm2 save >> "$LOG_FILE" 2>&1

    # Verify it's running
    sleep 3
    if pm2 list | grep -q "gametaverns-api"; then
        log_success "PM2 configured and application running"
    else
        log_error "PM2 failed to start application"
        pm2 logs gametaverns-api --lines 20 >> "$LOG_FILE" 2>&1
        exit 1
    fi
}

configure_firewall() {
    log_step "Configuring Firewall"

    log_info "Enabling UFW..."
    run_cmd "ufw --force enable"

    log_info "Configuring firewall rules..."
    run_cmd "ufw allow 22/tcp"      # SSH
    run_cmd "ufw allow 80/tcp"      # HTTP
    run_cmd "ufw allow 443/tcp"     # HTTPS
    run_cmd "ufw allow 25/tcp"      # SMTP
    run_cmd "ufw allow 587/tcp"     # SMTP Submission
    run_cmd "ufw allow 993/tcp"     # IMAPS
    run_cmd "ufw allow 995/tcp"     # POP3S
    run_cmd "ufw allow 143/tcp"     # IMAP

    run_cmd "ufw reload"

    log_success "Firewall configured"
}

setup_fail2ban() {
    log_step "Configuring Fail2ban"

    log_info "Creating fail2ban jail configuration..."
    cat > /etc/fail2ban/jail.local <<EOF
# ════════════════════════════════════════════════════════════════
# GameTaverns Fail2ban Configuration
# ════════════════════════════════════════════════════════════════

[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port = 22
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 86400

[nginx-http-auth]
enabled = true
port = http,https
filter = nginx-http-auth
logpath = /var/log/nginx/gametaverns-error.log
maxretry = 5
bantime = 3600

[nginx-botsearch]
enabled = true
port = http,https
filter = nginx-botsearch
logpath = /var/log/nginx/gametaverns-access.log
maxretry = 2
bantime = 86400

[postfix]
enabled = true
port = smtp,465,submission
filter = postfix
logpath = /var/log/mail.log
maxretry = 5
bantime = 3600

[dovecot]
enabled = true
port = pop3,pop3s,imap,imaps
filter = dovecot
logpath = /var/log/dovecot.log
maxretry = 5
bantime = 3600
EOF

    run_cmd "systemctl restart fail2ban"

    log_success "Fail2ban configured"
}

create_admin_user() {
    log_step "Creating Admin User"

    echo ""
    echo -e "${BOLD}Create the first platform administrator:${NC}"
    echo ""

    read -p "Admin email address: " ADMIN_EMAIL
    read -s -p "Admin password (min 8 chars): " ADMIN_PASSWORD
    echo ""
    read -p "Admin display name: " ADMIN_DISPLAY_NAME

    # Validate
    if [[ ${#ADMIN_PASSWORD} -lt 8 ]]; then
        log_error "Password must be at least 8 characters"
        log_warn "Skipping admin creation - run create-admin.sh later"
        return
    fi

    if [[ ! "$ADMIN_EMAIL" =~ ^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$ ]]; then
        log_error "Invalid email address"
        log_warn "Skipping admin creation - run create-admin.sh later"
        return
    fi

    log_info "Creating admin user..."

    # Hash password using Node.js bcrypt
    cd ${INSTALL_DIR}/server
    
    cat > /tmp/hash-password.js <<'HASHEOF'
const bcrypt = require('bcryptjs');
const password = process.argv[2];
const hash = bcrypt.hashSync(password, 12);
console.log(hash);
HASHEOF

    PASSWORD_HASH=$(node /tmp/hash-password.js "${ADMIN_PASSWORD}")
    rm /tmp/hash-password.js

    # Insert user
    sudo -u postgres psql -d ${DB_NAME} <<EOF >> "$LOG_FILE" 2>&1
-- Create admin user
INSERT INTO users (email, password_hash, email_verified)
VALUES ('${ADMIN_EMAIL}', '${PASSWORD_HASH}', true)
ON CONFLICT (email) DO UPDATE SET 
    password_hash = EXCLUDED.password_hash,
    email_verified = true;

-- Get user ID and set up profile/role
DO \$\$
DECLARE
    user_uuid UUID;
BEGIN
    SELECT id INTO user_uuid FROM users WHERE email = '${ADMIN_EMAIL}';
    
    -- Update display name
    UPDATE user_profiles 
    SET display_name = '${ADMIN_DISPLAY_NAME}'
    WHERE user_id = user_uuid;
    
    -- Assign admin role
    INSERT INTO user_roles (user_id, role)
    VALUES (user_uuid, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
    
    RAISE NOTICE 'Admin user created with ID: %', user_uuid;
END;
\$\$;
EOF

    save_credential "ADMIN_EMAIL" "$ADMIN_EMAIL"
    
    log_success "Admin user '${ADMIN_EMAIL}' created"
}

add_mail_user() {
    # Helper function to add additional mail users later
    local email="$1"
    local password="$2"
    local domain=$(echo "$email" | cut -d'@' -f2)
    local user=$(echo "$email" | cut -d'@' -f1)
    
    # Add to vmailbox
    echo "${email}     ${domain}/${user}/" >> /etc/postfix/vmailbox
    postmap /etc/postfix/vmailbox
    
    # Add to dovecot users
    echo "${email}:$(doveadm pw -s SHA512-CRYPT -p "${password}")" >> /etc/dovecot/users
    
    # Create mailbox directory
    mkdir -p /var/mail/vhosts/${domain}/${user}/{cur,new,tmp}
    chown -R vmail:vmail /var/mail/vhosts/${domain}/${user}
    
    systemctl reload postfix
    systemctl reload dovecot
}

create_management_scripts() {
    log_step "Creating Management Scripts"

    # Create add-mail-user script
    log_info "Creating mail user management script..."
    cat > ${INSTALL_DIR}/deploy/native/scripts/add-mail-user.sh <<'EOF'
#!/bin/bash
#
# Add a new mail user
# Usage: ./add-mail-user.sh user@domain.com
#

set -e

if [[ $# -lt 1 ]]; then
    echo "Usage: $0 <email@domain.com>"
    exit 1
fi

EMAIL="$1"
DOMAIN=$(echo "$EMAIL" | cut -d'@' -f2)
USER=$(echo "$EMAIL" | cut -d'@' -f1)

# Generate or prompt for password
read -s -p "Password for ${EMAIL}: " PASSWORD
echo ""

if [[ ${#PASSWORD} -lt 8 ]]; then
    echo "Error: Password must be at least 8 characters"
    exit 1
fi

echo "Adding mail user ${EMAIL}..."

# Add to Postfix vmailbox
echo "${EMAIL}     ${DOMAIN}/${USER}/" >> /etc/postfix/vmailbox
postmap /etc/postfix/vmailbox

# Add to Dovecot users
echo "${EMAIL}:$(doveadm pw -s SHA512-CRYPT -p "${PASSWORD}")" >> /etc/dovecot/users

# Create mailbox directory
mkdir -p /var/mail/vhosts/${DOMAIN}/${USER}/{cur,new,tmp}
chown -R vmail:vmail /var/mail/vhosts/${DOMAIN}/${USER}

# Reload services
systemctl reload postfix
systemctl reload dovecot

echo ""
echo "✓ Mail user ${EMAIL} created successfully!"
echo ""
echo "IMAP Settings:"
echo "  Server: mail.${DOMAIN}"
echo "  Port: 993 (SSL) or 143 (STARTTLS)"
echo "  Username: ${EMAIL}"
echo ""
echo "SMTP Settings:"
echo "  Server: mail.${DOMAIN}"
echo "  Port: 587 (STARTTLS) or 25"
echo "  Username: ${EMAIL}"
EOF

    chmod +x ${INSTALL_DIR}/deploy/native/scripts/add-mail-user.sh

    log_success "Management scripts created"
}

verify_installation() {
    log_step "Verifying Installation"
    
    local errors=0
    
    # Check PostgreSQL
    log_info "Checking PostgreSQL..."
    if systemctl is-active --quiet postgresql; then
        log_success "PostgreSQL is running"
    else
        log_error "PostgreSQL is NOT running"
        ((errors++))
    fi
    
    # Check database connection
    log_info "Checking database connection..."
    source "$CREDENTIALS_FILE" 2>/dev/null || true
    if PGPASSWORD="${DB_PASSWORD}" psql -h localhost -U ${DB_USER} -d ${DB_NAME} -c "SELECT COUNT(*) FROM users;" > /dev/null 2>&1; then
        log_success "Database connection OK"
    else
        log_error "Database connection FAILED"
        ((errors++))
    fi
    
    # Check API
    log_info "Checking API server..."
    sleep 2
    if curl -s http://localhost:3001/health > /dev/null 2>&1; then
        log_success "API server is responding"
    else
        log_error "API server is NOT responding"
        log_warn "Check PM2 logs: pm2 logs gametaverns-api"
        ((errors++))
    fi
    
    # Check Nginx
    log_info "Checking Nginx..."
    if systemctl is-active --quiet nginx; then
        log_success "Nginx is running"
    else
        log_error "Nginx is NOT running"
        ((errors++))
    fi
    
    # Check Nginx config
    if nginx -t 2>/dev/null; then
        log_success "Nginx configuration is valid"
    else
        log_error "Nginx configuration has errors"
        ((errors++))
    fi
    
    # Check mail services
    log_info "Checking mail services..."
    if systemctl is-active --quiet postfix; then
        log_success "Postfix is running"
    else
        log_warn "Postfix is NOT running (email may not work)"
    fi
    
    if systemctl is-active --quiet dovecot; then
        log_success "Dovecot is running"
    else
        log_warn "Dovecot is NOT running (webmail may not work)"
    fi
    
    # Check frontend build
    log_info "Checking frontend build..."
    if [[ -f "${INSTALL_DIR}/app/index.html" ]]; then
        log_success "Frontend build exists"
    else
        log_error "Frontend build is missing"
        ((errors++))
    fi
    
    # Check backend build
    log_info "Checking backend build..."
    if [[ -f "${INSTALL_DIR}/server/dist/index.js" ]]; then
        log_success "Backend build exists"
    else
        log_error "Backend build is missing"
        ((errors++))
    fi
    
    echo ""
    if [[ $errors -gt 0 ]]; then
        log_error "Installation completed with $errors error(s)"
        log_warn "Please check the log file: ${LOG_FILE}"
        return 1
    else
        log_success "All verification checks passed!"
    fi
}

cleanup() {
    log_step "Cleanup"

    log_info "Cleaning up temporary files..."
    apt-get autoremove -y >> "$LOG_FILE" 2>&1
    apt-get clean >> "$LOG_FILE" 2>&1

    log_success "Cleanup complete"
}

print_summary() {
    # Read credentials
    source "$CREDENTIALS_FILE" 2>/dev/null || true

    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║       GameTaverns Installation Complete!                       ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${BOLD}Installation Directory:${NC} ${INSTALL_DIR}"
    echo -e "${BOLD}Domain:${NC} ${DOMAIN}"
    echo -e "${BOLD}Mail Domain:${NC} ${MAIL_DOMAIN}"
    echo ""
    echo -e "${BOLD}${CYAN}═══ MANAGEMENT INTERFACES ═══${NC}"
    echo ""
    echo -e "${BOLD}Server Management (Cockpit):${NC}"
    echo "  URL: https://<your-server-ip>:9090"
    echo "  Login with your server's root/sudo credentials"
    echo "  Features: System monitoring, terminal, logs, services, storage"
    echo ""
    echo -e "${BOLD}Webmail (Roundcube):${NC}"
    echo "  URL: http://mail.${MAIL_DOMAIN}"
    echo ""
    echo -e "${BOLD}${CYAN}═══ CREDENTIALS ═══${NC}"
    echo -e "${YELLOW}IMPORTANT: Save these credentials securely!${NC}"
    echo -e "Credentials file: ${CREDENTIALS_FILE}"
    echo ""
    echo -e "${BOLD}Database:${NC}"
    echo "  User: ${DB_USER}"
    echo "  Password: ${DB_PASSWORD}"
    echo "  Database: ${DB_NAME}"
    echo ""
    echo -e "${BOLD}Mail Accounts:${NC}"
    echo "  admin@${MAIL_DOMAIN}: ${MAIL_ADMIN_PASSWORD}"
    echo "  legal@${MAIL_DOMAIN}: ${MAIL_LEGAL_PASSWORD}"
    echo "  support@${MAIL_DOMAIN}: ${MAIL_SUPPORT_PASSWORD}"
    echo ""
    echo -e "${BOLD}${CYAN}═══ NEXT STEPS ═══${NC}"
    echo ""
    echo "1. Configure DNS records:"
    echo "   - A record: ${DOMAIN} → <your-server-ip>"
    echo "   - A record: *.${DOMAIN} → <your-server-ip>"
    echo "   - A record: mail.${DOMAIN} → <your-server-ip>"
    echo "   - MX record: ${DOMAIN} → mail.${DOMAIN}"
    echo "   - SPF record: v=spf1 ip4:<your-server-ip> -all"
    echo ""
    echo "2. Set up SSL certificates:"
    echo "   sudo certbot --nginx -d ${DOMAIN} -d *.${DOMAIN} -d mail.${DOMAIN}"
    echo ""
    echo "3. Add API keys to ${INSTALL_DIR}/.env:"
    echo "   - PERPLEXITY_API_KEY (for AI features)"
    echo "   - FIRECRAWL_API_KEY (for URL import)"
    echo ""
    echo -e "${BOLD}${CYAN}═══ USEFUL COMMANDS ═══${NC}"
    echo ""
    echo "  Server GUI:           https://<your-server-ip>:9090"
    echo "  View API logs:        pm2 logs gametaverns-api"
    echo "  Restart API:          pm2 restart gametaverns-api"
    echo "  View mail logs:       tail -f /var/log/mail.log"
    echo "  Add mail user:        ${INSTALL_DIR}/deploy/native/scripts/add-mail-user.sh"
    echo "  Database backup:      ${INSTALL_DIR}/deploy/native/scripts/backup.sh"
    echo "  Update application:   ${INSTALL_DIR}/deploy/native/scripts/update.sh"
    echo ""
    echo -e "${BOLD}Log file:${NC} ${LOG_FILE}"
    echo ""
    echo -e "${GREEN}Installation completed at $(date)${NC}"
    echo ""
}

# ═══════════════════════════════════════════════════════════════════
# Main Installation Flow
# ═══════════════════════════════════════════════════════════════════

main() {
    clear
    echo ""
    echo -e "${BOLD}${BLUE}╔═══════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BOLD}${BLUE}║         GameTaverns Native Installation                           ║${NC}"
    echo -e "${BOLD}${BLUE}║         Ubuntu 24.04 LTS - Full Stack                             ║${NC}"
    echo -e "${BOLD}${BLUE}╚═══════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo "This script will install and configure:"
    echo "  • PostgreSQL 16 database"
    echo "  • Node.js 22 + PM2 process manager"
    echo "  • Nginx reverse proxy"
    echo "  • Postfix + Dovecot mail server"
    echo "  • Roundcube webmail interface"
    echo "  • Cockpit web console (server management GUI)"
    echo "  • GameTaverns application"
    echo ""
    echo -e "${YELLOW}Estimated time: 10-20 minutes${NC}"
    echo ""
    read -p "Press Enter to continue or Ctrl+C to cancel..."
    echo ""

    # Initialize
    init_logging
    
    # Create credentials file
    echo "# GameTaverns Credentials - Generated $(date)" > "$CREDENTIALS_FILE"
    chmod 600 "$CREDENTIALS_FILE"

    check_root
    check_ubuntu

    log_info "Starting installation..."

    # System setup
    install_system_deps
    install_cockpit
    create_app_user
    setup_directories

    # Database
    install_postgresql
    configure_postgresql

    # Runtime
    install_nodejs
    install_nginx

    # Mail server
    install_mail_server
    configure_postfix
    configure_dovecot
    install_roundcube
    configure_nginx_roundcube

    # Application
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

    # Admin setup
    create_admin_user
    create_management_scripts

    # Verify everything works
    verify_installation

    # Cleanup
    cleanup

    # Done
    print_summary
}

# Run main function
main "$@"
