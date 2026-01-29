#!/bin/bash

# ============================================
# Database Restore Script
# ============================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

if [ -z "$1" ]; then
    echo "Usage: $0 <backup-file>"
    echo ""
    echo "Available backups:"
    ls -la backups/*.sql.gz 2>/dev/null || echo "  No backups found"
    exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
    echo -e "${RED}✗ Backup file not found: ${BACKUP_FILE}${NC}"
    exit 1
fi

echo -e "${BLUE}=== GameTaverns Database Restore ===${NC}"
echo ""
echo -e "${YELLOW}WARNING: This will overwrite all current data!${NC}"
echo ""
echo "Backup file: ${BACKUP_FILE}"
echo ""
read -p "Are you sure you want to continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Restore cancelled."
    exit 0
fi

echo ""
echo -e "${BLUE}Stopping API service...${NC}"
docker compose stop api

echo -e "${BLUE}Restoring database...${NC}"

# Drop and recreate database
docker exec -i gametaverns-db psql -U postgres << EOF
SELECT pg_terminate_backend(pg_stat_activity.pid)
FROM pg_stat_activity
WHERE pg_stat_activity.datname = 'gametaverns'
  AND pid <> pg_backend_pid();

DROP DATABASE IF EXISTS gametaverns;
CREATE DATABASE gametaverns;
EOF

# Restore from backup
if [[ "$BACKUP_FILE" == *.gz ]]; then
    gunzip -c "$BACKUP_FILE" | docker exec -i gametaverns-db psql -U postgres -d gametaverns
else
    docker exec -i gametaverns-db psql -U postgres -d gametaverns < "$BACKUP_FILE"
fi

echo -e "${BLUE}Starting API service...${NC}"
docker compose start api

echo ""
echo -e "${GREEN}✓ Database restored successfully!${NC}"
