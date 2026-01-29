#!/bin/bash
#
# GameTaverns Log Viewer
# Centralized log viewing and searching
#
# Usage: ./view-logs.sh [type] [options]
#
# Types:
#   api       - API server logs (PM2)
#   nginx     - Nginx access/error logs
#   db        - PostgreSQL logs
#   mail      - Postfix/Dovecot logs
#   system    - System logs (auth, syslog)
#   app       - Application logs
#   all       - All recent logs (default)
#
# Options:
#   -f, --follow    Follow log output (tail -f)
#   -n, --lines N   Show last N lines (default: 50)
#   -s, --search X  Search for pattern X
#   -e, --errors    Show only errors
#

set -e

INSTALL_DIR="/opt/gametaverns"
APP_LOG_DIR="${INSTALL_DIR}/logs"
LINES=50
FOLLOW=false
SEARCH=""
ERRORS_ONLY=false
LOG_TYPE="all"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        api|nginx|db|mail|system|app|all)
            LOG_TYPE="$1"
            shift
            ;;
        -f|--follow)
            FOLLOW=true
            shift
            ;;
        -n|--lines)
            LINES="$2"
            shift 2
            ;;
        -s|--search)
            SEARCH="$2"
            shift 2
            ;;
        -e|--errors)
            ERRORS_ONLY=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [type] [options]"
            echo ""
            echo "Types:"
            echo "  api       - API server logs (PM2)"
            echo "  nginx     - Nginx access/error logs"
            echo "  db        - PostgreSQL logs"
            echo "  mail      - Postfix/Dovecot logs"
            echo "  system    - System logs (auth, syslog)"
            echo "  app       - Application logs"
            echo "  all       - All recent logs (default)"
            echo ""
            echo "Options:"
            echo "  -f, --follow    Follow log output (tail -f)"
            echo "  -n, --lines N   Show last N lines (default: 50)"
            echo "  -s, --search X  Search for pattern X"
            echo "  -e, --errors    Show only errors"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# ═══════════════════════════════════════════════════════════════════
# Log Viewing Functions
# ═══════════════════════════════════════════════════════════════════

section() {
    echo ""
    echo -e "${CYAN}━━━ $1 ━━━${NC}"
    echo ""
}

view_log() {
    local file="$1"
    local label="$2"
    
    if [ ! -f "$file" ] && [ ! -d "$file" ]; then
        echo -e "${YELLOW}[SKIP]${NC} $label - not found"
        return
    fi
    
    echo -e "${BLUE}[$label]${NC} $file"
    
    if [ "$FOLLOW" = true ]; then
        if [ -n "$SEARCH" ]; then
            tail -f "$file" 2>/dev/null | grep --color=auto -i "$SEARCH"
        elif [ "$ERRORS_ONLY" = true ]; then
            tail -f "$file" 2>/dev/null | grep --color=auto -iE "(error|fail|critical|fatal|exception)"
        else
            tail -f "$file" 2>/dev/null
        fi
    else
        if [ -n "$SEARCH" ]; then
            tail -n "$LINES" "$file" 2>/dev/null | grep --color=auto -i "$SEARCH" || echo "(no matches)"
        elif [ "$ERRORS_ONLY" = true ]; then
            tail -n "$LINES" "$file" 2>/dev/null | grep --color=auto -iE "(error|fail|critical|fatal|exception)" || echo "(no errors found)"
        else
            tail -n "$LINES" "$file" 2>/dev/null
        fi
    fi
    
    echo ""
}

