#!/bin/bash
#
# Restart all GameTaverns services
#
# Usage: ./restart-all.sh
#

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}[INFO]${NC} Restarting all services..."

# Restart PM2 apps
echo -e "${YELLOW}[INFO]${NC} Restarting API..."
pm2 restart gametaverns-api

# Reload Nginx
echo -e "${YELLOW}[INFO]${NC} Reloading Nginx..."
sudo systemctl reload nginx

# Restart Postfix
echo -e "${YELLOW}[INFO]${NC} Restarting Postfix..."
sudo systemctl restart postfix

echo ""
echo -e "${GREEN}[OK]${NC} All services restarted!"
echo ""

# Show status
pm2 status
echo ""
systemctl status nginx --no-pager -l | head -5
echo ""
systemctl status postfix --no-pager -l | head -5
