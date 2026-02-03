#!/bin/bash
#
# GameTaverns SSL Setup - Cloudflare Origin Certificate
# Alternative to Let's Encrypt when rate-limited or preferring Cloudflare proxy
#
# Usage:
#   ./setup-ssl-cloudflare-origin.sh [domain]
#
# Prerequisites:
#   1. Domain DNS managed by Cloudflare
#   2. Cloudflare Proxy (Orange Cloud) enabled on A records
#   3. Origin Certificate generated in Cloudflare dashboard
#

set -e

INSTALL_DIR="/opt/gametaverns"
CREDENTIALS_FILE="/root/gametaverns-credentials.txt"
CERT_DIR="/etc/ssl/cloudflare"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo ""
echo "╔═══════════════════════════════════════════════════════════════════╗"
echo "║     GameTaverns - Cloudflare Origin Certificate Setup             ║"
echo "╚═══════════════════════════════════════════════════════════════════╝"
echo ""
echo -e "${CYAN}This setup uses Cloudflare Origin Certificates instead of Let's Encrypt.${NC}"
echo ""
echo "Benefits:"
echo "  • Bypasses Let's Encrypt rate limits"
echo "  • Certificates valid up to 15 years"
echo "  • Cloudflare handles edge SSL/TLS"
echo "  • Instant setup (no ACME delays)"
echo ""
echo "Requirements:"
echo "  • Cloudflare Proxy (Orange Cloud) MUST be enabled"
echo "  • SSL/TLS mode set to 'Full (strict)' in Cloudflare"
echo ""

# Get domain
DOMAIN="${1:-}"

if [[ -z "$DOMAIN" ]] && [[ -f "$CREDENTIALS_FILE" ]]; then
    source "$CREDENTIALS_FILE"
fi

if [[ -z "$DOMAIN" ]]; then
    read -p "Enter your domain (e.g., gametaverns.com): " DOMAIN
fi

if [[ -z "$DOMAIN" ]]; then
    echo -e "${RED}[ERROR]${NC} Domain is required"
    exit 1
fi

echo "Domain: ${DOMAIN}"
echo ""

# Check if nginx is running
if ! systemctl is-active --quiet nginx; then
    echo -e "${RED}[ERROR]${NC} Nginx is not running. Start it first:"
    echo "  sudo systemctl start nginx"
    exit 1
fi

# Create certificate directory
mkdir -p "$CERT_DIR"
chmod 700 "$CERT_DIR"

# ============================================================================
# Certificate Installation
# ============================================================================
echo -e "${CYAN}╔═══════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║          Origin Certificate Installation                          ║${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════════════════════════════════╝${NC}"
echo ""

CERT_FILE="${CERT_DIR}/${DOMAIN}.pem"
KEY_FILE="${CERT_DIR}/${DOMAIN}.key"

# Check if certificates already exist
if [[ -f "$CERT_FILE" ]] && [[ -f "$KEY_FILE" ]]; then
    echo -e "${GREEN}[OK]${NC} Existing certificates found at:"
    echo "  Certificate: $CERT_FILE"
    echo "  Private Key: $KEY_FILE"
    echo ""
    read -p "Replace existing certificates? [y/N]: " REPLACE
    if [[ ! "$REPLACE" =~ ^[Yy] ]]; then
        echo -e "${YELLOW}[INFO]${NC} Keeping existing certificates. Skipping to Nginx config..."
    else
        rm -f "$CERT_FILE" "$KEY_FILE"
    fi
fi

