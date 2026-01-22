#!/bin/bash
#
# Reset Supabase internal user passwords
# Run this after docker compose up if services can't connect to DB
#

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Load environment
if [ -f .env ]; then
    source .env
elif [ -f ../.env ]; then
    source ../.env
else
    echo -e "${RED}Error: .env file not found${NC}"
    exit 1
fi

echo -e "${YELLOW}Resetting Supabase internal user passwords...${NC}"

# Escape single quotes in password for SQL
ESCAPED_PW=$(printf '%s' "$POSTGRES_PASSWORD" | sed "s/'/''/g")

# Reset passwords and grant permissions for all internal users
docker exec -i gamehaven-db psql -v ON_ERROR_STOP=1 -U supabase_admin -d postgres << EOSQL
-- Create roles if they don't exist
DO \$\$
BEGIN
  -- GoTrue migrations expect a role literally named "postgres" to exist.
  -- When the cluster is initialized with POSTGRES_USER=supabase_admin,
  -- the default "postgres" role may not be created.
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'postgres') THEN
    CREATE ROLE postgres WITH LOGIN SUPERUSER CREATEDB CREATEROLE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
    CREATE ROLE supabase_auth_admin WITH LOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticator') THEN
    CREATE ROLE authenticator WITH LOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_storage_admin') THEN
    CREATE ROLE supabase_storage_admin WITH LOGIN;
  END IF;
END
\$\$;

-- Reset passwords
ALTER ROLE postgres WITH PASSWORD '${ESCAPED_PW}';
ALTER ROLE supabase_auth_admin WITH PASSWORD '${ESCAPED_PW}';
ALTER ROLE authenticator WITH PASSWORD '${ESCAPED_PW}';
ALTER ROLE supabase_admin WITH PASSWORD '${ESCAPED_PW}';
ALTER ROLE supabase_storage_admin WITH PASSWORD '${ESCAPED_PW}';

-- Grant supabase_auth_admin superuser-like permissions for GoTrue migrations
ALTER ROLE supabase_auth_admin WITH SUPERUSER CREATEDB CREATEROLE;

-- Grant supabase_storage_admin permissions
ALTER ROLE supabase_storage_admin WITH CREATEDB CREATEROLE;

-- Ensure authenticator can switch to anon/authenticated/service_role
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
  END IF;
END
\$\$;

GRANT anon TO authenticator;
GRANT authenticated TO authenticator;
GRANT service_role TO authenticator;
GRANT anon TO supabase_admin;
GRANT authenticated TO supabase_admin;
GRANT service_role TO supabase_admin;

-- Grant public schema usage
GRANT ALL ON SCHEMA public TO supabase_auth_admin;
GRANT ALL ON SCHEMA public TO supabase_storage_admin;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
EOSQL

echo -e "${GREEN}✓${NC} Passwords reset successfully"
echo ""
echo -e "${YELLOW}Restarting services to apply changes...${NC}"

docker restart gamehaven-auth gamehaven-rest gamehaven-realtime

echo ""
echo -e "${GREEN}✓${NC} Services restarted"
echo -e "Wait ~30 seconds for services to initialize, then run:"
echo -e "  ${GREEN}./scripts/create-admin.sh${NC}"
