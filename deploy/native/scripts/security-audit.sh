#!/bin/bash
#
# GameTaverns Security Audit Script
# Checks for common security issues and misconfigurations
#
# Usage: sudo ./security-audit.sh
#

set -e

INSTALL_DIR="/opt/gametaverns"
LOG_FILE="${INSTALL_DIR}/logs/security-audit.log"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# Counters
PASS=0
WARN=0
FAIL=0

echo ""
echo -e "${CYAN}╔═══════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║            GameTaverns Security Audit                             ║${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "Date: $(date)"
echo ""

# Logging
mkdir -p "$(dirname "$LOG_FILE")"
exec > >(tee -a "$LOG_FILE") 2>&1

# ═══════════════════════════════════════════════════════════════════
# Helper Functions
# ═══════════════════════════════════════════════════════════════════

check_pass() {
    echo -e "${GREEN}[PASS]${NC} $1"
    PASS=$((PASS + 1))
}

check_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
    echo -e "       └─ $2"
    WARN=$((WARN + 1))
}

check_fail() {
    echo -e "${RED}[FAIL]${NC} $1"
    echo -e "       └─ $2"
    FAIL=$((FAIL + 1))
}

check_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

section() {
    echo ""
    echo -e "${BOLD}━━━ $1 ━━━${NC}"
}

# ═══════════════════════════════════════════════════════════════════
# Firewall Checks
# ═══════════════════════════════════════════════════════════════════

section "Firewall Configuration"

if ufw status | grep -q "active"; then
    check_pass "UFW firewall is active"
    
    # Check only essential ports are open
    open_ports=$(ufw status | grep "ALLOW" | awk '{print $1}' | sort -u | tr '\n' ' ')
    check_info "Open ports: $open_ports"
    
    # Check SSH is limited
    if ufw status | grep -q "22.*LIMIT"; then
        check_pass "SSH rate limiting enabled"
    else
        check_warn "SSH rate limiting not enabled" "Run: ufw limit 22/tcp"
    fi
else
    check_fail "UFW firewall is not active" "Run: ufw enable"
fi

# ═══════════════════════════════════════════════════════════════════
# Fail2ban Checks
# ═══════════════════════════════════════════════════════════════════

section "Intrusion Prevention"

if systemctl is-active --quiet fail2ban; then
    check_pass "Fail2ban is running"
    
    # Check jails
    jail_count=$(fail2ban-client status 2>/dev/null | grep "Number of jail" | awk '{print $NF}')
    check_info "Active jails: ${jail_count:-0}"
    
    # Check sshd jail
    if fail2ban-client status sshd 2>/dev/null | grep -q "Status"; then
        banned=$(fail2ban-client status sshd 2>/dev/null | grep "Currently banned" | awk '{print $NF}')
        check_info "SSH: ${banned:-0} IPs currently banned"
    else
        check_warn "SSH jail not active" "Consider enabling sshd jail"
    fi
else
    check_fail "Fail2ban is not running" "Run: systemctl enable --now fail2ban"
fi

# ═══════════════════════════════════════════════════════════════════
# SSH Configuration
# ═══════════════════════════════════════════════════════════════════

section "SSH Security"

SSHD_CONFIG="/etc/ssh/sshd_config"

if [ -f "$SSHD_CONFIG" ]; then
    # Check root login
    if grep -qE "^PermitRootLogin\s+(no|prohibit-password)" "$SSHD_CONFIG"; then
        check_pass "Root login via password disabled"
    elif grep -qE "^PermitRootLogin\s+yes" "$SSHD_CONFIG"; then
        check_fail "Root login via password enabled" "Set PermitRootLogin to 'no' or 'prohibit-password'"
    else
        check_warn "Root login setting unclear" "Explicitly set PermitRootLogin in sshd_config"
    fi
    
    # Check password authentication
    if grep -qE "^PasswordAuthentication\s+no" "$SSHD_CONFIG"; then
        check_pass "Password authentication disabled (key-only)"
    else
        check_warn "Password authentication enabled" "Consider using SSH keys only"
    fi
    
    # Check max auth tries
    max_tries=$(grep -E "^MaxAuthTries" "$SSHD_CONFIG" | awk '{print $2}')
    if [ -n "$max_tries" ] && [ "$max_tries" -le 4 ]; then
        check_pass "SSH max auth tries limited to $max_tries"
    else
        check_warn "SSH max auth tries not limited" "Add 'MaxAuthTries 3' to sshd_config"
    fi
