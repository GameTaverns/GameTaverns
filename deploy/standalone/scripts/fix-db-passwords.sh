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

# Reset passwords for all internal users
docker exec -i gamehaven-db psql -v ON_ERROR_STOP=1 -U supabase_admin -d postgres << EOF
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
    CREATE ROLE supabase_auth_admin WITH LOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticator') THEN
    CREATE ROLE authenticator WITH LOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_admin') THEN
    CREATE ROLE supabase_admin WITH LOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_storage_admin') THEN
    CREATE ROLE supabase_storage_admin WITH LOGIN;
  END IF;
END
$$;

-- Reset passwords for internal users to match POSTGRES_PASSWORD
ALTER ROLE supabase_auth_admin WITH PASSWORD '${POSTGRES_PASSWORD}';
ALTER ROLE authenticator WITH PASSWORD '${POSTGRES_PASSWORD}';
ALTER ROLE supabase_admin WITH PASSWORD '${POSTGRES_PASSWORD}';
ALTER ROLE supabase_storage_admin WITH PASSWORD '${POSTGRES_PASSWORD}';
EOF

echo -e "${GREEN}✓${NC} Passwords reset successfully"
echo ""
echo -e "${YELLOW}Restarting services to apply changes...${NC}"

docker restart gamehaven-auth gamehaven-rest gamehaven-realtime

echo ""
echo -e "${GREEN}✓${NC} Services restarted"
echo -e "Wait ~30 seconds for services to initialize, then run:"
echo -e "  ${GREEN}./scripts/create-admin.sh${NC}"
