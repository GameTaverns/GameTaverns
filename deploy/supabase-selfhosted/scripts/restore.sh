#!/bin/bash
# =============================================================================
# Restore Script for GameTaverns Self-Hosted
# Version: 2.2.0 - 5-Tier Role Hierarchy
# Last Audit: 2026-01-31
# =============================================================================

set -e

INSTALL_DIR="/opt/gametaverns"
BACKUP_DIR="/opt/gametaverns/backups"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Please run as root: sudo ./restore.sh${NC}"
    exit 1
fi

if [ ! -f "$INSTALL_DIR/.env" ]; then
    echo -e "${RED}Error: .env file not found${NC}"
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
echo "Available database backups:"
echo ""
if ls "$BACKUP_DIR"/database_*.sql.gz 1>/dev/null 2>&1; then
    ls -lht "$BACKUP_DIR"/database_*.sql.gz | head -10
else
    echo -e "${YELLOW}  No database backups found in $BACKUP_DIR${NC}"
    exit 1
fi
echo ""

# Allow passing backup date as argument
if [ -n "$1" ]; then
    BACKUP_DATE="$1"
else
    read -p "Enter backup date to restore (e.g., 20240115_120000): " BACKUP_DATE
fi

if [ -z "$BACKUP_DATE" ]; then
    echo -e "${RED}Error: No backup date provided${NC}"
    exit 1
fi

DB_BACKUP="$BACKUP_DIR/database_${BACKUP_DATE}.sql.gz"
STORAGE_BACKUP="$BACKUP_DIR/storage_${BACKUP_DATE}.tar.gz"
MAIL_BACKUP="$BACKUP_DIR/mail_${BACKUP_DATE}.tar.gz"

if [ ! -f "$DB_BACKUP" ]; then
    echo -e "${RED}Error: Database backup not found: $DB_BACKUP${NC}"
    exit 1
fi

echo ""
echo -e "${RED}WARNING: This will REPLACE the current database with the backup!${NC}"
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

# Drop existing connections first
docker compose exec -T db psql -U supabase_admin -d postgres -c \
    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'postgres' AND pid <> pg_backend_pid();" 2>/dev/null || true

# Restore database
if gunzip -c "$DB_BACKUP" | docker compose exec -T db psql -U supabase_admin -d postgres; then
    echo -e "${GREEN}  ✓ Database restored${NC}"
else
    echo -e "${RED}  ✗ Database restore failed${NC}"
    echo "Starting services anyway..."
fi

# Restore storage if backup exists
if [ -f "$STORAGE_BACKUP" ]; then
    echo ""
    echo "Restoring storage..."
    docker compose stop storage imgproxy 2>/dev/null || true
    
    STORAGE_VOLUME="gametaverns_storage-data"
    if docker volume inspect "$STORAGE_VOLUME" > /dev/null 2>&1; then
        if docker run --rm \
            -v "${STORAGE_VOLUME}":/data \
            -v "$BACKUP_DIR":/backup \
            alpine sh -c "rm -rf /data/* && tar -xzf /backup/storage_${BACKUP_DATE}.tar.gz -C /data"; then
            echo -e "${GREEN}  ✓ Storage restored${NC}"
        else
            echo -e "${YELLOW}  ⚠ Storage restore failed${NC}"
        fi
    fi
else
    echo -e "${YELLOW}  ⊘ No storage backup to restore${NC}"
fi

# Restore mail if backup exists
if [ -f "$MAIL_BACKUP" ]; then
    echo ""
    echo "Restoring mail data..."
    docker compose stop mail roundcube 2>/dev/null || true
    
    MAIL_VOLUME="gametaverns_mail-data"
    if docker volume inspect "$MAIL_VOLUME" > /dev/null 2>&1; then
        if docker run --rm \
            -v "${MAIL_VOLUME}":/data \
            -v "$BACKUP_DIR":/backup \
            alpine sh -c "rm -rf /data/* && tar -xzf /backup/mail_${BACKUP_DATE}.tar.gz -C /data"; then
            echo -e "${GREEN}  ✓ Mail data restored${NC}"
        else
            echo -e "${YELLOW}  ⚠ Mail restore failed${NC}"
        fi
    fi
else
    echo -e "${YELLOW}  ⊘ No mail backup to restore${NC}"
fi

echo ""
echo "Starting all services..."
docker compose up -d

# Wait for services to be healthy
echo "Waiting for services to start..."
sleep 10

echo ""
echo "=============================================="
echo -e "${GREEN}  Restore Complete!${NC}"
echo "=============================================="
echo ""
echo "Services are starting. Check status with:"
echo "  docker compose ps"
echo ""
echo "View logs:"
echo "  docker compose logs -f"
echo ""