else
    check_fail "SSH config not found" "Expected at $SSHD_CONFIG"
fi

# ═══════════════════════════════════════════════════════════════════
# Database Security
# ═══════════════════════════════════════════════════════════════════

section "Database Security"

# Check PostgreSQL is listening only locally
pg_listen=$(sudo -u postgres psql -tAc "SHOW listen_addresses;" 2>/dev/null || echo "unknown")
if [ "$pg_listen" = "localhost" ] || [ "$pg_listen" = "127.0.0.1" ]; then
    check_pass "PostgreSQL listening on localhost only"
else
    check_warn "PostgreSQL listening on: $pg_listen" "Consider restricting to localhost"
fi

# Check SSL mode
pg_ssl=$(sudo -u postgres psql -tAc "SHOW ssl;" 2>/dev/null || echo "unknown")
if [ "$pg_ssl" = "on" ]; then
    check_pass "PostgreSQL SSL enabled"
else
    check_info "PostgreSQL SSL: $pg_ssl (OK for localhost-only)"
fi

# Check for weak passwords (length check on app user)
if [ -f "${INSTALL_DIR}/.env" ]; then
    db_pass=$(grep "DB_PASSWORD\|DATABASE_URL" "${INSTALL_DIR}/.env" | head -1)
    if [ ${#db_pass} -gt 20 ]; then
        check_pass "Database password appears strong"
    else
        check_warn "Database password may be weak" "Use a longer, random password"
    fi
fi

# ═══════════════════════════════════════════════════════════════════
# Application Security
# ═══════════════════════════════════════════════════════════════════

section "Application Security"

ENV_FILE="${INSTALL_DIR}/.env"

if [ -f "$ENV_FILE" ]; then
    # Check file permissions
    env_perms=$(stat -c "%a" "$ENV_FILE")
    if [ "$env_perms" = "600" ] || [ "$env_perms" = "640" ]; then
        check_pass ".env file has restrictive permissions ($env_perms)"
    else
        check_warn ".env file permissions too open ($env_perms)" "Run: chmod 600 ${ENV_FILE}"
    fi
    
    # Check JWT secret
    jwt_secret=$(grep "JWT_SECRET" "$ENV_FILE" | cut -d'=' -f2)
    if [ ${#jwt_secret} -ge 32 ]; then
        check_pass "JWT secret is sufficiently long"
    else
        check_fail "JWT secret too short" "Generate with: openssl rand -base64 32"
    fi
    
    # Check if default/placeholder values exist
    if grep -qE "(CHANGE_THIS|changeme|password123)" "$ENV_FILE"; then
        check_fail "Default placeholder values in .env" "Update all CHANGE_THIS values"
    else
        check_pass "No default placeholder values detected"
    fi
    
    # Check PII encryption key
    if grep -q "PII_ENCRYPTION_KEY=.\+" "$ENV_FILE"; then
        check_pass "PII encryption key configured"
    else
        check_warn "PII encryption key not set" "Messages may not be encrypted"
    fi
else
    check_fail ".env file not found" "Expected at ${ENV_FILE}"
fi

# ═══════════════════════════════════════════════════════════════════
# HTTPS/SSL Configuration
# ═══════════════════════════════════════════════════════════════════

section "HTTPS/SSL Configuration"

# Check for SSL certificates (extract domain from SITE_URL)
domain=$(grep "SITE_URL=" "${INSTALL_DIR}/.env" 2>/dev/null | cut -d'=' -f2 | tr -d '"' | sed 's|https://||;s|http://||' || echo "")

if [ -n "$domain" ]; then
    cert_path="/etc/letsencrypt/live/${domain}/fullchain.pem"
    
    if [ -f "$cert_path" ]; then
        check_pass "SSL certificate exists for $domain"
        
        # Check expiry
        expiry=$(openssl x509 -enddate -noout -in "$cert_path" 2>/dev/null | cut -d'=' -f2)
        check_info "Certificate expires: $expiry"
        
        # Check cert strength
        key_size=$(openssl x509 -text -noout -in "$cert_path" 2>/dev/null | grep "Public-Key" | grep -oP '\d+')
        if [ "${key_size:-0}" -ge 2048 ]; then
            check_pass "Certificate key size: ${key_size} bits"
        else
            check_warn "Certificate key size: ${key_size} bits" "Consider 2048+ bits"
        fi
    else
        check_warn "SSL certificate not found" "Run: ${INSTALL_DIR}/deploy/native/scripts/setup-ssl.sh"
    fi
else
    check_warn "Domain not configured" "SSL cannot be verified"
fi

# Check Nginx SSL settings
nginx_ssl="/etc/nginx/sites-available/gametaverns"
if [ -f "$nginx_ssl" ]; then
    if grep -q "ssl_protocols.*TLSv1.3" "$nginx_ssl"; then
        check_pass "TLS 1.3 enabled in Nginx"
    elif grep -q "ssl_protocols.*TLSv1.2" "$nginx_ssl"; then
        check_pass "TLS 1.2 enabled in Nginx"
    else
        check_warn "Modern TLS not explicitly configured" "Add ssl_protocols TLSv1.2 TLSv1.3"
    fi
    
    if grep -q "add_header Strict-Transport-Security" "$nginx_ssl"; then
        check_pass "HSTS header configured"
    else
        check_warn "HSTS header not found" "Consider adding Strict-Transport-Security header"
    fi
fi

# ═══════════════════════════════════════════════════════════════════
# File Permissions
# ═══════════════════════════════════════════════════════════════════

section "File Permissions"

# Check uploads directory
uploads_dir="${INSTALL_DIR}/uploads"
if [ -d "$uploads_dir" ]; then
    uploads_owner=$(stat -c "%U:%G" "$uploads_dir")
    if [ "$uploads_owner" = "gametaverns:gametaverns" ]; then
        check_pass "Uploads directory owned by gametaverns"
    else
        check_warn "Uploads directory owner: $uploads_owner" "Consider: chown gametaverns:gametaverns ${uploads_dir}"
    fi
fi

# Check credentials file
creds_file="/root/gametaverns-credentials.txt"
if [ -f "$creds_file" ]; then
    creds_perms=$(stat -c "%a" "$creds_file")
    if [ "$creds_perms" = "600" ]; then
        check_pass "Credentials file has restrictive permissions"
    else
        check_fail "Credentials file permissions: $creds_perms" "Run: chmod 600 ${creds_file}"
    fi
fi

# ═══════════════════════════════════════════════════════════════════
# System Updates
# ═══════════════════════════════════════════════════════════════════

section "System Updates"

# Check for security updates
if command -v apt &> /dev/null; then
    apt_update=$(apt list --upgradable 2>/dev/null | grep -c "security" || echo "0")
    
    if [ "$apt_update" -eq 0 ]; then
        check_pass "No pending security updates"
    else
        check_warn "$apt_update security updates available" "Run: apt update && apt upgrade"
    fi
    
    # Check unattended-upgrades
    if dpkg -l | grep -q "unattended-upgrades"; then
        check_pass "Unattended upgrades installed"
    else
        check_warn "Unattended upgrades not installed" "Run: apt install unattended-upgrades"
    fi
fi

# ═══════════════════════════════════════════════════════════════════
# Summary
# ═══════════════════════════════════════════════════════════════════

echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

TOTAL=$((PASS + WARN + FAIL))

echo -e "  ${GREEN}Passed:${NC}   $PASS / $TOTAL"
echo -e "  ${YELLOW}Warnings:${NC} $WARN / $TOTAL"
echo -e "  ${RED}Failed:${NC}   $FAIL / $TOTAL"
echo ""

if [ $FAIL -gt 0 ]; then
    echo -e "${RED}╔═══════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║  ACTION REQUIRED: Address failed checks before production use    ║${NC}"
    echo -e "${RED}╚═══════════════════════════════════════════════════════════════════╝${NC}"
    exit 1
elif [ $WARN -gt 3 ]; then
    echo -e "${YELLOW}╔═══════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${YELLOW}║  REVIEW RECOMMENDED: Several warnings detected                   ║${NC}"
    echo -e "${YELLOW}╚═══════════════════════════════════════════════════════════════════╝${NC}"
    exit 0
else
    echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║  SECURITY CHECK PASSED                                           ║${NC}"
    echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════════╝${NC}"
    exit 0
fi
