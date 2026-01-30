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

source "$INSTALL_DIR/.env"

echo ""
echo "=============================================="
echo "  Running Database Migrations"
echo "=============================================="
echo ""

# Wait for database to be ready
echo "Waiting for database to be ready..."
until docker compose exec -T db pg_isready -U supabase_admin -d postgres > /dev/null 2>&1; do
    echo "  Database not ready, waiting..."
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
)

for migration in "${MIGRATION_FILES[@]}"; do
    if [ -f "$MIGRATIONS_DIR/$migration" ]; then
        echo "Running: $migration"
        docker compose exec -T db psql -U supabase_admin -d postgres -f "/docker-entrypoint-initdb.d/$migration"
        if [ $? -eq 0 ]; then
            echo "  ✓ Success"
        else
            echo "  ✗ Failed!"
            exit 1
        fi
    else
        echo "Warning: $migration not found, skipping..."
    fi
done

echo ""
echo "=============================================="
echo "  Migrations Complete!"
echo "=============================================="
echo ""
