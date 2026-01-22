#!/bin/bash
#
# Create Admin User for Game Haven
# Can be run standalone or credentials passed via environment
#
# Usage:
#   Interactive:  ./scripts/create-admin.sh
#   Non-interactive: ADMIN_EMAIL=... ADMIN_PASSWORD=... ./scripts/create-admin.sh
#

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

# Load environment
if [ -f ../.env ]; then
    source ../.env
elif [ -f .env ]; then
    source .env
else
    echo -e "${RED}Error: .env file not found${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}━━━ Create Admin User ━━━${NC}"
echo ""

# ==========================================
# Helper Functions
# ==========================================

AUTH_HEALTH_URL="http://localhost:${KONG_HTTP_PORT:-8000}/auth/v1/health"

is_auth_ready() {
    curl -fsS --max-time 2 "$AUTH_HEALTH_URL" >/dev/null 2>&1
}

wait_for_auth() {
    local max_seconds=${1:-120}
    local waited=0

    while [ $waited -lt $max_seconds ]; do
        if is_auth_ready; then
            return 0
        fi
        echo "  Waiting for auth... ($((waited/2 + 1))/$((max_seconds/2)))"
        sleep 2
        waited=$((waited + 2))
    done

    return 1
}

print_auth_failure_diagnostics() {
    echo -e "\n${YELLOW}Auth container status:${NC}"
    docker compose ps auth 2>/dev/null || docker ps --filter name=gamehaven-auth || true
    echo -e "\n${YELLOW}Last 120 lines of auth logs:${NC}"
    docker logs gamehaven-auth --tail=120 || true
    echo -e "\n${YELLOW}Last 80 lines of db logs:${NC}"
    docker logs gamehaven-db --tail=80 || true
    echo ""
}

sync_db_passwords() {
    echo -e "${YELLOW}Synchronizing database passwords...${NC}"
    
    # Escape single quotes in password for SQL
    ESCAPED_PW=$(printf '%s' "$POSTGRES_PASSWORD" | sed "s/'/''/g")
    
    docker exec -i gamehaven-db psql -v ON_ERROR_STOP=1 -U supabase_admin -d postgres << EOSQL
DO \$\$
BEGIN
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

ALTER ROLE supabase_auth_admin WITH PASSWORD '${ESCAPED_PW}';
ALTER ROLE authenticator WITH PASSWORD '${ESCAPED_PW}';
ALTER ROLE supabase_storage_admin WITH PASSWORD '${ESCAPED_PW}';
EOSQL
    
    echo -e "${GREEN}✓${NC} Database passwords synchronized"
}

# ==========================================
# Step 1: Ensure services are ready
# ==========================================

echo -e "${YELLOW}Checking service health...${NC}"

# Wait for database first
for i in {1..30}; do
    if docker exec gamehaven-db pg_isready -U supabase_admin >/dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} Database is ready"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}Error: Database not responding${NC}"
        exit 1
    fi
    echo "  Waiting for database... ($i/30)"
    sleep 1
done

# Check if auth is already reachable
if is_auth_ready; then
    echo -e "${GREEN}✓${NC} Auth service is ready"
else
    echo -e "${YELLOW}Auth service not reachable. Attempting recovery...${NC}"
    
    # Sync passwords and restart
    sync_db_passwords
    
    echo -e "${YELLOW}Restarting services...${NC}"
    # Restart kong too since the health check is routed through it.
    docker restart gamehaven-auth gamehaven-rest gamehaven-realtime gamehaven-kong >/dev/null 2>&1 || true
    
    echo -e "${YELLOW}Waiting for services to initialize...${NC}"
    if ! wait_for_auth 120; then
        echo -e "${RED}Error: Auth service failed to start${NC}"
        print_auth_failure_diagnostics
        echo -e "${YELLOW}Also check Kong logs:${NC} ${YELLOW}docker logs gamehaven-kong --tail=80${NC}"
        echo -e "${YELLOW}And service list:${NC} ${YELLOW}docker compose ps${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✓${NC} Auth service is ready"
fi

