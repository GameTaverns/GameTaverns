#!/bin/bash
#
# Update GameTaverns to the latest version
#
# Usage: sudo ./update.sh
# Version: 2.3.0 - 2FA & Security Hardening
#

set -e

INSTALL_DIR="/opt/gametaverns"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo ""
echo "╔═══════════════════════════════════════════════════════════════════╗"
echo "║          GameTaverns - Update                                     ║"
echo "╚═══════════════════════════════════════════════════════════════════╝"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Please run as root: sudo ./update.sh${NC}"
    exit 1
fi

# Check we're in the right place
if [[ ! -d "${INSTALL_DIR}" ]]; then
    echo -e "${RED}[ERROR]${NC} Installation not found at ${INSTALL_DIR}"
    exit 1
fi

cd "${INSTALL_DIR}"

# Configure git safe directory to avoid ownership errors
git config --global --add safe.directory "${INSTALL_DIR}" 2>/dev/null || true

# Check for uncommitted changes
if [[ -n "$(git status --porcelain 2>/dev/null)" ]]; then
    echo -e "${YELLOW}[WARN]${NC} Local changes detected. Stashing..."
    git stash push -m "Auto-stash before update $(date +%Y%m%d-%H%M%S)"
fi

# Create backup first
echo -e "${YELLOW}[INFO]${NC} Creating backup before update..."
if [[ -x "${INSTALL_DIR}/deploy/native/scripts/backup.sh" ]]; then
    if ! "${INSTALL_DIR}/deploy/native/scripts/backup.sh"; then
        echo -e "${YELLOW}[WARN]${NC} Backup had issues but continuing with update"
    fi
else
    echo -e "${YELLOW}[WARN]${NC} Backup script not found, skipping backup"
fi

# Pause any active import jobs so they aren't killed mid-processing
echo -e "${YELLOW}[INFO]${NC} Pausing active import jobs..."
PAUSED_COUNT=$(sudo -u postgres psql -d gametaverns -tAc \
  "UPDATE public.import_jobs SET status = 'paused', error_message = 'Paused for system update' WHERE status = 'processing' RETURNING id;" 2>/dev/null | wc -l)
PAUSED_COUNT=$(echo "$PAUSED_COUNT" | tr -d ' ')
if [ "$PAUSED_COUNT" -gt 0 ]; then
    echo -e "${GREEN}[OK]${NC} Paused ${PAUSED_COUNT} active import job(s)"
else
    echo -e "${GREEN}[OK]${NC} No active imports to pause"
fi

# Pull latest code
echo -e "${YELLOW}[INFO]${NC} Pulling latest code..."
git config --global --add safe.directory "${INSTALL_DIR}" 2>/dev/null || true
git fetch origin
git reset --hard origin/main

# Install frontend dependencies (clean install for production)
echo -e "${YELLOW}[INFO]${NC} Installing frontend dependencies..."
npm ci --silent 2>/dev/null || npm install --silent

# Build frontend
echo -e "${YELLOW}[INFO]${NC} Building frontend..."
NODE_OPTIONS="--max-old-space-size=2048" npm run build

# Copy to app directory
echo -e "${YELLOW}[INFO]${NC} Deploying frontend..."
mkdir -p ${INSTALL_DIR}/app
cp -r dist/* ${INSTALL_DIR}/app/

# Inject runtime config for self-hosted mode
echo -e "${YELLOW}[INFO]${NC} Injecting runtime configuration..."
bash ${INSTALL_DIR}/deploy/native/scripts/rebuild-config.sh

# Install backend dependencies (clean install for production)
echo -e "${YELLOW}[INFO]${NC} Installing backend dependencies..."
cd ${INSTALL_DIR}/server
npm ci --silent 2>/dev/null || npm install --silent

# Build backend
echo -e "${YELLOW}[INFO]${NC} Building backend..."
npm run build

# Run database migrations
echo -e "${YELLOW}[INFO]${NC} Applying database migrations..."
if [[ -f "${INSTALL_DIR}/deploy/native/migrations/01-schema.sql" ]]; then
    # Run migrations idempotently (CREATE IF NOT EXISTS, etc.)
    if sudo -u postgres psql -d gametaverns -f ${INSTALL_DIR}/deploy/native/migrations/01-schema.sql > /dev/null 2>&1; then
        echo -e "${GREEN}[OK]${NC} Database schema applied"
    else
        echo -e "${YELLOW}[WARN]${NC} Schema migration had warnings (may be normal for existing tables)"
    fi
fi

# Apply 2FA migration if exists
if [[ -f "${INSTALL_DIR}/deploy/native/migrations/02-totp-2fa.sql" ]]; then
    if sudo -u postgres psql -d gametaverns -f ${INSTALL_DIR}/deploy/native/migrations/02-totp-2fa.sql > /dev/null 2>&1; then
        echo -e "${GREEN}[OK]${NC} 2FA migration applied"
    else
        echo -e "${YELLOW}[WARN]${NC} 2FA migration had warnings (may be normal for existing tables)"
    fi
fi

# Verify critical tables exist
REQUIRED_TABLES=("users" "libraries" "games" "library_members" "game_loans" "achievements" "user_totp_settings")
MISSING_TABLES=()

for table in "${REQUIRED_TABLES[@]}"; do
    if ! sudo -u postgres psql -d gametaverns -tAc "SELECT 1 FROM pg_tables WHERE tablename='${table}' AND schemaname='public';" 2>/dev/null | grep -q 1; then
        MISSING_TABLES+=("$table")
    fi
done

if [ ${#MISSING_TABLES[@]} -gt 0 ]; then
    echo -e "${RED}[ERROR]${NC} Missing required tables: ${MISSING_TABLES[*]}"
    echo "Please check migration logs or run migrations manually."
fi

# Restart API
echo -e "${YELLOW}[INFO]${NC} Restarting API..."
pm2 restart gametaverns-api

# Reload Nginx
echo -e "${YELLOW}[INFO]${NC} Reloading Nginx..."
sudo systemctl reload nginx

# Wait and verify
sleep 3

if curl -s http://localhost:3001/health > /dev/null 2>&1; then
    echo ""
    echo -e "${GREEN}[OK]${NC} Update completed successfully!"
    echo ""
    echo "Version: $(git describe --tags 2>/dev/null || git rev-parse --short HEAD)"
    
    # Resume paused import jobs
    if [ "$PAUSED_COUNT" -gt 0 ] 2>/dev/null; then
        echo ""
        echo -e "${YELLOW}[INFO]${NC} Resuming ${PAUSED_COUNT} paused import job(s)..."
        # The resume endpoint re-triggers paused imports
        RESUME_RESULT=$(curl -s -X POST http://localhost:3001/functions/v1/resume-imports \
          -H "Content-Type: application/json" \
          -H "Authorization: Bearer $(grep SERVICE_ROLE_KEY /opt/gametaverns/.env 2>/dev/null | cut -d= -f2)" \
          -d '{}' 2>/dev/null || echo '{"error":"resume call failed"}')
        echo -e "${GREEN}[OK]${NC} Resume result: ${RESUME_RESULT}"
    fi
else
    echo ""
    echo -e "${YELLOW}[WARN]${NC} Update completed but API may still be starting."
    echo "Check logs: pm2 logs gametaverns-api"
fi

echo ""
pm2 status gametaverns-api
