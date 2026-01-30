#!/bin/bash
# =============================================================================
# Restore Script for GameTaverns Self-Hosted
# =============================================================================

set -e

INSTALL_DIR="/opt/gametaverns"
BACKUP_DIR="/opt/gametaverns/backups"

if [ ! -f "$INSTALL_DIR/.env" ]; then
    echo "Error: .env file not found"
    exit 1
fi

# Source the .env file
set -a
source "$INSTALL_DIR/.env"
set +a

echo ""
echo "=============================================="
echo "  GameTaverns Restore"
echo "=============================================="
echo ""

# List available backups
echo "Available backups:"
echo ""
ls -lht "$BACKUP_DIR"/database_*.sql.gz 2>/dev/null | head -10 || echo "  No database backups found"
echo ""

read -p "Enter backup date to restore (e.g., 20240115_120000): " BACKUP_DATE

if [ -z "$BACKUP_DATE" ]; then
    echo "Error: No backup date provided"
    exit 1
fi

DB_BACKUP="$BACKUP_DIR/database_${BACKUP_DATE}.sql.gz"
STORAGE_BACKUP="$BACKUP_DIR/storage_${BACKUP_DATE}.tar.gz"
MAIL_BACKUP="$BACKUP_DIR/mail_${BACKUP_DATE}.tar.gz"

if [ ! -f "$DB_BACKUP" ]; then
    echo "Error: Database backup not found: $DB_BACKUP"
    exit 1
fi

echo ""
echo "WARNING: This will REPLACE the current database with the backup!"
echo ""
read -p "Are you sure you want to continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Restore cancelled."
    exit 0
fi

cd "$INSTALL_DIR"

echo ""
echo "Stopping application services..."
docker compose stop app functions studio 2>/dev/null || true

echo ""
echo "Restoring database..."
# Drop existing connections and restore
docker compose exec -T db psql -U supabase_admin -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'postgres' AND pid <> pg_backend_pid();" 2>/dev/null || true

gunzip -c "$DB_BACKUP" | docker compose exec -T db psql -U supabase_admin -d postgres
echo "  ✓ Database restored"

# Restore storage if backup exists
if [ -f "$STORAGE_BACKUP" ]; then
    echo ""
    echo "Restoring storage..."
    # Stop storage service first
    docker compose stop storage imgproxy 2>/dev/null || true
    
    STORAGE_VOLUME="gametaverns_storage-data"
    # Restore to named volume
    docker run --rm \
        -v "${STORAGE_VOLUME}":/data \
        -v "$BACKUP_DIR":/backup \
        alpine sh -c "rm -rf /data/* && tar -xzf /backup/storage_${BACKUP_DATE}.tar.gz -C /data"
    echo "  ✓ Storage restored"
fi

# Restore mail if backup exists
if [ -f "$MAIL_BACKUP" ]; then
    echo ""
    echo "Restoring mail data..."
    docker compose stop mail roundcube 2>/dev/null || true
    
    MAIL_VOLUME="gametaverns_mail-data"
    docker run --rm \
        -v "${MAIL_VOLUME}":/data \
        -v "$BACKUP_DIR":/backup \
        alpine sh -c "rm -rf /data/* && tar -xzf /backup/mail_${BACKUP_DATE}.tar.gz -C /data"
    echo "  ✓ Mail data restored"
fi

echo ""
echo "Starting all services..."
docker compose up -d

echo ""
echo "=============================================="
echo "  Restore Complete!"
echo "=============================================="
echo ""
echo "Services are starting. Check status with:"
echo "  docker compose ps"
echo ""
