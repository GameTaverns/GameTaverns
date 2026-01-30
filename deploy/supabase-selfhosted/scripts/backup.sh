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

# Database backup
echo "Backing up database..."
if docker compose exec -T db pg_dump -U supabase_admin -d postgres \
    --no-owner --no-privileges 2>/dev/null \
    | gzip > "$BACKUP_DIR/database_${DATE}.sql.gz"; then
    echo "  ✓ Database backup complete"
else
    echo "  ✗ Database backup failed"
    exit 1
fi

# Storage backup (from named volume)
echo "Backing up storage..."
if docker run --rm \
    -v gametaverns_storage-data:/data:ro \
    -v "$BACKUP_DIR":/backup \
    alpine tar -czf /backup/storage_${DATE}.tar.gz -C /data . 2>/dev/null; then
    echo "  ✓ Storage backup complete"
else
    echo "  ⚠ Storage backup skipped (volume may not exist)"
fi

# Mail backup (from named volume)
echo "Backing up mail data..."
if docker run --rm \
    -v gametaverns_mail-data:/data:ro \
    -v "$BACKUP_DIR":/backup \
    alpine tar -czf /backup/mail_${DATE}.tar.gz -C /data . 2>/dev/null; then
    echo "  ✓ Mail backup complete"
else
    echo "  ⚠ Mail backup skipped (volume may not exist)"
fi

# Configuration backup
echo "Backing up configuration..."
tar -czf "$BACKUP_DIR/config_${DATE}.tar.gz" \
    -C "$INSTALL_DIR" .env kong.yml \
    --ignore-failed-read 2>/dev/null || true
echo "  ✓ Configuration backup complete"

# Cleanup old backups
echo ""
echo "Cleaning up backups older than $RETENTION_DAYS days..."
find "$BACKUP_DIR" -name "*.gz" -mtime +$RETENTION_DAYS -delete 2>/dev/null || true
echo "  ✓ Cleanup complete"

# Calculate backup size
BACKUP_SIZE=$(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1)

echo ""
echo "=============================================="
echo "  Backup Complete!"
echo "=============================================="
echo ""
echo "Location: $BACKUP_DIR"
echo "Total size: ${BACKUP_SIZE:-unknown}"
echo ""
echo "Files created:"
ls -lh "$BACKUP_DIR"/*_${DATE}.* 2>/dev/null || echo "  (none)"
echo ""
