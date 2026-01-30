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

source "$INSTALL_DIR/.env"

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

echo ""
echo "Stopping services..."
cd "$INSTALL_DIR"
docker compose stop app functions

echo ""
echo "Restoring database..."
gunzip -c "$DB_BACKUP" | docker compose exec -T db psql -U supabase_admin -d postgres
echo "  ✓ Database restored"

# Restore storage if backup exists
if [ -f "$STORAGE_BACKUP" ]; then
    echo ""
    echo "Restoring storage..."
    rm -rf "$INSTALL_DIR/volumes/storage"
    tar -xzf "$STORAGE_BACKUP" -C "$INSTALL_DIR/volumes"
    echo "  ✓ Storage restored"
fi

# Restore mail if backup exists
if [ -f "$MAIL_BACKUP" ]; then
    echo ""
    echo "Restoring mail data..."
    rm -rf "$INSTALL_DIR/volumes/mail"
    tar -xzf "$MAIL_BACKUP" -C "$INSTALL_DIR/volumes"
    echo "  ✓ Mail data restored"
fi

echo ""
echo "Starting services..."
docker compose up -d

echo ""
echo "=============================================="
echo "  Restore Complete!"
echo "=============================================="
echo ""
echo "Services are starting. Check status with:"
echo "  docker compose ps"
echo ""
