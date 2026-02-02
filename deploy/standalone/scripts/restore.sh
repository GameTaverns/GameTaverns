#!/bin/bash
#
# Restore Game Haven Database from Backup
#

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

if [ -z "$1" ]; then
    echo "Usage: $0 <backup-file.sql.gz>"
    echo ""
    echo "Available backups:"
    ls -la ./backups/*.sql.gz 2>/dev/null || echo "  No backups found"
    exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
    echo -e "${RED}Error: Backup file not found: $BACKUP_FILE${NC}"
    exit 1
fi

echo -e "${YELLOW}⚠ WARNING: This will overwrite all existing data!${NC}"
read -p "Are you sure? (type 'yes' to confirm): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Aborted."
    exit 0
fi

echo -e "${YELLOW}Restoring from $BACKUP_FILE...${NC}"

# Decompress and restore (use supabase_admin which is the default superuser)
gunzip -c "$BACKUP_FILE" | docker exec -i gamehaven-db psql -h localhost -U supabase_admin -d postgres

echo -e "${GREEN}✓${NC} Database restored successfully!"
