#!/bin/bash
#
# GameTaverns Mail User Management
# Add, remove, or list mail accounts
#
# Usage: 
#   ./add-mail-user.sh add user@domain.com
#   ./add-mail-user.sh remove user@domain.com
#   ./add-mail-user.sh list
#   ./add-mail-user.sh passwd user@domain.com
#

set -e

INSTALL_DIR="/opt/gametaverns"
CREDENTIALS_FILE="/root/gametaverns-credentials.txt"
DOVECOT_USERS="/etc/dovecot/users"
POSTFIX_VMAILBOX="/etc/postfix/vmailbox"
POSTFIX_VIRTUAL="/etc/postfix/virtual"
VMAIL_BASE="/var/mail/vhosts"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Check root
if [[ $EUID -ne 0 ]]; then
    echo -e "${RED}[ERROR]${NC} This script must be run as root (sudo)"
    exit 1
fi

# ═══════════════════════════════════════════════════════════════════
# Helper Functions
# ═══════════════════════════════════════════════════════════════════

generate_password() {
    openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 16
}

validate_email() {
    local email="$1"
    if [[ ! "$email" =~ ^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$ ]]; then
        echo -e "${RED}[ERROR]${NC} Invalid email format: $email"
        exit 1
    fi
}

get_domain() {
    echo "$1" | cut -d'@' -f2
}

get_user() {
    echo "$1" | cut -d'@' -f1
}

# ═══════════════════════════════════════════════════════════════════
# Add Mail User
# ═══════════════════════════════════════════════════════════════════

add_user() {
    local email="$1"
    validate_email "$email"
    
    local user=$(get_user "$email")
    local domain=$(get_domain "$email")
    
    echo ""
    echo -e "${BLUE}Adding mail user: ${email}${NC}"
    echo ""
    
    # Check if user exists
    if grep -q "^${email}:" "$DOVECOT_USERS" 2>/dev/null; then
        echo -e "${YELLOW}[WARN]${NC} User already exists: $email"
        read -p "Update password? (y/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 0
        fi
        change_password "$email"
        return
    fi
    
    # Generate or prompt for password
    read -p "Enter password (leave blank to generate): " -s password
    echo
    
    if [ -z "$password" ]; then
        password=$(generate_password)
        echo -e "${GREEN}Generated password:${NC} $password"
    fi
    
    # Hash password
    local hash=$(doveadm pw -s SHA512-CRYPT -p "$password")
    
    # Add to Dovecot users
    echo "${email}:${hash}" >> "$DOVECOT_USERS"
    
    # Add to Postfix virtual mailbox
    if ! grep -q "^${email}" "$POSTFIX_VMAILBOX" 2>/dev/null; then
        echo "${email}     ${domain}/${user}/" >> "$POSTFIX_VMAILBOX"
        postmap "$POSTFIX_VMAILBOX"
    fi
    
    # Create mailbox directories
    mkdir -p "${VMAIL_BASE}/${domain}/${user}"/{cur,new,tmp}
    chown -R vmail:vmail "${VMAIL_BASE}/${domain}/${user}"
    
    # Save to credentials file
    echo "MAIL_${user^^}_PASSWORD=${password}" >> "$CREDENTIALS_FILE"
    
    # Reload services
    systemctl reload dovecot 2>/dev/null || true
    systemctl reload postfix 2>/dev/null || true
    
    echo ""
    echo -e "${GREEN}[OK]${NC} Mail user created successfully!"
    echo ""
    echo "  Email:    $email"
    echo "  Password: $password"
    echo ""
    echo "  IMAP Server: mail.${domain} (port 143 or 993)"
    echo "  SMTP Server: mail.${domain} (port 25 or 587)"
    echo ""
    echo -e "${YELLOW}Save this password - it won't be shown again!${NC}"
}

# ═══════════════════════════════════════════════════════════════════
# Remove Mail User
# ═══════════════════════════════════════════════════════════════════

remove_user() {
    local email="$1"
    validate_email "$email"
    
    local user=$(get_user "$email")
    local domain=$(get_domain "$email")
    
    echo ""
    echo -e "${YELLOW}Removing mail user: ${email}${NC}"
    echo ""
    
    # Confirm
    read -p "Are you sure? This will delete all mail! (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Cancelled."
        exit 0
    fi
    
    # Remove from Dovecot users
    if [ -f "$DOVECOT_USERS" ]; then
        sed -i "/^${email}:/d" "$DOVECOT_USERS"
    fi
    
    # Remove from Postfix virtual mailbox
    if [ -f "$POSTFIX_VMAILBOX" ]; then
        sed -i "/^${email}/d" "$POSTFIX_VMAILBOX"
        postmap "$POSTFIX_VMAILBOX"
    fi
    
    # Remove from Postfix virtual aliases
    if [ -f "$POSTFIX_VIRTUAL" ]; then
        sed -i "/${email}/d" "$POSTFIX_VIRTUAL"
        postmap "$POSTFIX_VIRTUAL"
    fi
    
    # Remove mailbox (optional)
    read -p "Delete mailbox data? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm -rf "${VMAIL_BASE}/${domain}/${user}"
        echo -e "${GREEN}[OK]${NC} Mailbox data deleted"
    fi
    
    # Reload services
    systemctl reload dovecot 2>/dev/null || true
    systemctl reload postfix 2>/dev/null || true
    
    echo ""
    echo -e "${GREEN}[OK]${NC} Mail user removed: $email"
}

