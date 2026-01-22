#!/bin/bash
#
# Create Admin User for Game Haven
# Run this after docker compose up
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
# Step 1: Check and fix DB user passwords
# ==========================================
echo -e "${YELLOW}Checking database connectivity...${NC}"

# Check if auth container is healthy
AUTH_STATUS=$(docker inspect --format='{{.State.Health.Status}}' gamehaven-auth 2>/dev/null || echo "unknown")

if [ "$AUTH_STATUS" != "healthy" ]; then
    echo -e "${YELLOW}Auth service not healthy. Fixing database passwords...${NC}"
    
    # Wait for postgres to be ready
    # NOTE: supabase/postgres images typically use `supabase_admin` as the DB superuser.
    # Using `postgres` can fail (role may not exist) in some setups.
    for i in {1..30}; do
        if docker exec gamehaven-db pg_isready -U supabase_admin >/dev/null 2>&1; then
            break
        fi
        echo "  Waiting for database... ($i/30)"
        sleep 1
    done
    
    # Reset passwords for internal users
    docker exec -i gamehaven-db psql -U supabase_admin -d postgres << EOF
-- Reset passwords for internal Supabase users
ALTER ROLE supabase_auth_admin WITH PASSWORD '${POSTGRES_PASSWORD}';
ALTER ROLE authenticator WITH PASSWORD '${POSTGRES_PASSWORD}';
ALTER ROLE supabase_admin WITH PASSWORD '${POSTGRES_PASSWORD}';
ALTER ROLE supabase_storage_admin WITH PASSWORD '${POSTGRES_PASSWORD}';
EOF
    
    echo -e "${GREEN}✓${NC} Database passwords synchronized"
    
    # Restart affected services
    echo -e "${YELLOW}Restarting services...${NC}"
    docker restart gamehaven-auth gamehaven-rest gamehaven-realtime >/dev/null 2>&1
    
    # Wait for auth to become healthy
    echo -e "${YELLOW}Waiting for services to initialize...${NC}"
    for i in {1..60}; do
        AUTH_STATUS=$(docker inspect --format='{{.State.Health.Status}}' gamehaven-auth 2>/dev/null || echo "unknown")
        if [ "$AUTH_STATUS" = "healthy" ]; then
            echo -e "${GREEN}✓${NC} Auth service is healthy"
            break
        fi
        
        # Check if container is running at all
        AUTH_RUNNING=$(docker inspect --format='{{.State.Running}}' gamehaven-auth 2>/dev/null || echo "false")
        if [ "$AUTH_RUNNING" = "false" ]; then
            echo "  Auth restarting... ($i/60)"
        else
            echo "  Waiting for auth to be ready... ($i/60)"
        fi
        sleep 2
    done
    
    if [ "$AUTH_STATUS" != "healthy" ]; then
        echo -e "${RED}Warning: Auth service may not be fully ready. Continuing anyway...${NC}"
    fi
else
    echo -e "${GREEN}✓${NC} Auth service is healthy"
fi

# ==========================================
# Step 2: Collect admin credentials
# ==========================================
echo ""
read -p "$(echo -e "${BLUE}?${NC} Admin email: ")" ADMIN_EMAIL
read -sp "$(echo -e "${BLUE}?${NC} Admin password: ")" ADMIN_PASSWORD
echo ""

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

RESPONSE=$(curl -s -X POST "http://localhost:${KONG_HTTP_PORT:-8000}/auth/v1/admin/users" \
    -H "Content-Type: application/json" \
    -H "apikey: ${SERVICE_ROLE_KEY}" \
    -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
    -d "{
        \"email\": \"${ADMIN_EMAIL}\",
        \"password\": \"${ADMIN_PASSWORD}\",
        \"email_confirm\": true
    }")

# Extract user ID
USER_ID=$(echo $RESPONSE | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$USER_ID" ]; then
    echo -e "${RED}Error creating user. Response:${NC}"
    echo "$RESPONSE"
    exit 1
fi

echo -e "${GREEN}✓${NC} User created: $USER_ID"

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
