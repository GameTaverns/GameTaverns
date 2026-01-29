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

# Stop API
echo -e "${YELLOW}[INFO]${NC} Stopping API..."
pm2 stop gametaverns-api || true

# Drop and recreate database
echo -e "${YELLOW}[INFO]${NC} Recreating database..."
sudo -u postgres psql <<EOF
DROP DATABASE IF EXISTS ${DB_NAME};
CREATE DATABASE ${DB_NAME};
EOF

# Restore backup
echo -e "${YELLOW}[INFO]${NC} Restoring from backup..."
gunzip -c "$BACKUP_FILE" | sudo -u postgres psql -d ${DB_NAME}

# Start API
echo -e "${YELLOW}[INFO]${NC} Starting API..."
pm2 start gametaverns-api

echo ""
echo -e "${GREEN}[OK]${NC} Restore completed!"
echo ""
pm2 status gametaverns-api