# ═══════════════════════════════════════════════════════════════════
# Change Password
# ═══════════════════════════════════════════════════════════════════

change_password() {
    local email="$1"
    validate_email "$email"
    
    echo ""
    echo -e "${BLUE}Changing password for: ${email}${NC}"
    echo ""
    
    # Check if user exists
    if ! grep -q "^${email}:" "$DOVECOT_USERS" 2>/dev/null; then
        echo -e "${RED}[ERROR]${NC} User not found: $email"
        exit 1
    fi
    
    # Prompt for password
    read -p "Enter new password (leave blank to generate): " -s password
    echo
    
    if [ -z "$password" ]; then
        password=$(generate_password)
        echo -e "${GREEN}Generated password:${NC} $password"
    fi
    
    # Confirm
    read -p "Confirm new password: " -s password_confirm
    echo
    
    if [ "$password" != "$password_confirm" ] && [ -n "$password_confirm" ]; then
        echo -e "${RED}[ERROR]${NC} Passwords do not match"
        exit 1
    fi
    
    # Hash password
    local hash=$(doveadm pw -s SHA512-CRYPT -p "$password")
    
    # Update Dovecot users file
    sed -i "s|^${email}:.*|${email}:${hash}|" "$DOVECOT_USERS"
    
    # Reload Dovecot
    systemctl reload dovecot 2>/dev/null || true
    
    echo ""
    echo -e "${GREEN}[OK]${NC} Password changed for: $email"
    echo ""
    echo "  New password: $password"
    echo ""
    echo -e "${YELLOW}Save this password - it won't be shown again!${NC}"
}

# ═══════════════════════════════════════════════════════════════════
# List Mail Users
# ═══════════════════════════════════════════════════════════════════

list_users() {
    echo ""
    echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║            Mail Accounts                                          ║${NC}"
    echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    if [ ! -f "$DOVECOT_USERS" ]; then
        echo -e "${YELLOW}No mail users configured${NC}"
        exit 0
    fi
    
    local count=0
    echo "  Email Address                          Mailbox Size"
    echo "  ─────────────────────────────────────  ────────────"
    
    while IFS=: read -r email hash; do
        [ -z "$email" ] && continue
        
        local user=$(get_user "$email")
        local domain=$(get_domain "$email")
        local mailbox="${VMAIL_BASE}/${domain}/${user}"
        
        local size="(not created)"
        if [ -d "$mailbox" ]; then
            size=$(du -sh "$mailbox" 2>/dev/null | cut -f1 || echo "unknown")
        fi
        
        printf "  %-40s %s\n" "$email" "$size"
        count=$((count + 1))
    done < "$DOVECOT_USERS"
    
    echo ""
    echo "  Total: $count account(s)"
    echo ""
    
    # Get domain from env
    local domain=$(grep "MAIL_DOMAIN=" "$CREDENTIALS_FILE" 2>/dev/null | cut -d'=' -f2 || echo "")
    if [ -n "$domain" ]; then
        echo "  Mail Server: mail.${domain}"
        echo "  Webmail:     http://mail.${domain} (Roundcube)"
    fi
    echo ""
}

# ═══════════════════════════════════════════════════════════════════
# Main
# ═══════════════════════════════════════════════════════════════════

show_help() {
    echo ""
    echo "GameTaverns Mail User Management"
    echo ""
    echo "Usage:"
    echo "  $0 add <email>      Add a new mail account"
    echo "  $0 remove <email>   Remove a mail account"
    echo "  $0 passwd <email>   Change password"
    echo "  $0 list             List all mail accounts"
    echo ""
    echo "Examples:"
    echo "  $0 add support@gametaverns.com"
    echo "  $0 passwd admin@gametaverns.com"
    echo "  $0 list"
    echo ""
}

case "${1:-}" in
    add)
        [ -z "$2" ] && { echo "Usage: $0 add <email>"; exit 1; }
        add_user "$2"
        ;;
    remove|delete|rm)
        [ -z "$2" ] && { echo "Usage: $0 remove <email>"; exit 1; }
        remove_user "$2"
        ;;
    passwd|password)
        [ -z "$2" ] && { echo "Usage: $0 passwd <email>"; exit 1; }
        change_password "$2"
        ;;
    list|ls)
        list_users
        ;;
    -h|--help|help|"")
        show_help
        ;;
    *)
        echo -e "${RED}Unknown command: $1${NC}"
        show_help
        exit 1
        ;;
esac