view_api_logs() {
    section "API Server Logs"
    
    if command -v pm2 &> /dev/null; then
        if [ "$FOLLOW" = true ]; then
            if [ -n "$SEARCH" ]; then
                pm2 logs gametaverns-api --lines "$LINES" 2>/dev/null | grep --color=auto -i "$SEARCH"
            elif [ "$ERRORS_ONLY" = true ]; then
                pm2 logs gametaverns-api --err --lines "$LINES" 2>/dev/null
            else
                pm2 logs gametaverns-api --lines "$LINES" 2>/dev/null
            fi
        else
            local log_output
            if [ "$ERRORS_ONLY" = true ]; then
                log_output=$(pm2 logs gametaverns-api --err --nostream --lines "$LINES" 2>/dev/null || echo "")
            else
                log_output=$(pm2 logs gametaverns-api --nostream --lines "$LINES" 2>/dev/null || echo "")
            fi
            
            if [ -n "$SEARCH" ]; then
                echo "$log_output" | grep --color=auto -i "$SEARCH" || echo "(no matches)"
            else
                echo "$log_output"
            fi
        fi
    else
        echo -e "${YELLOW}PM2 not found${NC}"
    fi
}

view_nginx_logs() {
    section "Nginx Logs"
    
    if [ "$ERRORS_ONLY" = true ]; then
        view_log "/var/log/nginx/gametaverns-error.log" "Nginx Error"
        view_log "/var/log/nginx/error.log" "Nginx Global Error"
    else
        view_log "/var/log/nginx/gametaverns-access.log" "Nginx Access"
        view_log "/var/log/nginx/gametaverns-error.log" "Nginx Error"
    fi
}

view_db_logs() {
    section "PostgreSQL Logs"
    
    local pg_log_dir="/var/log/postgresql"
    local latest_log=$(ls -t ${pg_log_dir}/postgresql-*.log 2>/dev/null | head -1)
    
    if [ -n "$latest_log" ]; then
        view_log "$latest_log" "PostgreSQL"
    else
        echo -e "${YELLOW}PostgreSQL logs not found${NC}"
    fi
}

view_mail_logs() {
    section "Mail Server Logs"
    
    view_log "/var/log/mail.log" "Mail"
    view_log "/var/log/dovecot.log" "Dovecot"
}

view_system_logs() {
    section "System Logs"
    
    if [ "$ERRORS_ONLY" = true ]; then
        echo -e "${BLUE}[Auth Failures]${NC}"
        journalctl -u ssh --since "24 hours ago" --no-pager -n "$LINES" 2>/dev/null | grep -iE "(fail|invalid|refused)" || echo "(none)"
        echo ""
        
        echo -e "${BLUE}[System Errors]${NC}"
        journalctl -p err --since "24 hours ago" --no-pager -n "$LINES" 2>/dev/null || echo "(none)"
    else
        echo -e "${BLUE}[Recent Auth]${NC}"
        journalctl -u ssh --since "1 hour ago" --no-pager -n "$LINES" 2>/dev/null || echo "(none)"
    fi
}

view_app_logs() {
    section "Application Logs"
    
    if [ -d "$APP_LOG_DIR" ]; then
        for log_file in "$APP_LOG_DIR"/*.log; do
            [ -f "$log_file" ] && view_log "$log_file" "$(basename "$log_file")"
        done
    else
        echo -e "${YELLOW}Application log directory not found${NC}"
    fi
}

view_all_logs() {
    echo ""
    echo -e "${BOLD}╔═══════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BOLD}║            GameTaverns Log Viewer                                 ║${NC}"
    echo -e "${BOLD}╚═══════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo "Showing last $LINES lines per log"
    [ -n "$SEARCH" ] && echo "Filter: '$SEARCH'"
    [ "$ERRORS_ONLY" = true ] && echo "Showing errors only"
    
    view_api_logs
    view_nginx_logs
    view_app_logs
}

# ═══════════════════════════════════════════════════════════════════
# Main
# ═══════════════════════════════════════════════════════════════════

case $LOG_TYPE in
    api)
        view_api_logs
        ;;
    nginx)
        view_nginx_logs
        ;;
    db)
        view_db_logs
        ;;
    mail)
        view_mail_logs
        ;;
    system)
        view_system_logs
        ;;
    app)
        view_app_logs
        ;;
    all|*)
        view_all_logs
        ;;
esac

if [ "$FOLLOW" = false ]; then
    echo ""
    echo -e "${BLUE}Tip:${NC} Use -f to follow logs in real-time"
    echo -e "     Use -e to show only errors"
    echo -e "     Use -s 'pattern' to search"
fi
