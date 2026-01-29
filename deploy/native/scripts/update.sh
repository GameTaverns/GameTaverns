#!/bin/bash
#
# Update GameTaverns to the latest version
#
# Usage: ./update.sh
#

set -e

INSTALL_DIR="/opt/gametaverns"
APP_USER="gametaverns"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo ""
echo "╔═══════════════════════════════════════════════════════════════════╗"
echo "║          GameTaverns - Update                                    ║"
echo "╚═══════════════════════════════════════════════════════════════════╝"
echo ""

cd ${INSTALL_DIR}

# Create backup first
echo -e "${YELLOW}[INFO]${NC} Creating backup..."
./deploy/native/scripts/backup.sh

# Pull latest code
echo -e "${YELLOW}[INFO]${NC} Pulling latest code..."
git pull origin main

# Install frontend dependencies
echo -e "${YELLOW}[INFO]${NC} Installing frontend dependencies..."
npm ci

# Build frontend
echo -e "${YELLOW}[INFO]${NC} Building frontend..."
npm run build
cp -r dist/* ${INSTALL_DIR}/app/

# Install backend dependencies
echo -e "${YELLOW}[INFO]${NC} Installing backend dependencies..."
cd ${INSTALL_DIR}/server
npm ci

# Build backend
echo -e "${YELLOW}[INFO]${NC} Building backend..."
npm run build

# Run any new migrations
echo -e "${YELLOW}[INFO]${NC} Checking for new migrations..."
# Add migration logic here if needed

# Restart services
echo -e "${YELLOW}[INFO]${NC} Restarting services..."
pm2 restart gametaverns-api

# Clear Nginx cache
echo -e "${YELLOW}[INFO]${NC} Reloading Nginx..."
sudo systemctl reload nginx

echo ""
echo -e "${GREEN}[OK]${NC} Update completed!"
echo ""
pm2 status gametaverns-api
