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

echo ""
echo -e "${YELLOW}Creating admin user...${NC}"

# Debug: Show first/last 10 chars of key being used
KEY_PREVIEW="${SERVICE_ROLE_KEY:0:20}...${SERVICE_ROLE_KEY: -10}"
echo -e "${BLUE}Using key: ${KEY_PREVIEW}${NC}"

# Verify Kong is using the same key
KONG_KEY=$(docker exec gamehaven-kong printenv SUPABASE_SERVICE_KEY 2>/dev/null | head -c 30)
echo -e "${BLUE}Kong sees: ${KONG_KEY}...${NC}"

# Create user via GoTrue API
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

# Add admin role
echo -e "${YELLOW}Assigning admin role...${NC}"

docker exec -i gamehaven-db psql -U postgres -d postgres << EOF
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
