#!/bin/bash
# =============================================================================
# Run Database Migrations for GameTaverns Self-Hosted
# =============================================================================

set -e

INSTALL_DIR="/opt/gametaverns"
MIGRATIONS_DIR="$INSTALL_DIR/migrations"

if [ ! -f "$INSTALL_DIR/.env" ]; then
    echo "Error: .env file not found. Run install.sh first."
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
MAX_RETRIES=60
RETRY_COUNT=0

until docker compose exec -T db pg_isready -U supabase_admin -d postgres > /dev/null 2>&1; do
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
        echo "Error: Database not ready after $MAX_RETRIES attempts"
        exit 1
    fi
    echo "  Database not ready, waiting... ($RETRY_COUNT/$MAX_RETRIES)"
    sleep 2
done
echo "Database is ready!"
echo ""

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

ERRORS=0
for migration in "${MIGRATION_FILES[@]}"; do
    if [ -f "$MIGRATIONS_DIR/$migration" ]; then
        echo "Running: $migration"
        if docker compose exec -T db psql -U supabase_admin -d postgres -f "/docker-entrypoint-initdb.d/$migration" 2>&1; then
            echo "  ✓ Success"
        else
            echo "  ⚠ Warning (may be OK for existing objects)"
            ERRORS=$((ERRORS + 1))
        fi
    else
        echo "Warning: $migration not found, skipping..."
    fi
done

echo ""
echo "=============================================="
if [ $ERRORS -eq 0 ]; then
    echo "  Migrations Complete! All successful."
else
    echo "  Migrations Complete! ($ERRORS warnings)"
    echo "  Warnings are often OK for 'already exists' errors."
fi
echo "=============================================="
echo ""
