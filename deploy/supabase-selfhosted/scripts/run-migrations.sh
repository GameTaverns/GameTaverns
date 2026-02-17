#!/bin/bash
# =============================================================================
# Run Database Migrations for GameTaverns Self-Hosted
# Version: 2.5.0 - Simplified: skip already-applied, only run new
# Audited: 2026-02-16
# =============================================================================

set -e

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "Please run as root: sudo ./run-migrations.sh"
    exit 1
fi

INSTALL_DIR="/opt/gametaverns"
COMPOSE_DIR="$INSTALL_DIR/deploy/supabase-selfhosted"
MIGRATIONS_DIR="$COMPOSE_DIR/migrations"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

if [ ! -f "$INSTALL_DIR/.env" ]; then
    echo -e "${RED}Error: .env file not found. Run install.sh first.${NC}"
    exit 1
fi

set -a
source "$INSTALL_DIR/.env"
set +a

if [ -n "${POSTGRES_PASSWORD:-}" ]; then
    export PGPASSWORD="$POSTGRES_PASSWORD"
fi

echo ""
echo "=============================================="
echo "  Running Database Migrations"
echo "=============================================="
echo ""

cd "$COMPOSE_DIR"

if ! docker compose version > /dev/null 2>&1; then
    echo -e "${RED}Error: docker compose not available${NC}"
    exit 1
fi

# Helper: run psql query, return clean output
db_query() {
    local raw
    raw=$(docker compose --env-file "$INSTALL_DIR/.env" -f "$COMPOSE_DIR/docker-compose.yml" \
      exec -T -e PGPASSWORD="${PGPASSWORD:-}" db \
      psql -U postgres -d postgres -tAc "$1" 2>/dev/null) || true
    echo "$raw" | tr -cd '[:print:]' | tr -d ' '
}

# Helper: run psql command
db_cmd() {
    docker compose --env-file "$INSTALL_DIR/.env" -f "$COMPOSE_DIR/docker-compose.yml" \
      exec -T -e PGPASSWORD="${PGPASSWORD:-}" db \
      psql -U postgres -d postgres -c "$1" 2>&1
}

# Wait for database
echo -e "${BLUE}Waiting for database to be ready...${NC}"
MAX_RETRIES=90
RETRY_COUNT=0
until docker compose --env-file "$INSTALL_DIR/.env" -f "$COMPOSE_DIR/docker-compose.yml" \
  exec -T db pg_isready -U postgres -d postgres > /dev/null 2>&1; do
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
        echo -e "${RED}Error: Database not ready after $MAX_RETRIES attempts${NC}"
        exit 1
    fi
    echo "  Database not ready, waiting... ($RETRY_COUNT/$MAX_RETRIES)"
    sleep 2
done
echo -e "${GREEN}✓ Database is ready!${NC}"
echo ""

sleep 3

# =============================================================================
# Detect existing vs fresh install
# =============================================================================
CORE_EXISTS=$(db_query "SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='libraries';")

if [ "$CORE_EXISTS" = "1" ]; then
    echo -e "${GREEN}✓ Existing installation detected — only running NEW migrations${NC}"
    echo ""

    # For existing installs, everything through 65 is already applied.
    # Only add NEW migrations here (66+) as they are created.
    MIGRATION_FILES=(
        # All migrations applied manually via CLI; add future migrations here only after testing
    )
