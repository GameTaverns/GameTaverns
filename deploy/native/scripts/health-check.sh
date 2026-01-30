#!/bin/bash
#
# GameTaverns Health Check Script
# Comprehensive system status monitoring
#
# Usage: ./health-check.sh [--json] [--quiet]
#
# Options:
#   --json    Output as JSON (for monitoring systems)
#   --quiet   Only show failures (for cron alerts)
#

set -e

INSTALL_DIR="/opt/gametaverns"
API_PORT=3001
DB_NAME="gametaverns"
DB_USER="gametaverns"

# Parse arguments
JSON_OUTPUT=false
QUIET_MODE=false
for arg in "$@"; do
    case $arg in
        --json) JSON_OUTPUT=true ;;
        --quiet) QUIET_MODE=true ;;
    esac
done

# Colors (only if not JSON output)
if [ "$JSON_OUTPUT" = false ]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    BLUE='\033[0;34m'
    CYAN='\033[0;36m'
    BOLD='\033[1m'
    NC='\033[0m'
fi

# Status tracking
declare -A STATUS
OVERALL_STATUS="healthy"
WARNINGS=0
ERRORS=0

# ═══════════════════════════════════════════════════════════════════
# Check Functions
# ═══════════════════════════════════════════════════════════════════

check_service() {
    local service=$1
    local name=$2
    
    if systemctl is-active --quiet "$service" 2>/dev/null; then
        STATUS["$name"]="ok"
        return 0
    else
        STATUS["$name"]="error"
        ERRORS=$((ERRORS + 1))
        OVERALL_STATUS="unhealthy"
        return 1
    fi
}

check_api_health() {
    local response
    local http_code
    
    http_code=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${API_PORT}/health" 2>/dev/null || echo "000")
    
    if [ "$http_code" = "200" ]; then
        STATUS["api"]="ok"
        return 0
    elif [ "$http_code" = "000" ]; then
        STATUS["api"]="error"
        STATUS["api_detail"]="Connection refused"
        ERRORS=$((ERRORS + 1))
        OVERALL_STATUS="unhealthy"
        return 1
    else
        STATUS["api"]="error"
        STATUS["api_detail"]="HTTP $http_code"
        ERRORS=$((ERRORS + 1))
        OVERALL_STATUS="unhealthy"
        return 1
    fi
}

check_database() {
    if sudo -u postgres psql -d "$DB_NAME" -c "SELECT 1;" > /dev/null 2>&1; then
        STATUS["database"]="ok"
        
        # Get connection count
        local conn_count
        conn_count=$(sudo -u postgres psql -d "$DB_NAME" -tAc "SELECT count(*) FROM pg_stat_activity WHERE datname='${DB_NAME}';" 2>/dev/null || echo "0")
        STATUS["db_connections"]="$conn_count"
        
        # Get database size
        local db_size
        db_size=$(sudo -u postgres psql -d "$DB_NAME" -tAc "SELECT pg_size_pretty(pg_database_size('${DB_NAME}'));" 2>/dev/null || echo "unknown")
        STATUS["db_size"]="$db_size"
        
        return 0
    else
        STATUS["database"]="error"
        ERRORS=$((ERRORS + 1))
        OVERALL_STATUS="unhealthy"
        return 1
    fi
}

check_pm2() {
    if pm2 list 2>/dev/null | grep -q "gametaverns-api"; then
        local pm2_status
        pm2_status=$(pm2 jlist 2>/dev/null | grep -o '"name":"gametaverns-api"[^}]*"status":"[^"]*"' | grep -o '"status":"[^"]*"' | cut -d'"' -f4 || echo "unknown")
        
        if [ "$pm2_status" = "online" ]; then
            STATUS["pm2"]="ok"
            
            # Get uptime and memory
            local uptime
            uptime=$(pm2 jlist 2>/dev/null | grep -o '"pm_uptime":[0-9]*' | cut -d':' -f2 || echo "0")
            if [ "$uptime" != "0" ]; then
                local now=$(date +%s%3N)
                local uptime_seconds=$(( (now - uptime) / 1000 ))
                local uptime_days=$(( uptime_seconds / 86400 ))
                local uptime_hours=$(( (uptime_seconds % 86400) / 3600 ))
                STATUS["api_uptime"]="${uptime_days}d ${uptime_hours}h"
            fi
            
            local memory
            memory=$(pm2 jlist 2>/dev/null | grep -o '"monit":{"memory":[0-9]*' | cut -d':' -f3 || echo "0")
            if [ "$memory" != "0" ]; then
                STATUS["api_memory"]="$((memory / 1024 / 1024))MB"
            fi
            
            return 0
        else
            STATUS["pm2"]="error"
            STATUS["pm2_detail"]="Status: $pm2_status"
            ERRORS=$((ERRORS + 1))
            OVERALL_STATUS="unhealthy"
            return 1
        fi
    else
        STATUS["pm2"]="error"
        STATUS["pm2_detail"]="Process not found"
        ERRORS=$((ERRORS + 1))
        OVERALL_STATUS="unhealthy"
        return 1
    fi
}

