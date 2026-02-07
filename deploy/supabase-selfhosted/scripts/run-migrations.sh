#!/bin/bash
# =============================================================================
# Run Database Migrations for GameTaverns Self-Hosted
# Version: 2.3.2 - Schema Parity Audit
# Audited: 2026-02-02
# =============================================================================

set -e

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "Please run as root: sudo ./run-migrations.sh"
    exit 1
fi

INSTALL_DIR="/opt/gametaverns"
# Migrations + docker-compose.yml live together in deploy/supabase-selfhosted
COMPOSE_DIR="$INSTALL_DIR/deploy/supabase-selfhosted"
MIGRATIONS_DIR="$COMPOSE_DIR/migrations"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

if [ ! -f "$INSTALL_DIR/.env" ]; then
    echo -e "${RED}Error: .env file not found. Run install.sh first.${NC}"
    exit 1
fi

# Source the .env file
set -a
source "$INSTALL_DIR/.env"
set +a

# Some Postgres images require password auth even for local socket connections.
# The self-hosted stack stores the DB superuser password in POSTGRES_PASSWORD.
# We pass it explicitly to avoid psql hanging on an interactive password prompt.
if [ -n "${POSTGRES_PASSWORD:-}" ]; then
    export PGPASSWORD="$POSTGRES_PASSWORD"
fi

echo ""
echo "=============================================="
echo "  Running Database Migrations"
echo "=============================================="
echo ""

cd "$COMPOSE_DIR"

# Ensure docker compose is available
if ! docker compose version > /dev/null 2>&1; then
    echo -e "${RED}Error: docker compose not available${NC}"
    exit 1
fi

# Wait for database to be ready
echo -e "${BLUE}Waiting for database to be ready...${NC}"
MAX_RETRIES=90
RETRY_COUNT=0

until docker compose exec -T db pg_isready -U postgres -d postgres > /dev/null 2>&1; do
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
        echo -e "${RED}Error: Database not ready after $MAX_RETRIES attempts${NC}"
        echo ""
        echo "Troubleshooting:"
        echo "  1. Check container status: docker compose ps"
        echo "  2. Check database logs: docker compose logs db"
        exit 1
    fi
    echo "  Database not ready, waiting... ($RETRY_COUNT/$MAX_RETRIES)"
    sleep 2
done
echo -e "${GREEN}✓ Database is ready!${NC}"
echo ""

# Ensure PostgreSQL has fully initialized (roles, etc)
sleep 5

# Run migrations in order
MIGRATION_FILES=(
    "01-extensions.sql"
    "02-enums.sql"
    "03-core-tables.sql"
    "04-games-tables.sql"
    "05-events-polls.sql"
    "06-achievements-notifications.sql"
    "07-platform-admin.sql"
    "08-functions-triggers.sql"
    "09-views.sql"
    "10-rls-policies.sql"
    "11-seed-data.sql"
    "12-auth-trigger.sql"
    "13-storage-buckets.sql"
    "15-totp-2fa.sql"
    "16-security-hardening.sql"
    "17-rls-fixes-feb2026.sql"
    "18-storage-grants-fix.sql"
    "19-library-settings-insert-policy.sql"
    "20-featured-achievement.sql"
    "21-fix-libraries-recursion.sql"
)

SUCCESS_COUNT=0
WARNING_COUNT=0
SKIP_COUNT=0
ERROR_COUNT=0

