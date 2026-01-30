#!/bin/bash
# =============================================================================
# Backup Script for GameTaverns Self-Hosted
# =============================================================================

set -e

INSTALL_DIR="/opt/gametaverns"
BACKUP_DIR="/opt/gametaverns/backups"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=7

if [ ! -f "$INSTALL_DIR/.env" ]; then
    echo "Error: .env file not found"
    exit 1
fi

source "$INSTALL_DIR/.env"

mkdir -p "$BACKUP_DIR"

echo ""
echo "=============================================="
echo "  GameTaverns Backup"
echo "  Date: $(date)"
echo "=============================================="
echo ""

# Database backup
echo "Backing up database..."
docker compose exec -T db pg_dump -U supabase_admin -d postgres \
    --no-owner --no-privileges \
    | gzip > "$BACKUP_DIR/database_${DATE}.sql.gz"
echo "  ✓ Database backup complete"

# Storage backup
echo "Backing up storage..."
if [ -d "$INSTALL_DIR/volumes/storage" ]; then
    tar -czf "$BACKUP_DIR/storage_${DATE}.tar.gz" -C "$INSTALL_DIR/volumes" storage
    echo "  ✓ Storage backup complete"
fi

# Mail backup
echo "Backing up mail data..."
if [ -d "$INSTALL_DIR/volumes/mail" ]; then
    tar -czf "$BACKUP_DIR/mail_${DATE}.tar.gz" -C "$INSTALL_DIR/volumes" mail
    echo "  ✓ Mail backup complete"
fi

# Configuration backup
echo "Backing up configuration..."
tar -czf "$BACKUP_DIR/config_${DATE}.tar.gz" \
    -C "$INSTALL_DIR" .env \
    --ignore-failed-read 2>/dev/null || true
echo "  ✓ Configuration backup complete"

# Cleanup old backups
echo ""
echo "Cleaning up backups older than $RETENTION_DAYS days..."
find "$BACKUP_DIR" -name "*.gz" -mtime +$RETENTION_DAYS -delete
echo "  ✓ Cleanup complete"

# Calculate backup size
BACKUP_SIZE=$(du -sh "$BACKUP_DIR" | cut -f1)

echo ""
echo "=============================================="
echo "  Backup Complete!"
echo "=============================================="
echo ""
echo "Location: $BACKUP_DIR"
echo "Total size: $BACKUP_SIZE"
echo ""
echo "Files created:"
ls -lh "$BACKUP_DIR"/*_${DATE}.* 2>/dev/null || echo "  (none)"
echo ""