else
    echo -e "${BLUE}Fresh installation detected — running all migrations${NC}"
    echo ""

    # Fresh install: run everything in order
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
        "21-designers-artists.sql"
        "22-forum-tables.sql"
        "23-notifications-realtime.sql"
        "24-seed-forum-categories.sql"
        "25-forum-postgrest-fix.sql"
        "26-achievements-sync.sql"
        "27-fix-forum-categories-rls.sql"
        "28-bgg-play-import.sql"
        "29-collection-value-tracking.sql"
        "30-group-challenges.sql"
        "31-trade-matching.sql"
        "32-player-color-column.sql"
        "33-theme-foreground-columns.sql"
        "34-fix-public-view-foreground.sql"
        "35-game-copies-inventory.sql"
        "36-fix-loan-trigger-enum.sql"
        "37-fix-loan-status-enums.sql"
        "38-lending-enhancements.sql"
        "39-clubs.sql"
        "40-announcement-banner-view.sql"
        "41-bgg-sync-config.sql"
        "42-import-type-column.sql"
        "43-system-logs-columns.sql"
        "44-bgg-community-rating.sql"
        "45-system-logs-rls-policies.sql"
        "46-import-jobs-admin-policies.sql"
        "47-import-skipped-column.sql"
        "48-is-unplayed-column.sql"
        "49-cleanup-stuck-imports-cron.sql"
        "50-game-catalog.sql"
        "51-shame-achievements.sql"
        "52-tour-achievement.sql"
        "53-club-forum-rls.sql"
        "54-seed-club-forum-categories.sql"
        "55-forum-subcategories.sql"
        "56-seed-library-forum-categories.sql"
        "57-seed-marketplace-subcategories.sql"
        "58-dedup-forum-categories.sql"
        "59-restructure-forum-categories.sql"
        "60-import-pause-resume.sql"
        "61-forum-categories-definitive.sql"
        "61-dashboard-layouts.sql"
        "62-server-commands.sql"
        "61-catalog-scraper.sql"
        "63-backfill-catalog-junctions.sql"
        "64-catalog-dedup.sql"
        "65-social-profiles.sql"
        "66-avatars-bucket.sql"
        "67-activity-events.sql"
        "68-activity-triggers.sql"
        "70-ratings-isolation.sql"
    )
fi

# =============================================================================
# Run migrations
# =============================================================================
SUCCESS_COUNT=0
WARNING_COUNT=0
SKIP_COUNT=0
ERROR_COUNT=0

for migration in "${MIGRATION_FILES[@]}"; do
    if [ ! -f "$MIGRATIONS_DIR/$migration" ]; then
        echo -e "${YELLOW}⚠ $migration not found, skipping${NC}"
        SKIP_COUNT=$((SKIP_COUNT + 1))
        continue
    fi

    echo -n "Running: $migration ... "

    LOG_FILE="/tmp/gametaverns-migration-${migration}.log"
    rm -f "$LOG_FILE"

    set +e
    timeout 90 docker compose --env-file "$INSTALL_DIR/.env" -f "$COMPOSE_DIR/docker-compose.yml" \
      exec -T -e PGPASSWORD="${PGPASSWORD:-}" db \
      psql -v ON_ERROR_STOP=1 -U postgres -d postgres -f "/docker-entrypoint-initdb.d/$migration" \
      > "$LOG_FILE" 2>&1
    EXIT_CODE=$?
    set -e

    OUTPUT=$(tail -n 50 "$LOG_FILE" 2>/dev/null || true)

    if [ $EXIT_CODE -eq 124 ]; then
        echo -e "${RED}✗ Timeout (90s)${NC}"
        ERROR_COUNT=$((ERROR_COUNT + 1))
    elif echo "$OUTPUT" | grep -qiE "^ERROR:|^FATAL:"; then
        ERROR_MSG=$(echo "$OUTPUT" | grep -iE "^ERROR:|^FATAL:" | head -1)
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

    rm -f "$LOG_FILE"
done

echo ""
echo "=============================================="
echo "  Migration Summary"
echo "=============================================="
echo ""
echo -e "  ${GREEN}✓ Successful:${NC}  $SUCCESS_COUNT"
if [ $WARNING_COUNT -gt 0 ]; then
    echo -e "  ${YELLOW}⚠ Warnings:${NC}    $WARNING_COUNT (often OK for 'already exists')"
fi
if [ $SKIP_COUNT -gt 0 ]; then
    echo -e "  ${BLUE}⊘ Skipped:${NC}     $SKIP_COUNT"
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
    TABLE_EXISTS=$(db_query "SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = '$table';")
    if [ "$TABLE_EXISTS" = "1" ]; then
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