for migration in "${MIGRATION_FILES[@]}"; do
    if [ -f "$MIGRATIONS_DIR/$migration" ]; then
        echo -n "Running: $migration ... "

        # Sanity check: confirm file is mounted into the db container
        if ! docker compose exec -T db sh -lc "test -f /docker-entrypoint-initdb.d/$migration"; then
            echo -e "${RED}✗ Error${NC}"
            echo "    Migration file is not visible inside db container: /docker-entrypoint-initdb.d/$migration"
            echo "    Host path checked: $MIGRATIONS_DIR/$migration"
            ERROR_COUNT=$((ERROR_COUNT + 1))
            continue
        fi

        # Run migration in background with fallback timeout
        LOG_FILE="/tmp/gametaverns-migration-${migration}.log"
        rm -f "$LOG_FILE"

        set +e
        # Run psql in background and capture PID
        docker compose exec -T -e PGPASSWORD="$PGPASSWORD" db \
          psql -v ON_ERROR_STOP=1 -U postgres -d postgres -f "/docker-entrypoint-initdb.d/$migration" \
          > "$LOG_FILE" 2>&1 &
        PSQL_PID=$!
        
        # Manual timeout: wait 90 seconds max
        TIMEOUT=90
        ELAPSED=0
        EXIT_CODE=0
        
        while kill -0 $PSQL_PID 2>/dev/null; do
            if [ $ELAPSED -ge $TIMEOUT ]; then
                echo -e "${RED}✗ Timeout (${TIMEOUT}s)${NC}"
                echo "    Migration did not complete within ${TIMEOUT} seconds"
                echo "    Last 20 log lines:"
                tail -n 20 "$LOG_FILE" 2>/dev/null || echo "    (no log output)"
                kill -9 $PSQL_PID 2>/dev/null || true
                ((ERROR_COUNT++))
                EXIT_CODE=124
                break
            fi
            sleep 1
            ((ELAPSED++))
            # Show progress every 10 seconds
            if [ $((ELAPSED % 10)) -eq 0 ]; then
                echo "  ... still running (${ELAPSED}s / ${TIMEOUT}s) ..."
            fi
        done
        
        # Get exit code if process finished naturally
        if [ $EXIT_CODE -ne 124 ]; then
            wait $PSQL_PID
            EXIT_CODE=$?
        fi
        set -e

        # Capture the last output lines for error reporting
        OUTPUT=$(tail -n 50 "$LOG_FILE" 2>/dev/null || true)
        
        # Check for actual errors (not just notices) - case insensitive
        if echo "$OUTPUT" | grep -qiE "^ERROR:|^FATAL:"; then
            ERROR_MSG=$(echo "$OUTPUT" | grep -iE "^ERROR:|^FATAL:" | head -1)
            # Check if it's a duplicate/exists warning
            if echo "$ERROR_MSG" | grep -qiE "already exists|duplicate|does not exist"; then
                echo -e "${YELLOW}⚠ Warning${NC}"
                echo "    $ERROR_MSG"
                WARNING_COUNT=$((WARNING_COUNT + 1))
            else
                echo -e "${RED}✗ Error${NC}"
                echo "    $ERROR_MSG"
                ERROR_COUNT=$((ERROR_COUNT + 1))
            fi
        elif [ $EXIT_CODE -ne 0 ]; then
            # Non-zero exit code but no ERROR in output
            if echo "$OUTPUT" | grep -qiE "already exists|duplicate"; then
                echo -e "${YELLOW}⚠ Warning (already exists)${NC}"
                WARNING_COUNT=$((WARNING_COUNT + 1))
            else
                echo -e "${RED}✗ Error (exit code: $EXIT_CODE)${NC}"
                echo "    $(echo "$OUTPUT" | tail -n 3 | tr '\n' ' ' | sed 's/  */ /g')"
                ERROR_COUNT=$((ERROR_COUNT + 1))
            fi
        else
            echo -e "${GREEN}✓${NC}"
            SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
        fi
    else
        echo -e "${YELLOW}⚠ $migration not found, skipping${NC}"
        SKIP_COUNT=$((SKIP_COUNT + 1))
    fi
done
echo "=============================================="
echo "  Migration Summary"
echo "=============================================="
echo ""
echo -e "  ${GREEN}✓ Successful:${NC}  $SUCCESS_COUNT"
if [ $WARNING_COUNT -gt 0 ]; then
    echo -e "  ${YELLOW}⚠ Warnings:${NC}    $WARNING_COUNT (often OK for 'already exists')"
fi
if [ $SKIP_COUNT -gt 0 ]; then
    echo -e "  ⊘ Skipped:     $SKIP_COUNT"
fi
if [ $ERROR_COUNT -gt 0 ]; then
    echo -e "  ${RED}✗ Errors:${NC}      $ERROR_COUNT"
fi
echo ""

# Verify key tables exist
echo -e "${BLUE}Verifying schema...${NC}"
TABLES=(
    "user_profiles"
    "libraries"
    "games"
    "library_settings"
    "achievements"
)

MISSING_TABLES=0
for table in "${TABLES[@]}"; do
    if docker compose exec -T db psql -U postgres -d postgres -tAc \
        "SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = '$table';" 2>/dev/null | grep -q 1; then
        echo -e "  ${GREEN}✓${NC} $table"
    else
        echo -e "  ${RED}✗${NC} $table (missing)"
        ((MISSING_TABLES++))
    fi
done

echo ""
if [ $MISSING_TABLES -eq 0 ]; then
    echo -e "${GREEN}✓ All core tables verified${NC}"
else
    echo -e "${RED}✗ $MISSING_TABLES core table(s) missing${NC}"
    exit 1
fi
echo ""
