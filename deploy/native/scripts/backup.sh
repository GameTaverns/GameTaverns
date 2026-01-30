#!/bin/bash
#
# Backup GameTaverns database and uploads
#
# Usage: 
#   ./backup.sh           # Database only
#   ./backup.sh --full    # Database + uploads + mail config
#
# Backups are stored in /opt/gametaverns/backups/
# Retention: 7 days (database), 30 days (full)
#

set -e

INSTALL_DIR="/opt/gametaverns"
BACKUP_DIR="${INSTALL_DIR}/backups"
DB_NAME="gametaverns"
DATE=$(date +%Y%m%d_%H%M%S)
DB_RETENTION_DAYS=7
FULL_RETENTION_DAYS=30

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Quiet mode for cron
QUIET=false
FULL_BACKUP=false
for arg in "$@"; do
    case $arg in
        -q|--quiet) QUIET=true ;;
        --full) FULL_BACKUP=true ;;
    esac
done

log() {
    if [[ "$QUIET" == "false" ]]; then
        echo -e "$1"
    fi
}

if [[ "$QUIET" == "false" ]]; then
    echo ""
    echo "╔═══════════════════════════════════════════════════════════════════╗"
    echo "║          GameTaverns - Backup                                     ║"
    echo "╚═══════════════════════════════════════════════════════════════════╝"
    echo ""
fi

# Create backup directory
mkdir -p ${BACKUP_DIR}

# Database backup
log "${YELLOW}[INFO]${NC} Backing up database..."
if sudo -u postgres pg_dump ${DB_NAME} 2>/dev/null | gzip > "${BACKUP_DIR}/db_${DATE}.sql.gz"; then
    log "${GREEN}[OK]${NC} Database backup created"
else
    echo -e "${RED}[ERROR]${NC} Database backup failed!"
    exit 1
fi

# Full backup (optional)
if [[ "$FULL_BACKUP" == "true" ]]; then
    # Uploads
    if [[ -d "${INSTALL_DIR}/uploads" ]]; then
        log "${YELLOW}[INFO]${NC} Backing up uploads..."
        tar -czf "${BACKUP_DIR}/uploads_${DATE}.tar.gz" -C ${INSTALL_DIR} uploads 2>/dev/null || true
    fi
    
    # Mail config
    if [[ -f "/etc/postfix/vmailbox" ]]; then
        log "${YELLOW}[INFO]${NC} Backing up mail configuration..."
        tar -czf "${BACKUP_DIR}/mail_config_${DATE}.tar.gz" \
            /etc/postfix/vmailbox \
            /etc/postfix/virtual \
            /etc/dovecot/users \
            2>/dev/null || true
    fi
    
    # Environment file
    if [[ -f "${INSTALL_DIR}/.env" ]]; then
        log "${YELLOW}[INFO]${NC} Backing up configuration..."
        cp "${INSTALL_DIR}/.env" "${BACKUP_DIR}/env_${DATE}.backup"
        chmod 600 "${BACKUP_DIR}/env_${DATE}.backup"
    fi
fi

# Clean old backups
log "${YELLOW}[INFO]${NC} Cleaning old backups..."
find ${BACKUP_DIR} -name "db_*.sql.gz" -type f -mtime +${DB_RETENTION_DAYS} -delete 2>/dev/null || true
find ${BACKUP_DIR} -name "uploads_*.tar.gz" -type f -mtime +${FULL_RETENTION_DAYS} -delete 2>/dev/null || true
find ${BACKUP_DIR} -name "mail_config_*.tar.gz" -type f -mtime +${FULL_RETENTION_DAYS} -delete 2>/dev/null || true
find ${BACKUP_DIR} -name "env_*.backup" -type f -mtime +${FULL_RETENTION_DAYS} -delete 2>/dev/null || true

# Summary
if [[ "$QUIET" == "false" ]]; then
    BACKUP_SIZE=$(du -sh "${BACKUP_DIR}/db_${DATE}.sql.gz" 2>/dev/null | cut -f1 || echo "?")
    BACKUP_COUNT=$(ls -1 ${BACKUP_DIR}/db_*.sql.gz 2>/dev/null | wc -l || echo "0")
    
    echo ""
    echo -e "${GREEN}[OK]${NC} Backup completed!"
    echo ""
    echo "  Database: ${BACKUP_DIR}/db_${DATE}.sql.gz (${BACKUP_SIZE})"
    
    if [[ "$FULL_BACKUP" == "true" ]]; then
        [[ -f "${BACKUP_DIR}/uploads_${DATE}.tar.gz" ]] && echo "  Uploads:  ${BACKUP_DIR}/uploads_${DATE}.tar.gz"
        [[ -f "${BACKUP_DIR}/mail_config_${DATE}.tar.gz" ]] && echo "  Mail:     ${BACKUP_DIR}/mail_config_${DATE}.tar.gz"
        [[ -f "${BACKUP_DIR}/env_${DATE}.backup" ]] && echo "  Config:   ${BACKUP_DIR}/env_${DATE}.backup"
    fi
    
    echo ""
    echo "  Total backups: ${BACKUP_COUNT} (retention: ${DB_RETENTION_DAYS} days)"
    echo ""
    echo "To restore:"
    echo "  ./restore.sh ${BACKUP_DIR}/db_${DATE}.sql.gz"
    echo ""
fi
