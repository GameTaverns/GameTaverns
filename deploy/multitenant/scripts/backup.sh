#!/bin/bash

# ============================================
# Database Backup Script
# ============================================

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

# Load config
if [ -f ".env" ]; then
    source .env
fi

BACKUP_DIR="backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/gametaverns_${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

echo -e "${BLUE}=== GameTaverns Database Backup ===${NC}"
echo ""
echo "Creating backup: ${BACKUP_FILE}"
echo ""

# Dump database and compress
docker exec gametaverns-db pg_dump -U postgres gametaverns | gzip > "$BACKUP_FILE"

# Get file size
SIZE=$(du -h "$BACKUP_FILE" | cut -f1)

echo -e "${GREEN}✓ Backup complete: ${BACKUP_FILE} (${SIZE})${NC}"
echo ""

# Cleanup old backups (keep last 7 days)
echo "Cleaning up old backups..."
find "$BACKUP_DIR" -name "gametaverns_*.sql.gz" -mtime +7 -delete

echo -e "${GREEN}✓ Done${NC}"
