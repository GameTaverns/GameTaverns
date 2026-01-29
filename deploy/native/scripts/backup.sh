#!/bin/bash
#
# Backup GameTaverns database and uploads
#
# Usage: ./backup.sh [--full]
#   --full: Also backup uploads directory
#
# Retention: 7 days for database backups, 30 days for full backups
#

set -e

INSTALL_DIR="/opt/gametaverns"
BACKUP_DIR="${INSTALL_DIR}/backups"
DB_NAME="gametaverns"
DB_USER="gametaverns"
DATE=$(date +%Y%m%d_%H%M%S)
DB_RETENTION_DAYS=7
FULL_RETENTION_DAYS=30

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo ""
echo "╔═══════════════════════════════════════════════════════════════════╗"
echo "║          GameTaverns - Backup                                     ║"
echo "╚═══════════════════════════════════════════════════════════════════╝"
echo ""

# Create backup directory
mkdir -p ${BACKUP_DIR}

# Database backup
echo -e "${YELLOW}[INFO]${NC} Backing up database..."
if sudo -u postgres pg_dump ${DB_NAME} | gzip > "${BACKUP_DIR}/db_${DATE}.sql.gz"; then
    echo -e "${GREEN}[OK]${NC} Database backup created"
else
    echo -e "${RED}[ERROR]${NC} Database backup failed!"
    exit 1
fi

# Uploads backup (optional full backup)
if [[ "$1" == "--full" ]]; then
    echo -e "${YELLOW}[INFO]${NC} Backing up uploads..."
    tar -czf "${BACKUP_DIR}/uploads_${DATE}.tar.gz" -C ${INSTALL_DIR} uploads 2>/dev/null || true
    
    # Also backup mail config
    echo -e "${YELLOW}[INFO]${NC} Backing up mail configuration..."
    tar -czf "${BACKUP_DIR}/mail_config_${DATE}.tar.gz" \
        /etc/postfix/vmailbox \
        /etc/postfix/virtual \
        /etc/dovecot/users \
        2>/dev/null || true
fi

# Clean old backups
echo -e "${YELLOW}[INFO]${NC} Cleaning old backups..."
find ${BACKUP_DIR} -name "db_*.sql.gz" -type f -mtime +${DB_RETENTION_DAYS} -delete
find ${BACKUP_DIR} -name "uploads_*.tar.gz" -type f -mtime +${FULL_RETENTION_DAYS} -delete
find ${BACKUP_DIR} -name "mail_config_*.tar.gz" -type f -mtime +${FULL_RETENTION_DAYS} -delete

# Show backup info
BACKUP_SIZE=$(du -sh "${BACKUP_DIR}/db_${DATE}.sql.gz" | cut -f1)
BACKUP_COUNT=$(ls -1 ${BACKUP_DIR}/db_*.sql.gz 2>/dev/null | wc -l)

echo ""
echo -e "${GREEN}[OK]${NC} Backup completed!"
echo ""
echo "  Database: ${BACKUP_DIR}/db_${DATE}.sql.gz (${BACKUP_SIZE})"
if [[ "$1" == "--full" ]]; then
    if [[ -f "${BACKUP_DIR}/uploads_${DATE}.tar.gz" ]]; then
        UPLOAD_SIZE=$(du -sh "${BACKUP_DIR}/uploads_${DATE}.tar.gz" | cut -f1)
        echo "  Uploads:  ${BACKUP_DIR}/uploads_${DATE}.tar.gz (${UPLOAD_SIZE})"
    fi
    if [[ -f "${BACKUP_DIR}/mail_config_${DATE}.tar.gz" ]]; then
        MAIL_SIZE=$(du -sh "${BACKUP_DIR}/mail_config_${DATE}.tar.gz" | cut -f1)
        echo "  Mail:     ${BACKUP_DIR}/mail_config_${DATE}.tar.gz (${MAIL_SIZE})"
    fi
fi
echo ""
echo "  Total backups: ${BACKUP_COUNT} (retention: ${DB_RETENTION_DAYS} days)"
echo ""
echo "To restore database:"
echo "  ${INSTALL_DIR}/deploy/native/scripts/restore.sh ${BACKUP_DIR}/db_${DATE}.sql.gz"
echo ""
