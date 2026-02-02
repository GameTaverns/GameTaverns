#!/bin/bash
#
# Backup Game Haven Database
#

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Load environment
if [ -f ../.env ]; then
    source ../.env
elif [ -f .env ]; then
    source .env
fi

BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/gamehaven_${TIMESTAMP}.sql"

# Create backup directory
mkdir -p "$BACKUP_DIR"

echo -e "${YELLOW}Creating backup...${NC}"

# Dump database using TCP connection (supabase_admin is the default superuser)
docker exec gamehaven-db pg_dump -h localhost -U supabase_admin -d postgres > "$BACKUP_FILE"

# Compress
gzip "$BACKUP_FILE"

echo -e "${GREEN}✓${NC} Backup created: ${BACKUP_FILE}.gz"

# Cleanup old backups (keep last 7)
ls -t ${BACKUP_DIR}/gamehaven_*.sql.gz 2>/dev/null | tail -n +8 | xargs -r rm

echo -e "${GREEN}✓${NC} Cleanup complete (keeping last 7 backups)"
