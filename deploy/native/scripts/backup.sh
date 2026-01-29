#!/bin/bash
#
# Backup GameTaverns database and uploads
#
# Usage: ./backup.sh [--full]
#

set -e

INSTALL_DIR="/opt/gametaverns"
BACKUP_DIR="${INSTALL_DIR}/backups"
DB_NAME="gametaverns"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}[INFO]${NC} Starting backup..."

# Create backup directory
mkdir -p ${BACKUP_DIR}

# Database backup
echo -e "${YELLOW}[INFO]${NC} Backing up database..."
sudo -u postgres pg_dump ${DB_NAME} | gzip > "${BACKUP_DIR}/db_${DATE}.sql.gz"

# Uploads backup (optional full backup)
if [[ "$1" == "--full" ]]; then
    echo -e "${YELLOW}[INFO]${NC} Backing up uploads..."
    tar -czf "${BACKUP_DIR}/uploads_${DATE}.tar.gz" -C ${INSTALL_DIR} uploads
fi

# Clean old backups
echo -e "${YELLOW}[INFO]${NC} Cleaning old backups (>${RETENTION_DAYS} days)..."
find ${BACKUP_DIR} -name "*.gz" -type f -mtime +${RETENTION_DAYS} -delete

# Show backup size
BACKUP_SIZE=$(du -sh "${BACKUP_DIR}/db_${DATE}.sql.gz" | cut -f1)

echo ""
echo -e "${GREEN}[OK]${NC} Backup completed!"
echo "  Database: ${BACKUP_DIR}/db_${DATE}.sql.gz (${BACKUP_SIZE})"
if [[ "$1" == "--full" ]]; then
    UPLOAD_SIZE=$(du -sh "${BACKUP_DIR}/uploads_${DATE}.tar.gz" | cut -f1)
    echo "  Uploads:  ${BACKUP_DIR}/uploads_${DATE}.tar.gz (${UPLOAD_SIZE})"
fi
echo ""
echo "To restore: gunzip -c ${BACKUP_DIR}/db_${DATE}.sql.gz | psql -d ${DB_NAME}"
