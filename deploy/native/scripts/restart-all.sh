#!/bin/bash
#
# Restart all GameTaverns services
#
# Usage: ./restart-all.sh
#

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo ""
echo "╔═══════════════════════════════════════════════════════════════════╗"
echo "║          GameTaverns - Restart All Services                       ║"
echo "╚═══════════════════════════════════════════════════════════════════╝"
echo ""

# Restart PM2 apps
echo -e "${YELLOW}[INFO]${NC} Restarting API..."
if pm2 restart gametaverns-api 2>/dev/null; then
    echo -e "${GREEN}[OK]${NC} API restarted"
else
    echo -e "${RED}[WARN]${NC} API not found in PM2"
fi

# Reload Nginx
echo -e "${YELLOW}[INFO]${NC} Reloading Nginx..."
if sudo systemctl reload nginx 2>/dev/null; then
    echo -e "${GREEN}[OK]${NC} Nginx reloaded"
else
    echo -e "${RED}[WARN]${NC} Nginx reload failed"
fi

# Restart Postfix
echo -e "${YELLOW}[INFO]${NC} Restarting Postfix..."
if sudo systemctl restart postfix 2>/dev/null; then
    echo -e "${GREEN}[OK]${NC} Postfix restarted"
else
    echo -e "${YELLOW}[WARN]${NC} Postfix not installed or not running"
fi

# Restart Dovecot
echo -e "${YELLOW}[INFO]${NC} Restarting Dovecot..."
if sudo systemctl restart dovecot 2>/dev/null; then
    echo -e "${GREEN}[OK]${NC} Dovecot restarted"
else
    echo -e "${YELLOW}[WARN]${NC} Dovecot not installed or not running"
fi

echo ""
echo -e "${GREEN}[OK]${NC} All services restarted!"
echo ""

# Show status
pm2 status 2>/dev/null || true