# ==========================================
# Step 2: Collect admin credentials
# ==========================================

echo ""

# Support non-interactive usage
if [ -z "${ADMIN_EMAIL:-}" ]; then
    read -p "$(echo -e "${BLUE}?${NC} Admin email: ")" ADMIN_EMAIL
fi

if [ -z "${ADMIN_PASSWORD:-}" ]; then
    read -sp "$(echo -e "${BLUE}?${NC} Admin password: ")" ADMIN_PASSWORD
    echo ""
fi

# Validate
if [ -z "$ADMIN_EMAIL" ] || [ -z "$ADMIN_PASSWORD" ]; then
    echo -e "${RED}Error: Email and password are required${NC}"
    exit 1
fi

if [ ${#ADMIN_PASSWORD} -lt 6 ]; then
    echo -e "${RED}Error: Password must be at least 6 characters${NC}"
    exit 1
fi

# ==========================================
# Step 3: Create user via GoTrue API
# ==========================================

echo ""
echo -e "${YELLOW}Creating admin user...${NC}"

# Get service key (install.sh uses SERVICE_ROLE_KEY)
ADMIN_API_KEY="${SERVICE_ROLE_KEY:-${SUPABASE_SERVICE_KEY}}"

if [ -z "$ADMIN_API_KEY" ]; then
    echo -e "${RED}Error: No service key found in environment.${NC}"
    echo -e "Expected: ${YELLOW}SERVICE_ROLE_KEY${NC}"
    exit 1
fi

# Sanity check (service keys are JWTs)
if ! echo "$ADMIN_API_KEY" | grep -q '\.'; then
    echo -e "${YELLOW}Warning:${NC} Service key doesn't look like a JWT"
fi

RESPONSE=$(curl -s -X POST "http://localhost:${KONG_HTTP_PORT:-8000}/auth/v1/admin/users" \
    -H "Content-Type: application/json" \
    -H "apikey: ${ADMIN_API_KEY}" \
    -H "Authorization: Bearer ${ADMIN_API_KEY}" \
    -d "{
        \"email\": \"${ADMIN_EMAIL}\",
        \"password\": \"${ADMIN_PASSWORD}\",
        \"email_confirm\": true
    }")

# Extract user ID
USER_ID=$(echo $RESPONSE | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$USER_ID" ]; then
    # Check for common errors
    if echo "$RESPONSE" | grep -q "already registered"; then
        echo -e "${YELLOW}User already exists. Attempting to find user ID...${NC}"
        
        # Try to get user by email
        USER_RESPONSE=$(curl -s "http://localhost:${KONG_HTTP_PORT:-8000}/auth/v1/admin/users" \
            -H "apikey: ${ADMIN_API_KEY}" \
            -H "Authorization: Bearer ${ADMIN_API_KEY}")
        
        USER_ID=$(echo "$USER_RESPONSE" | grep -o "\"id\":\"[^\"]*\".*\"email\":\"${ADMIN_EMAIL}\"" | head -1 | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
        
        if [ -z "$USER_ID" ]; then
            echo -e "${RED}Could not find existing user. Response:${NC}"
            echo "$RESPONSE"
            exit 1
        fi
        
        echo -e "${GREEN}✓${NC} Found existing user: $USER_ID"
    else
        echo -e "${RED}Error creating user. Response:${NC}"
        echo "$RESPONSE"
        exit 1
    fi
else
    echo -e "${GREEN}✓${NC} User created: $USER_ID"
fi

# ==========================================
# Step 4: Assign admin role
# ==========================================

echo -e "${YELLOW}Assigning admin role...${NC}"

docker exec -i gamehaven-db psql -U supabase_admin -d postgres << EOF
INSERT INTO public.user_roles (user_id, role)
VALUES ('${USER_ID}', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;
EOF

echo ""
echo -e "${GREEN}✓ Admin user created successfully!${NC}"
echo ""
echo -e "  Email: ${GREEN}${ADMIN_EMAIL}${NC}"
echo -e "  You can now log in at ${GREEN}${SITE_URL:-http://localhost:3000}/login${NC}"
echo ""
