#!/bin/bash
# =============================================================================
# Run Database Migrations for GameTaverns Self-Hosted
# =============================================================================

set -e

INSTALL_DIR="/opt/gametaverns"
MIGRATIONS_DIR="$INSTALL_DIR/migrations"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

if [ ! -f "$INSTALL_DIR/.env" ]; then
    echo -e "${RED}Error: .env file not found. Run install.sh first.${NC}"
    exit 1
fi

# Source the .env file
set -a
source "$INSTALL_DIR/.env"
set +a

echo ""
echo "=============================================="
echo "  Running Database Migrations"
echo "=============================================="
echo ""

cd "$INSTALL_DIR"

# Wait for database to be ready
echo "Waiting for database to be ready..."
MAX_RETRIES=90
RETRY_COUNT=0

until docker compose exec -T db pg_isready -U supabase_admin -d postgres > /dev/null 2>&1; do
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
        echo -e "${RED}Error: Database not ready after $MAX_RETRIES attempts${NC}"
        echo "Check: docker compose logs db"
        exit 1
    fi
    echo "  Database not ready, waiting... ($RETRY_COUNT/$MAX_RETRIES)"
    sleep 2
done
echo -e "${GREEN}Database is ready!${NC}"
echo ""

# Ensure PostgreSQL has fully initialized (roles, etc)
sleep 3

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
)

SUCCESS_COUNT=0
WARNING_COUNT=0
SKIP_COUNT=0

for migration in "${MIGRATION_FILES[@]}"; do
    if [ -f "$MIGRATIONS_DIR/$migration" ]; then
        echo -n "Running: $migration ... "
        
        # Run migration and capture output
        OUTPUT=$(docker compose exec -T db psql -U supabase_admin -d postgres -f "/docker-entrypoint-initdb.d/$migration" 2>&1)
        EXIT_CODE=$?
        
        # Check for actual errors (not just notices)
        if [ $EXIT_CODE -eq 0 ]; then
            # Check if output contains ERROR (not just NOTICE)
            if echo "$OUTPUT" | grep -q "^ERROR:"; then
                echo -e "${YELLOW}⚠ Warning${NC}"
                echo "    $(echo "$OUTPUT" | grep "^ERROR:" | head -1)"
                ((WARNING_COUNT++))
            else
                echo -e "${GREEN}✓${NC}"
                ((SUCCESS_COUNT++))
            fi
        else
            echo -e "${YELLOW}⚠ Warning (exit code: $EXIT_CODE)${NC}"
            ((WARNING_COUNT++))
        fi
    else
        echo -e "${YELLOW}⚠ $migration not found, skipping${NC}"
        ((SKIP_COUNT++))
    fi
done

echo ""
echo "=============================================="
echo "  Migration Summary"
echo "=============================================="
echo ""
echo -e "  ${GREEN}✓ Successful:${NC} $SUCCESS_COUNT"
if [ $WARNING_COUNT -gt 0 ]; then
    echo -e "  ${YELLOW}⚠ Warnings:${NC}   $WARNING_COUNT (often OK for 'already exists')"
fi
if [ $SKIP_COUNT -gt 0 ]; then
    echo -e "  ⊘ Skipped:    $SKIP_COUNT"
fi
echo ""

# Verify key tables exist
echo "Verifying schema..."
TABLE_COUNT=$(docker compose exec -T db psql -U supabase_admin -d postgres -t -c \
    "SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('user_profiles', 'libraries', 'games', 'library_settings', 'achievements');" 2>/dev/null | tr -d ' ')

if [ "$TABLE_COUNT" = "5" ]; then
    echo -e "${GREEN}✓ Core tables verified${NC}"
else
    echo -e "${YELLOW}⚠ Expected 5 core tables, found: $TABLE_COUNT${NC}"
fi
echo ""
