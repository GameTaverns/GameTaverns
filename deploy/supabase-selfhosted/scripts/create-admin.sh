#!/bin/bash
# =============================================================================
# Create Admin User for GameTaverns
# Domain: gametaverns.com
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
read -s -p "Enter admin password: " ADMIN_PASSWORD
echo ""

if [ -z "$ADMIN_PASSWORD" ]; then
    echo "Error: Password cannot be empty"
    exit 1
fi

# Password minimum length check
if [ ${#ADMIN_PASSWORD} -lt 6 ]; then
    echo "Error: Password must be at least 6 characters"
    exit 1
fi

read -p "Enter display name [Admin]: " DISPLAY_NAME
DISPLAY_NAME=${DISPLAY_NAME:-Admin}

echo ""
echo "Creating admin user..."

cd "$INSTALL_DIR"

# Wait for Kong and Auth to be ready
MAX_RETRIES=60
RETRY_COUNT=0
AUTH_READY=false

while [ "$AUTH_READY" = "false" ]; do
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
        echo "Error: Auth service not responding after $MAX_RETRIES attempts."
        echo "Check: docker compose logs auth kong"
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

echo "Auth service is ready"

# Create user via Supabase Auth API
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
    }")

# Check for error in response
if echo "$RESPONSE" | grep -q '"error"'; then
    echo "Error creating user:"
    echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
    exit 1
fi

# Extract user ID
USER_ID=$(echo "$RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$USER_ID" ]; then
    echo "Error: Could not extract user ID from response:"
    echo "$RESPONSE"
    exit 1
fi

echo "  User created with ID: $USER_ID"

# Add admin role
echo "Adding admin role..."
ROLE_RESULT=$(docker compose exec -T db psql -U supabase_admin -d postgres -c \
    "INSERT INTO public.user_roles (user_id, role) VALUES ('$USER_ID', 'admin') ON CONFLICT (user_id, role) DO NOTHING RETURNING id;" 2>&1)

if echo "$ROLE_RESULT" | grep -q "ERROR"; then
    echo -e "${YELLOW}Warning: Could not add admin role. You may need to add it manually.${NC}"
    echo "  Run: docker compose exec db psql -U supabase_admin -d postgres"
    echo "  Then: INSERT INTO user_roles (user_id, role) VALUES ('$USER_ID', 'admin');"
else
    echo -e "${GREEN}✓ Admin role added successfully${NC}"
fi

echo ""
echo "=============================================="
echo -e "${GREEN}  Admin user created successfully!${NC}"
echo "=============================================="
echo ""
echo "  Email: $ADMIN_EMAIL"
echo "  User ID: $USER_ID"
echo ""
echo "You can now log in at: https://$DOMAIN"
echo ""