check_disk_space() {
    local usage
    usage=$(df -h / | awk 'NR==2 {gsub("%",""); print $5}')
    STATUS["disk_usage"]="${usage}%"
    
    if [ "$usage" -gt 90 ]; then
        STATUS["disk"]="error"
        ERRORS=$((ERRORS + 1))
        OVERALL_STATUS="unhealthy"
        return 1
    elif [ "$usage" -gt 80 ]; then
        STATUS["disk"]="warning"
        WARNINGS=$((WARNINGS + 1))
        if [ "$OVERALL_STATUS" = "healthy" ]; then
            OVERALL_STATUS="degraded"
        fi
        return 0
    else
        STATUS["disk"]="ok"
        return 0
    fi
}

check_memory() {
    local mem_info
    mem_info=$(free -m | awk 'NR==2 {print $2,$3,$7}')
    local total=$(echo "$mem_info" | cut -d' ' -f1)
    local used=$(echo "$mem_info" | cut -d' ' -f2)
    local available=$(echo "$mem_info" | cut -d' ' -f3)
    local usage=$((used * 100 / total))
    
    STATUS["memory_usage"]="${usage}%"
    STATUS["memory_available"]="${available}MB"
    
    if [ "$usage" -gt 90 ]; then
        STATUS["memory"]="error"
        ERRORS=$((ERRORS + 1))
        OVERALL_STATUS="unhealthy"
        return 1
    elif [ "$usage" -gt 80 ]; then
        STATUS["memory"]="warning"
        WARNINGS=$((WARNINGS + 1))
        if [ "$OVERALL_STATUS" = "healthy" ]; then
            OVERALL_STATUS="degraded"
        fi
        return 0
    else
        STATUS["memory"]="ok"
        return 0
    fi
}

check_ssl_expiry() {
    local domain
    # Try to extract domain from SITE_URL (e.g., https://gametaverns.com -> gametaverns.com)
    domain=$(grep "SITE_URL=" "$INSTALL_DIR/.env" 2>/dev/null | cut -d'=' -f2 | tr -d '"' | sed 's|https://||;s|http://||' || echo "")
    
    if [ -z "$domain" ]; then
        STATUS["ssl"]="skipped"
        STATUS["ssl_detail"]="No domain configured"
        return 0
    fi
    
    local cert_file="/etc/letsencrypt/live/${domain}/fullchain.pem"
    
    if [ ! -f "$cert_file" ]; then
        STATUS["ssl"]="warning"
        STATUS["ssl_detail"]="No certificate found"
        WARNINGS=$((WARNINGS + 1))
        if [ "$OVERALL_STATUS" = "healthy" ]; then
            OVERALL_STATUS="degraded"
        fi
        return 0
    fi
    
    local expiry_date
    expiry_date=$(openssl x509 -enddate -noout -in "$cert_file" 2>/dev/null | cut -d'=' -f2)
    local expiry_epoch
    expiry_epoch=$(date -d "$expiry_date" +%s 2>/dev/null || echo "0")
    local now_epoch=$(date +%s)
    local days_left=$(( (expiry_epoch - now_epoch) / 86400 ))
    
    STATUS["ssl_expiry"]="${days_left} days"
    
    if [ "$days_left" -lt 7 ]; then
        STATUS["ssl"]="error"
        ERRORS=$((ERRORS + 1))
        OVERALL_STATUS="unhealthy"
        return 1
    elif [ "$days_left" -lt 30 ]; then
        STATUS["ssl"]="warning"
        WARNINGS=$((WARNINGS + 1))
        if [ "$OVERALL_STATUS" = "healthy" ]; then
            OVERALL_STATUS="degraded"
        fi
        return 0
    else
        STATUS["ssl"]="ok"
        return 0
    fi
}

