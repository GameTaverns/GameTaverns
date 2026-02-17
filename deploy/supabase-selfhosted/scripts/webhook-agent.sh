#!/bin/bash
# =============================================================================
# GameTaverns Webhook Agent
# Polls the server_commands table and executes scripts when triggered from
# the admin dashboard. Runs as a systemd service.
#
# Install: sudo cp webhook-agent.service /etc/systemd/system/
#          sudo systemctl daemon-reload
#          sudo systemctl enable --now gametaverns-agent
# =============================================================================

set -euo pipefail

INSTALL_DIR="/opt/gametaverns"
COMPOSE_DIR="$INSTALL_DIR/deploy/supabase-selfhosted"
SCRIPTS_DIR="$COMPOSE_DIR/scripts"
POLL_INTERVAL="${GT_AGENT_POLL_INTERVAL:-5}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Load environment
if [ ! -f "$INSTALL_DIR/.env" ]; then
    echo -e "${RED}Error: .env not found at $INSTALL_DIR/.env${NC}"
    exit 1
fi

set -a
source "$INSTALL_DIR/.env"
set +a

if [ -n "${POSTGRES_PASSWORD:-}" ]; then
    export PGPASSWORD="$POSTGRES_PASSWORD"
fi

# Helper: query via docker compose
db_query() {
    local result
    result=$(docker compose --env-file "$INSTALL_DIR/.env" -f "$COMPOSE_DIR/docker-compose.yml" \
      exec -T -e PGPASSWORD="${PGPASSWORD:-}" db \
      psql -U postgres -d postgres -tAc "$1" 2>/dev/null || echo "")
    echo "$result" | tr -d '[:space:][:cntrl:]'
}

db_cmd() {
    docker compose --env-file "$INSTALL_DIR/.env" -f "$COMPOSE_DIR/docker-compose.yml" \
      exec -T -e PGPASSWORD="${PGPASSWORD:-}" db \
      psql -U postgres -d postgres -c "$1" 2>&1
}

# Map script_id to actual command
get_script_command() {
    case "$1" in
        update)            echo "$SCRIPTS_DIR/update.sh" ;;
        backup)            echo "$SCRIPTS_DIR/backup.sh" ;;
        migrations)        echo "$SCRIPTS_DIR/run-migrations.sh" ;;
        restore)           echo "$SCRIPTS_DIR/restore.sh" ;;
        render-kong)       echo "$SCRIPTS_DIR/render-kong-config.sh" ;;
        setup-ssl)         echo "$SCRIPTS_DIR/setup-ssl.sh" ;;
        create-admin)      echo "$SCRIPTS_DIR/create-admin.sh" ;;
        preflight)         echo "$SCRIPTS_DIR/preflight-check.sh" ;;
        clean-install)     echo "$SCRIPTS_DIR/clean-install.sh" ;;
        nuclear-reset)     echo "BLOCKED" ;;
        rebuild-frontend)  echo "docker compose --env-file $INSTALL_DIR/.env -f $COMPOSE_DIR/docker-compose.yml build --no-cache app && docker compose --env-file $INSTALL_DIR/.env -f $COMPOSE_DIR/docker-compose.yml up -d app" ;;
        restart-functions) echo "docker compose --env-file $INSTALL_DIR/.env -f $COMPOSE_DIR/docker-compose.yml up -d --force-recreate --no-deps functions && docker compose --env-file $INSTALL_DIR/.env -f $COMPOSE_DIR/docker-compose.yml up -d --force-recreate --no-deps kong" ;;
        rebuild-server)    echo "docker compose --env-file $INSTALL_DIR/.env -f $COMPOSE_DIR/docker-compose.yml build --no-cache server && docker compose --env-file $INSTALL_DIR/.env -f $COMPOSE_DIR/docker-compose.yml up -d server" ;;
        *)                 echo "UNKNOWN" ;;
    esac
}

