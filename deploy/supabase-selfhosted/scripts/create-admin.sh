#!/bin/bash
# =============================================================================
# Create Admin User for GameTaverns
# =============================================================================

set -e

INSTALL_DIR="/opt/gametaverns"

if [ ! -f "$INSTALL_DIR/.env" ]; then
    echo "Error: .env file not found. Run install.sh first."
    exit 1
fi

source "$INSTALL_DIR/.env"

echo ""
echo "=============================================="
echo "  Create Admin User"
echo "=============================================="
echo ""

read -p "Enter admin email: " ADMIN_EMAIL
read -s -p "Enter admin password: " ADMIN_PASSWORD
echo ""
read -p "Enter display name [Admin]: " DISPLAY_NAME
DISPLAY_NAME=${DISPLAY_NAME:-Admin}

echo ""
echo "Creating admin user..."

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

USER_ID=$(echo "$RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$USER_ID" ]; then
    echo "Error creating user:"
    echo "$RESPONSE"
    exit 1
fi

echo "User created with ID: $USER_ID"

# Add admin role
docker compose exec -T db psql -U supabase_admin -d postgres << EOF
INSERT INTO public.user_roles (user_id, role)
VALUES ('$USER_ID', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;
EOF

echo ""
echo "=============================================="
echo "  Admin user created successfully!"
echo "=============================================="
echo ""
echo "Email: $ADMIN_EMAIL"
echo "You can now log in at: https://$DOMAIN"
echo ""