check_backups() {
    local backup_dir="${INSTALL_DIR}/backups"
    
    if [ ! -d "$backup_dir" ]; then
        STATUS["backups"]="warning"
        STATUS["backup_detail"]="No backup directory"
        WARNINGS=$((WARNINGS + 1))
        if [ "$OVERALL_STATUS" = "healthy" ]; then
            OVERALL_STATUS="degraded"
        fi
        return 0
    fi
    
    local latest_backup
    latest_backup=$(find "$backup_dir" -name "*.gz" -type f -printf '%T@ %p\n' 2>/dev/null | sort -n | tail -1 | cut -d' ' -f2-)
    
    if [ -z "$latest_backup" ]; then
        STATUS["backups"]="warning"
        STATUS["backup_detail"]="No backups found"
        WARNINGS=$((WARNINGS + 1))
        if [ "$OVERALL_STATUS" = "healthy" ]; then
            OVERALL_STATUS="degraded"
        fi
        return 0
    fi
    
    local backup_age
    backup_age=$(( ($(date +%s) - $(stat -c %Y "$latest_backup")) / 86400 ))
    STATUS["backup_age"]="${backup_age} days"
    STATUS["backup_file"]="$(basename "$latest_backup")"
    
    if [ "$backup_age" -gt 7 ]; then
        STATUS["backups"]="warning"
        STATUS["backup_detail"]="Backup is ${backup_age} days old"
        WARNINGS=$((WARNINGS + 1))
        if [ "$OVERALL_STATUS" = "healthy" ]; then
            OVERALL_STATUS="degraded"
        fi
        return 0
    else
        STATUS["backups"]="ok"
        return 0
    fi
}

# ═══════════════════════════════════════════════════════════════════
# Run All Checks
# ═══════════════════════════════════════════════════════════════════

run_checks() {
    check_service "postgresql" "postgresql"
    check_service "nginx" "nginx"
    check_database
    check_pm2
    check_api_health
    check_disk_space
    check_memory
    check_ssl_expiry
    check_backups
    
    # Optional services (don't fail if not installed)
    if systemctl list-units --type=service | grep -q "postfix"; then
        check_service "postfix" "postfix"
    fi
    if systemctl list-units --type=service | grep -q "dovecot"; then
        check_service "dovecot" "dovecot"
    fi
    if systemctl list-units --type=service | grep -q "fail2ban"; then
        check_service "fail2ban" "fail2ban"
    fi
}

# ═══════════════════════════════════════════════════════════════════
# Output Functions
# ═══════════════════════════════════════════════════════════════════

output_json() {
    echo "{"
    echo "  \"status\": \"${OVERALL_STATUS}\","
    echo "  \"timestamp\": \"$(date -Iseconds)\","
    echo "  \"errors\": ${ERRORS},"
    echo "  \"warnings\": ${WARNINGS},"
    echo "  \"checks\": {"
    
    local first=true
    for key in "${!STATUS[@]}"; do
        if [ "$first" = true ]; then
            first=false
        else
            echo ","
        fi
        echo -n "    \"${key}\": \"${STATUS[$key]}\""
    done
    
    echo ""
    echo "  }"
    echo "}"
}