# Update command status in DB
update_status() {
    local cmd_id="$1"
    local status="$2"
    local output="${3:-}"
    local ts_field=""

    if [ "$status" = "running" ]; then
        ts_field=", started_at = now()"
    elif [ "$status" = "completed" ] || [ "$status" = "failed" ]; then
        ts_field=", completed_at = now()"
    fi

    # Escape single quotes in output
    local safe_output
    safe_output=$(echo "$output" | sed "s/'/''/g" | tail -c 50000)

    db_cmd "UPDATE public.server_commands SET status = '$status', output = '$safe_output' $ts_field WHERE id = '$cmd_id';" > /dev/null 2>&1
}

echo -e "${GREEN}GameTaverns Webhook Agent started${NC}"
echo -e "${BLUE}Polling every ${POLL_INTERVAL}s for commands...${NC}"

# Main polling loop
while true; do
    # Get oldest pending command
    PENDING=$(docker compose --env-file "$INSTALL_DIR/.env" -f "$COMPOSE_DIR/docker-compose.yml" \
      exec -T -e PGPASSWORD="${PGPASSWORD:-}" db \
      psql -U postgres -d postgres -tAc \
      "SELECT id || '|' || script_id FROM public.server_commands WHERE status = 'pending' ORDER BY created_at ASC LIMIT 1;" 2>/dev/null || echo "")
    PENDING=$(echo "$PENDING" | tr -d '[:cntrl:]' | xargs)

    if [ -n "$PENDING" ] && [ "$PENDING" != "" ]; then
        CMD_ID=$(echo "$PENDING" | cut -d'|' -f1)
        SCRIPT_ID=$(echo "$PENDING" | cut -d'|' -f2)

        echo ""
        echo -e "${BLUE}=== Command received: $SCRIPT_ID (ID: $CMD_ID) ===${NC}"

        SCRIPT_CMD=$(get_script_command "$SCRIPT_ID")

        if [ "$SCRIPT_CMD" = "BLOCKED" ]; then
            echo -e "${RED}Script $SCRIPT_ID is blocked from remote execution${NC}"
            update_status "$CMD_ID" "failed" "This script is blocked from remote execution for safety. Run it manually via SSH."
        elif [ "$SCRIPT_CMD" = "UNKNOWN" ]; then
            echo -e "${RED}Unknown script: $SCRIPT_ID${NC}"
            update_status "$CMD_ID" "failed" "Unknown script ID: $SCRIPT_ID"
        else
            update_status "$CMD_ID" "running" ""

            LOG_FILE="/tmp/gametaverns-cmd-${CMD_ID}.log"
            rm -f "$LOG_FILE"

            echo -e "${YELLOW}Running: $SCRIPT_CMD${NC}"

            set +e
            if [[ "$SCRIPT_CMD" == *"docker compose"* ]]; then
                # Inline docker commands
                bash -c "$SCRIPT_CMD" > "$LOG_FILE" 2>&1
                EXIT_CODE=$?
            else
                # Script file
                if [ -f "$SCRIPT_CMD" ]; then
                    bash "$SCRIPT_CMD" > "$LOG_FILE" 2>&1
                    EXIT_CODE=$?
                else
                    echo "Script not found: $SCRIPT_CMD" > "$LOG_FILE"
                    EXIT_CODE=1
                fi
            fi
            set -e

            OUTPUT=$(cat "$LOG_FILE" 2>/dev/null || echo "(no output)")

            if [ $EXIT_CODE -eq 0 ]; then
                echo -e "${GREEN}✓ Command completed successfully${NC}"
                update_status "$CMD_ID" "completed" "$OUTPUT"
            else
                echo -e "${RED}✗ Command failed (exit code: $EXIT_CODE)${NC}"
                update_status "$CMD_ID" "failed" "$OUTPUT"
            fi

            rm -f "$LOG_FILE"
        fi
    fi

    sleep "$POLL_INTERVAL"
done