# Install certificates if not present
if [[ ! -f "$CERT_FILE" ]] || [[ ! -f "$KEY_FILE" ]]; then
    echo ""
    echo -e "${YELLOW}To generate a Cloudflare Origin Certificate:${NC}"
    echo ""
    echo "  1. Go to: https://dash.cloudflare.com"
    echo "  2. Select your domain → SSL/TLS → Origin Server"
    echo "  3. Click 'Create Certificate'"
    echo "  4. Settings:"
    echo "     - Key type: RSA (2048)"
    echo "     - Hostnames: ${DOMAIN}, *.${DOMAIN}"
    echo "     - Validity: 15 years (recommended)"
    echo "  5. Click 'Create' and copy both values"
    echo ""
    
    # Get certificate
    echo -e "${CYAN}Paste the Origin Certificate (PEM format):${NC}"
    echo "(Start with '-----BEGIN CERTIFICATE-----', end with '-----END CERTIFICATE-----')"
    echo "(Press Ctrl+D when done)"
    echo ""
    
    cat > "$CERT_FILE"
    chmod 600 "$CERT_FILE"
    
    # Validate certificate format
    if ! grep -q "BEGIN CERTIFICATE" "$CERT_FILE"; then
        echo -e "${RED}[ERROR]${NC} Invalid certificate format"
        rm -f "$CERT_FILE"
        exit 1
    fi
    
    echo ""
    echo -e "${GREEN}[OK]${NC} Certificate saved"
    echo ""
    
    # Get private key
    echo -e "${CYAN}Paste the Private Key (PEM format):${NC}"
    echo "(Start with '-----BEGIN PRIVATE KEY-----', end with '-----END PRIVATE KEY-----')"
    echo "(Press Ctrl+D when done)"
    echo ""
    
    cat > "$KEY_FILE"
    chmod 600 "$KEY_FILE"
    
    # Validate key format
    if ! grep -q "BEGIN.*PRIVATE KEY" "$KEY_FILE"; then
        echo -e "${RED}[ERROR]${NC} Invalid private key format"
        rm -f "$KEY_FILE"
        exit 1
    fi
    
    echo ""
    echo -e "${GREEN}[OK]${NC} Private key saved"
fi

# Verify certificate and key match
echo ""
echo -e "${YELLOW}[INFO]${NC} Verifying certificate and key..."

CERT_MOD=$(openssl x509 -noout -modulus -in "$CERT_FILE" 2>/dev/null | openssl md5)
KEY_MOD=$(openssl rsa -noout -modulus -in "$KEY_FILE" 2>/dev/null | openssl md5)

if [[ "$CERT_MOD" != "$KEY_MOD" ]]; then
    echo -e "${RED}[ERROR]${NC} Certificate and private key do not match!"
    echo "Please ensure you copied both from the same Cloudflare certificate."
    exit 1
fi

echo -e "${GREEN}[OK]${NC} Certificate and key match"

# Show certificate details
echo ""
echo -e "${YELLOW}[INFO]${NC} Certificate details:"
openssl x509 -in "$CERT_FILE" -noout -subject -dates | sed 's/^/  /'

# ============================================================================
# Update Nginx Configuration
# ============================================================================
echo ""
echo -e "${CYAN}╔═══════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║          Updating Nginx Configuration                             ║${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════════════════════════════════╝${NC}"
echo ""

NGINX_CONF="/etc/nginx/sites-available/gametaverns"

if [[ ! -f "$NGINX_CONF" ]]; then
    echo -e "${RED}[ERROR]${NC} Nginx config not found: $NGINX_CONF"
    echo "Run the main install.sh first."
    exit 1
fi

# Backup current config
cp "$NGINX_CONF" "${NGINX_CONF}.backup-$(date +%Y%m%d-%H%M%S)"

# Update SSL certificate paths
sed -i "s|ssl_certificate .*|ssl_certificate ${CERT_FILE};|g" "$NGINX_CONF"
sed -i "s|ssl_certificate_key .*|ssl_certificate_key ${KEY_FILE};|g" "$NGINX_CONF"

# Also update Roundcube if exists
ROUNDCUBE_CONF="/etc/nginx/sites-available/roundcube"
if [[ -f "$ROUNDCUBE_CONF" ]]; then
    cp "$ROUNDCUBE_CONF" "${ROUNDCUBE_CONF}.backup-$(date +%Y%m%d-%H%M%S)"
    sed -i "s|ssl_certificate .*|ssl_certificate ${CERT_FILE};|g" "$ROUNDCUBE_CONF"
    sed -i "s|ssl_certificate_key .*|ssl_certificate_key ${KEY_FILE};|g" "$ROUNDCUBE_CONF"
    echo -e "${GREEN}[OK]${NC} Updated Roundcube Nginx config"
fi

# Test nginx configuration
echo -e "${YELLOW}[INFO]${NC} Testing Nginx configuration..."
if nginx -t 2>&1; then
    echo -e "${GREEN}[OK]${NC} Nginx configuration valid"
else
    echo -e "${RED}[ERROR]${NC} Nginx configuration test failed"
    echo "Restoring backup..."
    cp "${NGINX_CONF}.backup-"* "$NGINX_CONF" 2>/dev/null || true
    exit 1
fi

# Reload nginx
echo -e "${YELLOW}[INFO]${NC} Reloading Nginx..."
systemctl reload nginx
echo -e "${GREEN}[OK]${NC} Nginx reloaded"

