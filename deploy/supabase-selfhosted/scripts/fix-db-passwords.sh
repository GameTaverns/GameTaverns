#!/bin/bash
# =============================================================================
# GameTaverns Self-Hosted: Fix Database Role Passwords
# 
# This script sets passwords for all Supabase internal roles to match
# POSTGRES_PASSWORD from .env. Run this if services (PostgREST, Auth, Storage)
# fail to connect to the database with "password authentication failed" errors.
#
# Usage: ./scripts/fix-db-passwords.sh
# =============================================================================

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Find script directory and navigate to install dir
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

# Load environment
if [ -f .env ]; then
    # shellcheck disable=SC1091
    source .env
else
    echo -e "${RED}Error: .env file not found in $(pwd)${NC}"
    exit 1
fi

if [ -z "$POSTGRES_PASSWORD" ]; then
    echo -e "${RED}Error: POSTGRES_PASSWORD not set in .env${NC}"
    exit 1
fi

echo -e "${YELLOW}Fixing database role passwords...${NC}"

# Wait for DB to be ready
echo -n "Waiting for database to be ready... "
for i in {1..30}; do
    if docker compose exec -T db pg_isready -U supabase_admin -d postgres >/dev/null 2>&1; then
        echo -e "${GREEN}ready${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}timeout${NC}"
        echo "Database not ready. Check: docker compose logs db"
        exit 1
    fi
    sleep 1
done

# Escape single quotes in password for SQL
ESCAPED_PW=$(printf '%s' "$POSTGRES_PASSWORD" | sed "s/'/''/g")

# Set passwords for all Supabase internal roles
docker compose exec -T db psql -U supabase_admin -d postgres << EOSQL
-- =============================================================================
-- Create roles if they don't exist (fresh install safety)
-- =============================================================================
DO \$\$
BEGIN
  -- authenticator role (used by PostgREST)
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticator') THEN
    CREATE ROLE authenticator WITH LOGIN NOINHERIT;
    RAISE NOTICE 'Created role: authenticator';
  END IF;
  
  -- anon role (anonymous access)
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
    RAISE NOTICE 'Created role: anon';
  END IF;
  
  -- authenticated role
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
    RAISE NOTICE 'Created role: authenticated';
  END IF;
  
  -- service_role (bypasses RLS)
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
    RAISE NOTICE 'Created role: service_role';
  END IF;
  
  -- supabase_auth_admin (used by GoTrue)
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
    CREATE ROLE supabase_auth_admin WITH LOGIN SUPERUSER CREATEDB CREATEROLE;
    RAISE NOTICE 'Created role: supabase_auth_admin';
  END IF;
  
  -- supabase_storage_admin (used by Storage)
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_storage_admin') THEN
    CREATE ROLE supabase_storage_admin WITH LOGIN CREATEDB CREATEROLE;
    RAISE NOTICE 'Created role: supabase_storage_admin';
  END IF;
END
\$\$;

-- =============================================================================
-- Set passwords for all login roles
-- =============================================================================
ALTER ROLE authenticator WITH LOGIN PASSWORD '${ESCAPED_PW}';
ALTER ROLE supabase_auth_admin WITH PASSWORD '${ESCAPED_PW}';
ALTER ROLE supabase_storage_admin WITH PASSWORD '${ESCAPED_PW}';
ALTER ROLE supabase_admin WITH PASSWORD '${ESCAPED_PW}';

-- =============================================================================
-- Grant necessary permissions
-- =============================================================================

-- authenticator needs to be able to switch to anon/authenticated/service_role
GRANT anon TO authenticator;
GRANT authenticated TO authenticator;
GRANT service_role TO authenticator;

-- supabase_admin needs same grants for admin operations
GRANT anon TO supabase_admin;
GRANT authenticated TO supabase_admin;
GRANT service_role TO supabase_admin;

-- Grant schema usage
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON SCHEMA public TO supabase_auth_admin;
GRANT ALL ON SCHEMA public TO supabase_storage_admin;

-- Ensure supabase_auth_admin has necessary permissions
ALTER ROLE supabase_auth_admin WITH SUPERUSER CREATEDB CREATEROLE;

-- =============================================================================
-- Success
-- =============================================================================
SELECT 'Role passwords updated successfully' AS status;
EOSQL

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✓${NC} Database role passwords fixed successfully"
    echo ""
    echo -e "${YELLOW}Restarting services to apply changes...${NC}"
    
    docker compose restart rest auth storage 2>/dev/null || docker compose restart
    
    echo ""
    echo -e "${GREEN}✓${NC} Services restarted"
    echo ""
    echo "Wait ~30 seconds for services to initialize, then verify with:"
    echo "  docker compose ps"
    echo ""
    echo "If issues persist, check logs with:"
    echo "  docker compose logs rest"
    echo "  docker compose logs auth"
else
    echo -e "${RED}✗${NC} Failed to update passwords"
    exit 1
fi
