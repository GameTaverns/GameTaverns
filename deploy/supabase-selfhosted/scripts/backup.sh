#!/bin/bash
# =============================================================================
# Backup Script for GameTaverns Self-Hosted
# =============================================================================

set -e

INSTALL_DIR="/opt/gametaverns"
BACKUP_DIR="/opt/gametaverns/backups"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=${1:-7}  # Allow override via argument

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

if [ ! -f "$INSTALL_DIR/.env" ]; then
    echo -e "${RED}Error: .env file not found${NC}"
    exit 1
fi

# Source the .env file
set -a
source "$INSTALL_DIR/.env"
set +a

mkdir -p "$BACKUP_DIR"

echo ""
echo "=============================================="
echo "  GameTaverns Backup"
echo "  Date: $(date)"
echo "=============================================="
echo ""

cd "$INSTALL_DIR"

# Check if docker compose is running
if ! docker compose ps --status running 2>/dev/null | grep -q "db"; then
    echo -e "${YELLOW}Warning: Database container may not be running${NC}"
    echo "Attempting backup anyway..."
fi

# Database backup
echo "Backing up database..."
if docker compose exec -T db pg_dump -U supabase_admin -d postgres \
    --no-owner --no-privileges --clean --if-exists 2>/dev/null \
    | gzip > "$BACKUP_DIR/database_${DATE}.sql.gz"; then
    
    # Verify backup is not empty
    if [ -s "$BACKUP_DIR/database_${DATE}.sql.gz" ]; then
        echo -e "${GREEN}  ✓ Database backup complete${NC}"
    else
        echo -e "${RED}  ✗ Database backup empty - check database status${NC}"
        rm -f "$BACKUP_DIR/database_${DATE}.sql.gz"
        exit 1
    fi
else
    echo -e "${RED}  ✗ Database backup failed${NC}"
    exit 1
fi

# Storage backup (from named volume - project name is 'gametaverns')
echo "Backing up storage..."
STORAGE_VOLUME="gametaverns_storage-data"
if docker volume inspect "$STORAGE_VOLUME" > /dev/null 2>&1; then
    if docker run --rm \
        -v "${STORAGE_VOLUME}":/data:ro \
        -v "$BACKUP_DIR":/backup \
        alpine tar -czf /backup/storage_${DATE}.tar.gz -C /data . 2>/dev/null; then
        echo -e "${GREEN}  ✓ Storage backup complete${NC}"
    else
        echo -e "${YELLOW}  ⚠ Storage backup failed (non-critical)${NC}"
    fi
else
    echo -e "${YELLOW}  ⚠ Storage backup skipped (volume $STORAGE_VOLUME not found)${NC}"
fi

# Mail backup (from named volume)
echo "Backing up mail data..."
MAIL_VOLUME="gametaverns_mail-data"
if docker volume inspect "$MAIL_VOLUME" > /dev/null 2>&1; then
    if docker run --rm \
        -v "${MAIL_VOLUME}":/data:ro \
        -v "$BACKUP_DIR":/backup \
        alpine tar -czf /backup/mail_${DATE}.tar.gz -C /data . 2>/dev/null; then
        echo -e "${GREEN}  ✓ Mail backup complete${NC}"
    else
        echo -e "${YELLOW}  ⚠ Mail backup failed (non-critical)${NC}"
    fi
else
    echo -e "${YELLOW}  ⚠ Mail backup skipped (volume $MAIL_VOLUME not found)${NC}"
fi

# Configuration backup
echo "Backing up configuration..."
tar -czf "$BACKUP_DIR/config_${DATE}.tar.gz" \
    -C "$INSTALL_DIR" .env kong.yml \
    --ignore-failed-read 2>/dev/null || true
echo -e "${GREEN}  ✓ Configuration backup complete${NC}"

# Cleanup old backups
echo ""
echo "Cleaning up backups older than $RETENTION_DAYS days..."
DELETED=$(find "$BACKUP_DIR" -name "*.gz" -mtime +$RETENTION_DAYS -delete -print 2>/dev/null | wc -l)
echo -e "${GREEN}  ✓ Removed $DELETED old backup files${NC}"

# Calculate backup size
BACKUP_SIZE=$(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1)

echo ""
echo "=============================================="
echo -e "${GREEN}  Backup Complete!${NC}"
echo "=============================================="
echo ""
echo "Location: $BACKUP_DIR"
echo "Total size: ${BACKUP_SIZE:-unknown}"
echo ""
echo "Files created:"
ls -lh "$BACKUP_DIR"/*_${DATE}.* 2>/dev/null || echo "  (none)"
echo ""
