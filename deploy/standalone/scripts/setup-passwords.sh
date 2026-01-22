#!/bin/bash
#
# Setup database passwords for Supabase internal roles
# This runs after the DB is healthy to set passwords from .env
#

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/.."

if [ ! -f .env ]; then
    echo "Error: .env file not found"
    exit 1
fi

# shellcheck disable=SC1091
source .env

if [ -z "$POSTGRES_PASSWORD" ]; then
    echo "Error: POSTGRES_PASSWORD not set in .env"
    exit 1
fi

echo "Setting up database passwords..."

# Wait for DB to be ready
for i in {1..30}; do
    if docker exec gamehaven-db pg_isready -U supabase_admin -d postgres >/dev/null 2>&1; then
        break
    fi
    if [ $i -eq 30 ]; then
        echo "Error: Database not ready"
        exit 1
    fi
    sleep 1
done

# Set passwords for all Supabase internal roles
docker exec -i gamehaven-db psql -U supabase_admin -d postgres << EOSQL
-- Set passwords for internal roles
ALTER ROLE supabase_auth_admin WITH PASSWORD '${POSTGRES_PASSWORD}';
ALTER ROLE authenticator WITH PASSWORD '${POSTGRES_PASSWORD}';
ALTER ROLE supabase_storage_admin WITH PASSWORD '${POSTGRES_PASSWORD}';

-- Ensure permissions are correct
ALTER ROLE supabase_auth_admin WITH SUPERUSER CREATEDB CREATEROLE;
GRANT ALL ON SCHEMA public TO supabase_auth_admin;
GRANT ALL ON SCHEMA public TO supabase_storage_admin;

-- Ensure role grants
GRANT anon TO authenticator;
GRANT authenticated TO authenticator;
GRANT service_role TO authenticator;
EOSQL

echo "Database passwords configured successfully"
