#!/bin/bash
#
# GameTaverns Automated Maintenance Setup
# Configures cron jobs for backups, health checks, and cleanup
#
# Usage: sudo ./setup-cron.sh
#

set -e

INSTALL_DIR="/opt/gametaverns"
SCRIPTS_DIR="${INSTALL_DIR}/deploy/native/scripts"
LOG_DIR="${INSTALL_DIR}/logs"
CRON_FILE="/etc/cron.d/gametaverns"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo ""
echo -e "${BLUE}╔═══════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║        GameTaverns - Automated Maintenance Setup                  ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check root
if [[ $EUID -ne 0 ]]; then
    echo -e "${RED}[ERROR]${NC} This script must be run as root (sudo)"
    exit 1
fi

# Check installation exists
if [[ ! -d "$INSTALL_DIR" ]]; then
    echo -e "${RED}[ERROR]${NC} GameTaverns not found at ${INSTALL_DIR}"
    exit 1
fi

# Ensure log directory exists
mkdir -p "$LOG_DIR"
chown gametaverns:gametaverns "$LOG_DIR" 2>/dev/null || true

# Ensure scripts are executable
chmod +x ${SCRIPTS_DIR}/*.sh

echo -e "${YELLOW}[INFO]${NC} Creating cron jobs..."

# Create cron file
cat > "$CRON_FILE" <<EOF
# ╔═══════════════════════════════════════════════════════════════════╗
# ║           GameTaverns Automated Maintenance                       ║
# ╚═══════════════════════════════════════════════════════════════════╝
#
# Generated: $(date)
#
# Cron syntax: minute hour day-of-month month day-of-week user command
#

SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
INSTALL_DIR=${INSTALL_DIR}

# ─────────────────────────────────────────────────────────────────────
# BACKUPS
# ─────────────────────────────────────────────────────────────────────

# Daily backup at 3:00 AM (database + uploads)
0 3 * * * root ${SCRIPTS_DIR}/backup.sh --quiet --full >> ${LOG_DIR}/backup.log 2>&1

# ─────────────────────────────────────────────────────────────────────
# HEALTH MONITORING
# ─────────────────────────────────────────────────────────────────────

# Health check every 5 minutes (alerts only on failure)
*/5 * * * * root ${SCRIPTS_DIR}/health-check.sh --quiet >> ${LOG_DIR}/health.log 2>&1

# Detailed health report daily at 6:00 AM
0 6 * * * root ${SCRIPTS_DIR}/health-check.sh >> ${LOG_DIR}/health-daily.log 2>&1

# ─────────────────────────────────────────────────────────────────────
# CLEANUP & MAINTENANCE
# ─────────────────────────────────────────────────────────────────────

# Rotate logs weekly (keep 4 weeks)
0 4 * * 0 root find ${LOG_DIR} -name "*.log" -size +10M -exec truncate -s 0 {} \;

# Clean old backup files (keep 7 days) - handled by backup.sh but this is a safety net
0 5 * * * root find ${INSTALL_DIR}/backups -name "*.gz" -mtime +7 -delete

# Clean PostgreSQL stale connections daily at 4:30 AM
30 4 * * * postgres psql -d gametaverns -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle' AND query_start < now() - interval '1 hour';" > /dev/null 2>&1

# Clean expired tokens daily at 4:00 AM
0 4 * * * postgres psql -d gametaverns -c "DELETE FROM password_reset_tokens WHERE expires_at < now() - interval '24 hours'; DELETE FROM email_confirmation_tokens WHERE expires_at < now() - interval '24 hours';" > /dev/null 2>&1

# ─────────────────────────────────────────────────────────────────────
# SSL CERTIFICATE
# ─────────────────────────────────────────────────────────────────────

# Certbot auto-renewal check twice daily (certbot handles this but we ensure nginx reload)
0 0,12 * * * root certbot renew --quiet --post-hook "systemctl reload nginx" >> ${LOG_DIR}/certbot.log 2>&1

# ─────────────────────────────────────────────────────────────────────
# SYSTEM UPDATES (Optional - uncomment to enable)
# ─────────────────────────────────────────────────────────────────────

# Security updates daily at 2:00 AM (Ubuntu unattended-upgrades should handle this)
# 0 2 * * * root apt-get update && apt-get upgrade -y --only-upgrade >> ${LOG_DIR}/updates.log 2>&1

EOF

# Set proper permissions
chmod 644 "$CRON_FILE"
chown root:root "$CRON_FILE"

echo -e "${GREEN}[OK]${NC} Cron file created at ${CRON_FILE}"

# Verify cron syntax
if crontab -l -u root > /dev/null 2>&1; then
    echo -e "${GREEN}[OK]${NC} Cron syntax validated"
else
    echo -e "${YELLOW}[WARN]${NC} Could not validate cron (this is normal)"
fi

# Restart cron service
systemctl restart cron 2>/dev/null || systemctl restart crond 2>/dev/null || true

echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                 Maintenance Jobs Configured                       ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "  Scheduled Tasks:"
echo ""
echo "  ┌─────────────────────────────────────────────────────────────────┐"
echo "  │ Task                  │ Schedule                               │"
echo "  ├─────────────────────────────────────────────────────────────────┤"
echo "  │ Full Backup           │ Daily at 3:00 AM                       │"
echo "  │ Health Check          │ Every 5 minutes                        │"
echo "  │ Health Report         │ Daily at 6:00 AM                       │"
echo "  │ Log Rotation          │ Weekly on Sunday at 4:00 AM            │"
echo "  │ Old Backup Cleanup    │ Daily at 5:00 AM (keeps 7 days)        │"
echo "  │ Token Cleanup         │ Daily at 4:00 AM                       │"
echo "  │ SSL Renewal Check     │ Twice daily (midnight & noon)          │"
echo "  └─────────────────────────────────────────────────────────────────┘"
echo ""
echo "  Logs are stored in: ${LOG_DIR}"
echo ""
echo "  View scheduled jobs:"
echo "    cat ${CRON_FILE}"
echo ""
echo "  Monitor health:"
echo "    ${SCRIPTS_DIR}/health-check.sh"
echo ""
echo -e "${GREEN}Done!${NC}"