output_human() {
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    echo ""
    echo -e "${CYAN}╔═══════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║            GameTaverns Health Check                               ║${NC}"
    echo -e "${CYAN}╚═══════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${BLUE}Timestamp:${NC} $timestamp"
    echo ""
    
    # Overall status
    case $OVERALL_STATUS in
        "healthy")
            echo -e "${BOLD}Overall Status:${NC} ${GREEN}● HEALTHY${NC}"
            ;;
        "degraded")
            echo -e "${BOLD}Overall Status:${NC} ${YELLOW}◐ DEGRADED${NC} (${WARNINGS} warnings)"
            ;;
        "unhealthy")
            echo -e "${BOLD}Overall Status:${NC} ${RED}○ UNHEALTHY${NC} (${ERRORS} errors)"
            ;;
    esac
    echo ""
    
    echo -e "${BOLD}━━━ Core Services ━━━${NC}"
    print_status "PostgreSQL" "${STATUS[postgresql]}"
    print_status "Nginx" "${STATUS[nginx]}"
    print_status "PM2 (API)" "${STATUS[pm2]}" "${STATUS[pm2_detail]:-}"
    print_status "API Health" "${STATUS[api]}" "${STATUS[api_detail]:-}"
    echo ""
    
    echo -e "${BOLD}━━━ Database ━━━${NC}"
    print_status "Connection" "${STATUS[database]}"
    echo -e "  Connections: ${STATUS[db_connections]:-unknown}"
    echo -e "  Size: ${STATUS[db_size]:-unknown}"
    echo ""
    
    echo -e "${BOLD}━━━ API Process ━━━${NC}"
    echo -e "  Uptime: ${STATUS[api_uptime]:-unknown}"
    echo -e "  Memory: ${STATUS[api_memory]:-unknown}"
    echo ""
    
    echo -e "${BOLD}━━━ System Resources ━━━${NC}"
    print_status "Disk" "${STATUS[disk]}" "Usage: ${STATUS[disk_usage]}"
    print_status "Memory" "${STATUS[memory]}" "Usage: ${STATUS[memory_usage]}, Available: ${STATUS[memory_available]}"
    echo ""
    
    echo -e "${BOLD}━━━ Security ━━━${NC}"
    print_status "SSL Certificate" "${STATUS[ssl]}" "Expires in: ${STATUS[ssl_expiry]:-N/A}"
    if [ -n "${STATUS[fail2ban]}" ]; then
        print_status "Fail2ban" "${STATUS[fail2ban]}"
    fi
    echo ""
    
    echo -e "${BOLD}━━━ Backups ━━━${NC}"
    print_status "Backup Status" "${STATUS[backups]}" "${STATUS[backup_detail]:-}"
    if [ -n "${STATUS[backup_file]}" ]; then
        echo -e "  Latest: ${STATUS[backup_file]} (${STATUS[backup_age]} ago)"
    fi
    echo ""
    
    # Optional mail services
    if [ -n "${STATUS[postfix]}" ] || [ -n "${STATUS[dovecot]}" ]; then
        echo -e "${BOLD}━━━ Mail Services ━━━${NC}"
        [ -n "${STATUS[postfix]}" ] && print_status "Postfix" "${STATUS[postfix]}"
        [ -n "${STATUS[dovecot]}" ] && print_status "Dovecot" "${STATUS[dovecot]}"
        echo ""
    fi
}

print_status() {
    local name=$1
    local status=$2
    local detail=$3
    
    case $status in
        "ok")
            echo -e "  ${GREEN}✓${NC} $name"
            ;;
        "warning")
            echo -e "  ${YELLOW}!${NC} $name ${YELLOW}(warning)${NC}"
            ;;
        "error")
            echo -e "  ${RED}✗${NC} $name ${RED}(FAILED)${NC}"
            ;;
        "skipped")
            echo -e "  ${BLUE}○${NC} $name (skipped)"
            ;;
        *)
            echo -e "  ${BLUE}?${NC} $name (unknown)"
            ;;
    esac
    
    if [ -n "$detail" ] && [ "$detail" != "ok" ]; then
        echo -e "    └─ $detail"
    fi
}

output_quiet() {
    if [ "$OVERALL_STATUS" != "healthy" ]; then
        echo "GameTaverns Health: ${OVERALL_STATUS^^} - Errors: $ERRORS, Warnings: $WARNINGS"
        
        for key in "${!STATUS[@]}"; do
            if [ "${STATUS[$key]}" = "error" ]; then
                echo "  FAIL: $key"
            fi
        done
        
        exit 1
    fi
}

# ═══════════════════════════════════════════════════════════════════
# Main
# ═══════════════════════════════════════════════════════════════════

run_checks

if [ "$JSON_OUTPUT" = true ]; then
    output_json
elif [ "$QUIET_MODE" = true ]; then
    output_quiet
else
    output_human
fi

# Exit with appropriate code
if [ "$OVERALL_STATUS" = "unhealthy" ]; then
    exit 1
elif [ "$OVERALL_STATUS" = "degraded" ]; then
    exit 2
else
    exit 0
fi
