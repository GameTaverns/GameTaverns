#!/bin/bash
#
# Restore GameTaverns from backup
#
# Usage: ./restore.sh <backup_file.sql.gz>
#

set -e

INSTALL_DIR="/opt/gametaverns"
DB_NAME="gametaverns"
DB_USER="gametaverns"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check arguments
if [[ -z "$1" ]]; then
    echo ""
    echo -e "${RED}[ERROR]${NC} No backup file specified"
    echo ""
    echo "Usage: $0 <backup_file.sql.gz>"
    echo ""
    echo "Available backups:"
    ls -lh ${INSTALL_DIR}/backups/*.sql.gz 2>/dev/null | awk '{print "  " $NF " (" $5 ")"}' || echo "  No backups found"
    echo ""
    exit 1
fi

BACKUP_FILE="$1"

# Handle relative paths
if [[ ! "$BACKUP_FILE" = /* ]]; then
    # Check if it's just a filename in the backups dir
    if [[ -f "${INSTALL_DIR}/backups/${BACKUP_FILE}" ]]; then
        BACKUP_FILE="${INSTALL_DIR}/backups/${BACKUP_FILE}"
    fi
fi

if [[ ! -f "$BACKUP_FILE" ]]; then
    echo -e "${RED}[ERROR]${NC} File not found: $BACKUP_FILE"
    exit 1
fi

echo ""
echo "╔═══════════════════════════════════════════════════════════════════╗"
echo "║          GameTaverns - Restore from Backup                        ║"
echo "╚═══════════════════════════════════════════════════════════════════╝"
echo ""
echo "Backup file: $BACKUP_FILE"
echo "File size:   $(du -h "$BACKUP_FILE" | cut -f1)"
echo ""
echo -e "${YELLOW}⚠ WARNING: This will REPLACE the current database!${NC}"
echo ""
read -p "Type 'yes' to confirm: " CONFIRM

if [[ "$CONFIRM" != "yes" ]]; then
    echo "Cancelled."
    exit 0
fi

echo ""

# Stop API
echo -e "${YELLOW}[INFO]${NC} Stopping API..."
pm2 stop gametaverns-api 2>/dev/null || true

# Terminate existing connections and recreate database
echo -e "${YELLOW}[INFO]${NC} Recreating database..."
sudo -u postgres psql -q <<EOF
SELECT pg_terminate_backend(pg_stat_activity.pid)
FROM pg_stat_activity
WHERE pg_stat_activity.datname = '${DB_NAME}'
  AND pid <> pg_backend_pid();

DROP DATABASE IF EXISTS ${DB_NAME};
CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};
EOF

# Restore backup
echo -e "${YELLOW}[INFO]${NC} Restoring data (this may take a moment)..."
gunzip -c "$BACKUP_FILE" | sudo -u postgres psql -q -d ${DB_NAME}

# Re-grant permissions
echo -e "${YELLOW}[INFO]${NC} Setting permissions..."
sudo -u postgres psql -q -d ${DB_NAME} <<EOF
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ${DB_USER};
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ${DB_USER};
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO ${DB_USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ${DB_USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ${DB_USER};
EOF

# Start API
echo -e "${YELLOW}[INFO]${NC} Starting API..."
pm2 start gametaverns-api

# Wait and verify
sleep 3

if curl -s http://localhost:3001/health > /dev/null 2>&1; then
    echo ""
    echo -e "${GREEN}[OK]${NC} Restore completed successfully!"
else
    echo ""
    echo -e "${YELLOW}[WARN]${NC} Restore completed. API starting..."
    echo "Check: pm2 logs gametaverns-api"
fi

echo ""
pm2 status gametaverns-api