# ============================================================================
# Verification
# ============================================================================
echo ""
echo -e "${CYAN}╔═══════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║          Verification                                             ║${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════════════════════════════════╝${NC}"
echo ""

echo -e "${YELLOW}[INFO]${NC} Testing local HTTPS connection..."
if curl -sk --max-time 5 "https://127.0.0.1" -H "Host: ${DOMAIN}" >/dev/null 2>&1; then
    echo -e "${GREEN}[OK]${NC} Local HTTPS working (Nginx serving with origin cert)"
else
    echo -e "${YELLOW}[WARN]${NC} Local test inconclusive (may need Cloudflare proxy)"
fi

echo ""
echo -e "${YELLOW}[INFO]${NC} Testing via Cloudflare edge..."
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "https://${DOMAIN}" 2>/dev/null || echo "000")

if [[ "$HTTP_STATUS" == "200" ]] || [[ "$HTTP_STATUS" == "301" ]] || [[ "$HTTP_STATUS" == "302" ]]; then
    echo -e "${GREEN}[OK]${NC} External HTTPS working (HTTP $HTTP_STATUS)"
elif [[ "$HTTP_STATUS" == "000" ]]; then
    echo -e "${YELLOW}[WARN]${NC} Could not reach ${DOMAIN} - check DNS propagation"
elif [[ "$HTTP_STATUS" == "526" ]]; then
    echo -e "${RED}[ERROR]${NC} HTTP 526 - Invalid SSL certificate"
    echo "  Make sure Cloudflare SSL/TLS mode is set to 'Full (strict)'"
elif [[ "$HTTP_STATUS" == "521" ]]; then
    echo -e "${RED}[ERROR]${NC} HTTP 521 - Web server is down"
    echo "  Check: systemctl status nginx"
else
    echo -e "${YELLOW}[WARN]${NC} Unexpected status: HTTP $HTTP_STATUS"
fi

# ============================================================================
# Complete
# ============================================================================
echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     Cloudflare Origin Certificate Setup Complete!                 ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "Your site is now available at:"
echo -e "  ${GREEN}https://${DOMAIN}${NC}"
echo -e "  ${GREEN}https://*.${DOMAIN}${NC} (all library subdomains)"
echo ""
echo -e "${YELLOW}Important Cloudflare Settings:${NC}"
echo "  • SSL/TLS mode: Full (strict)"
echo "  • Proxy status: Orange cloud enabled on A records"
echo "  • Always Use HTTPS: Enabled (recommended)"
echo ""
echo -e "${CYAN}Certificate Location:${NC}"
echo "  Certificate: $CERT_FILE"
echo "  Private Key: $KEY_FILE"
echo ""
echo -e "${YELLOW}Note:${NC} Origin certificates are only trusted by Cloudflare."
echo "Direct server access will show certificate warnings (this is normal)."
echo ""

# Create a verification helper script
cat > "${INSTALL_DIR}/scripts/verify-ssl.sh" << 'VERIFY_EOF'
#!/bin/bash
# Quick SSL verification script

DOMAIN="${1:-gametaverns.com}"

echo "SSL Verification for: $DOMAIN"
echo "================================"
echo ""

echo "1. Nginx Config Test:"
nginx -t 2>&1 | head -2

echo ""
echo "2. Certificate Files:"
ls -la /etc/ssl/cloudflare/ 2>/dev/null || ls -la /etc/letsencrypt/live/*/ 2>/dev/null | head -5

echo ""
echo "3. Certificate Details:"
CERT_FILE="/etc/ssl/cloudflare/${DOMAIN}.pem"
[[ ! -f "$CERT_FILE" ]] && CERT_FILE="/etc/letsencrypt/live/${DOMAIN}/fullchain.pem"
if [[ -f "$CERT_FILE" ]]; then
    openssl x509 -in "$CERT_FILE" -noout -subject -dates -issuer 2>/dev/null
else
    echo "No certificate found"
fi

echo ""
echo "4. External HTTPS Test:"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "https://${DOMAIN}" 2>/dev/null)
echo "HTTP Status: $HTTP_CODE"

echo ""
echo "5. SSL Grade (via SSL Labs):"
echo "https://www.ssllabs.com/ssltest/analyze.html?d=${DOMAIN}"
VERIFY_EOF

chmod +x "${INSTALL_DIR}/scripts/verify-ssl.sh" 2>/dev/null || true

echo "Verification script created: ${INSTALL_DIR}/scripts/verify-ssl.sh"
echo ""
