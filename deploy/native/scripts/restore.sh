#!/bin/bash
#
# Restore GameTaverns from backup
#
# Usage: ./restore.sh <backup_file.sql.gz>
#

set -e

INSTALL_DIR="/opt/gametaverns"
DB_NAME="gametaverns"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

if [[ -z "$1" ]]; then
    echo -e "${RED}[ERROR]${NC} Usage: $0 <backup_file.sql.gz>"
    echo ""
    echo "Available backups:"
    ls -la ${INSTALL_DIR}/backups/*.sql.gz 2>/dev/null || echo "  No backups found"
    exit 1
fi

BACKUP_FILE="$1"

if [[ ! -f "$BACKUP_FILE" ]]; then
    echo -e "${RED}[ERROR]${NC} Backup file not found: $BACKUP_FILE"
    exit 1
fi

echo ""
echo "╔═══════════════════════════════════════════════════════════════════╗"
echo "║          GameTaverns - Restore from Backup                       ║"
echo "╚═══════════════════════════════════════════════════════════════════╝"
echo ""
echo -e "${YELLOW}WARNING: This will overwrite the current database!${NC}"
read -p "Are you sure? (type 'yes' to confirm): " CONFIRM

if [[ "$CONFIRM" != "yes" ]]; then
    echo "Restore cancelled."
    exit 0
fi

# Load credentials
CREDENTIALS_FILE="/root/gametaverns-credentials.txt"
if [[ -f "$CREDENTIALS_FILE" ]]; then
    source "$CREDENTIALS_FILE"
fi

# Stop API
echo -e "${YELLOW}[INFO]${NC} Stopping API..."
pm2 stop gametaverns-api 2>/dev/null || true

# Drop and recreate database (preserve user ownership)
echo -e "${YELLOW}[INFO]${NC} Recreating database..."
sudo -u postgres psql <<EOF
-- Terminate existing connections
SELECT pg_terminate_backend(pg_stat_activity.pid)
FROM pg_stat_activity
WHERE pg_stat_activity.datname = '${DB_NAME}'
  AND pid <> pg_backend_pid();

DROP DATABASE IF EXISTS ${DB_NAME};
CREATE DATABASE ${DB_NAME} OWNER gametaverns;
EOF

# Restore backup
echo -e "${YELLOW}[INFO]${NC} Restoring from backup..."
gunzip -c "$BACKUP_FILE" | sudo -u postgres psql -d ${DB_NAME}

# Re-grant permissions
echo -e "${YELLOW}[INFO]${NC} Restoring permissions..."
sudo -u postgres psql -d ${DB_NAME} <<EOF
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO gametaverns;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO gametaverns;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO gametaverns;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO gametaverns;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO gametaverns;
EOF

# Start API
echo -e "${YELLOW}[INFO]${NC} Starting API..."
pm2 start gametaverns-api

sleep 3

# Verify
if curl -s http://localhost:3001/health > /dev/null 2>&1; then
    echo ""
    echo -e "${GREEN}[OK]${NC} Restore completed successfully!"
else
    echo ""
    echo -e "${YELLOW}[WARN]${NC} Restore completed but API may not be responding yet."
    echo "Check logs: pm2 logs gametaverns-api"
fi
echo ""
pm2 status gametaverns-api
