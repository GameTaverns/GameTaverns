#!/bin/bash
# =============================================================================
# Create Admin User for GameTaverns
# Domain: gametaverns.com
# Version: 2.3.2 - Schema Parity Audit
# Audited: 2026-02-02
# Roles: admin (T1), staff (T2), owner (T3), moderator (T4), user (T5)
# =============================================================================

set -e

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "Please run as root: sudo ./create-admin.sh"
    exit 1
fi

INSTALL_DIR="/opt/gametaverns"
DOMAIN="gametaverns.com"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

if [ ! -f "$INSTALL_DIR/.env" ]; then
    echo -e "${RED}Error: .env file not found. Run install.sh first.${NC}"
    exit 1
fi

# Source the .env file safely
set -a
source "$INSTALL_DIR/.env"
set +a

echo ""
echo "=============================================="
echo "  Create Admin User"
echo "  Domain: $DOMAIN"
echo "=============================================="
echo ""

read -p "Enter admin email [admin@$DOMAIN]: " ADMIN_EMAIL
ADMIN_EMAIL=${ADMIN_EMAIL:-admin@$DOMAIN}

# Validate email format
if ! echo "$ADMIN_EMAIL" | grep -qE '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'; then
    echo -e "${RED}Error: Invalid email format${NC}"
    exit 1
fi

read -s -p "Enter admin password: " ADMIN_PASSWORD
echo ""

if [ -z "$ADMIN_PASSWORD" ]; then
    echo -e "${RED}Error: Password cannot be empty${NC}"
    exit 1
fi

# Password minimum length check
if [ ${#ADMIN_PASSWORD} -lt 8 ]; then
    echo -e "${RED}Error: Password must be at least 8 characters${NC}"
    exit 1
fi

read -p "Enter display name [Admin]: " DISPLAY_NAME
DISPLAY_NAME=${DISPLAY_NAME:-Admin}

echo ""
echo -e "${BLUE}Creating admin user...${NC}"

cd "$INSTALL_DIR"

# Wait for Kong and Auth to be ready
MAX_RETRIES=90
RETRY_COUNT=0
AUTH_READY=false

echo -e "${BLUE}Waiting for auth service...${NC}"

while [ "$AUTH_READY" = "false" ]; do
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
        echo -e "${RED}Error: Auth service not responding after $MAX_RETRIES attempts.${NC}"
        echo ""
        echo "Troubleshooting steps:"
        echo "  1. Check container status: docker compose ps"
        echo "  2. Check auth logs: docker compose logs auth"
        echo "  3. Check kong logs: docker compose logs kong"
        echo "  4. Restart services: docker compose restart"
        exit 1
    fi
    
    # Try the health endpoint first (simpler)
    if curl -sf "http://localhost:${KONG_HTTP_PORT:-8000}/auth/v1/health" > /dev/null 2>&1; then
        AUTH_READY=true
    else
        echo "  Waiting for auth service... ($RETRY_COUNT/$MAX_RETRIES)"
        sleep 3
    fi
done

echo -e "${GREEN}✓ Auth service is ready${NC}"

# Create user via Supabase Auth API
echo -e "${BLUE}Creating user account...${NC}"
RESPONSE=$(curl -s -X POST \
    "http://localhost:${KONG_HTTP_PORT:-8000}/auth/v1/admin/users" \
    -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
    -H "apikey: $SERVICE_ROLE_KEY" \
    -H "Content-Type: application/json" \
    -d "{
        \"email\": \"$ADMIN_EMAIL\",
        \"password\": \"$ADMIN_PASSWORD\",
        \"email_confirm\": true,
        \"user_metadata\": {
            \"display_name\": \"$DISPLAY_NAME\"
        }
    }" 2>&1)

# Check for error in response
if echo "$RESPONSE" | grep -qE '"error"|"code":'; then
    ERROR_MSG=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('message', d.get('error', 'Unknown error')))" 2>/dev/null || echo "$RESPONSE")
    echo -e "${RED}Error creating user: $ERROR_MSG${NC}"
    
    # Check for common errors
    if echo "$RESPONSE" | grep -qi "already registered"; then
        echo ""
        echo "This email is already registered. You can:"
        echo "  1. Use a different email address"
        echo "  2. Reset the password for this user"
        echo "  3. Add admin role to existing user manually"
    fi
    exit 1
fi

# Extract user ID
USER_ID=$(echo "$RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$USER_ID" ]; then
    echo -e "${RED}Error: Could not extract user ID from response${NC}"
    echo "Response: $RESPONSE"
    exit 1
fi

echo -e "${GREEN}✓ User created with ID: $USER_ID${NC}"

# Create user profile (trigger may not have fired if auth.users was created internally by API)
echo -e "${BLUE}Creating user profile...${NC}"

PROFILE_CHECK=$(docker compose exec -T db psql -U supabase_admin -d postgres -tAc \
    "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_profiles');" 2>&1)

if [ "$PROFILE_CHECK" = "t" ]; then
    docker compose exec -T db psql -U supabase_admin -d postgres -c \
        "INSERT INTO public.user_profiles (user_id, display_name) VALUES ('$USER_ID', '$DISPLAY_NAME') ON CONFLICT (user_id) DO UPDATE SET display_name = EXCLUDED.display_name;" 2>/dev/null || true
    echo -e "${GREEN}✓ User profile created${NC}"
else
    echo -e "${YELLOW}Warning: user_profiles table does not exist yet. Run migrations first.${NC}"
fi

# Add admin role
echo -e "${BLUE}Adding admin role...${NC}"

# First check if user_roles table exists
TABLE_CHECK=$(docker compose exec -T db psql -U supabase_admin -d postgres -tAc \
    "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_roles');" 2>&1)

if [ "$TABLE_CHECK" != "t" ]; then
    echo -e "${YELLOW}Warning: user_roles table does not exist yet.${NC}"
    echo "Run migrations first: ./scripts/run-migrations.sh"
    echo ""
    echo "Then add admin role manually:"
    echo "  docker compose exec db psql -U supabase_admin -d postgres -c \"INSERT INTO user_roles (user_id, role) VALUES ('$USER_ID', 'admin');\""
else
    # Insert admin role
    ROLE_RESULT=$(docker compose exec -T db psql -U supabase_admin -d postgres -c \
        "INSERT INTO public.user_roles (user_id, role) VALUES ('$USER_ID', 'admin') ON CONFLICT (user_id, role) DO NOTHING RETURNING id;" 2>&1)

    if echo "$ROLE_RESULT" | grep -qiE "ERROR"; then
        echo -e "${YELLOW}Warning: Could not add admin role automatically.${NC}"
        echo ""
        echo "To add the admin role manually, run:"
        echo "  docker compose exec db psql -U supabase_admin -d postgres"
        echo "  INSERT INTO user_roles (user_id, role) VALUES ('$USER_ID', 'admin');"
    else
        echo -e "${GREEN}✓ Admin role added successfully${NC}"
    fi
fi

echo ""
echo "=============================================="
echo -e "${GREEN}  Admin user created successfully!${NC}"
echo "=============================================="
echo ""
echo "  Email: $ADMIN_EMAIL"
echo "  User ID: $USER_ID"
echo "  Display Name: $DISPLAY_NAME"
echo ""
echo "You can now log in at: https://$DOMAIN"
echo ""
