#!/bin/bash
# =============================================================================
# Create Admin User for GameTaverns
# Domain: gametaverns.com
# Version: 2.4.0 - Migration-Aware Health Checks
# Audited: 2026-02-03
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

info() { echo -e "${BLUE}$1${NC}"; }
success() { echo -e "${GREEN}$1${NC}"; }
warn() { echo -e "${YELLOW}$1${NC}"; }
error() { echo -e "${RED}$1${NC}"; }

if [ ! -f "$INSTALL_DIR/.env" ]; then
    error "Error: .env file not found. Run install.sh first."
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
    error "Error: Invalid email format"
    exit 1
fi

read -s -p "Enter admin password: " ADMIN_PASSWORD
echo ""

if [ -z "$ADMIN_PASSWORD" ]; then
    error "Error: Password cannot be empty"
    exit 1
fi

# Password minimum length check
if [ ${#ADMIN_PASSWORD} -lt 8 ]; then
    error "Error: Password must be at least 8 characters"
    exit 1
fi

read -p "Enter display name [Admin]: " DISPLAY_NAME
DISPLAY_NAME=${DISPLAY_NAME:-Admin}

echo ""
info "Creating admin user..."

cd "$INSTALL_DIR"

# =============================================================================
# Migration-Aware Auth Service Health Check
# GoTrue applies ~52 migrations on first start - this can take 1-3 minutes
# =============================================================================
AUTH_MAX_WAIT=300  # 5 minutes total
AUTH_START_TIME=$(date +%s)
AUTH_READY=false
MIGRATIONS_SEEN=false

info "Waiting for auth service..."
warn "(GoTrue applies ~52 migrations on first start - this can take 1-3 minutes)"
echo ""

while true; do
    ELAPSED=$(($(date +%s) - AUTH_START_TIME))
    
    if [ $ELAPSED -ge $AUTH_MAX_WAIT ]; then
        error "Error: Auth service not responding after $AUTH_MAX_WAIT seconds."
        echo ""
        echo "Troubleshooting steps:"
        echo "  1. Check container status: docker compose ps"
        echo "  2. Check auth logs: docker compose logs auth --tail 100"
        echo "  3. Look for migration progress: docker compose logs auth | grep -E 'migrations|Successfully'"
        echo "  4. Restart services: docker compose restart auth kong"
        exit 1
    fi
    
    # Check if container exists
    if ! docker ps --format '{{.Names}}' | grep -q "gametaverns-auth"; then
        echo "  [$ELAPSED s] Auth container not running, waiting..."
        sleep 5
        continue
    fi
    
    # Check for migration progress (every 10 seconds)
    if [ $((ELAPSED % 10)) -eq 0 ] && [ $ELAPSED -gt 0 ]; then
        # Check if migrations completed successfully
        if docker logs gametaverns-auth 2>&1 | grep -q "Successfully applied"; then
            MIGRATIONS_COMPLETE=$(docker logs gametaverns-auth 2>&1 | grep "Successfully applied" | tail -1)
            if [ "$MIGRATIONS_SEEN" = false ]; then
                info "  [$ELAPSED s] $MIGRATIONS_COMPLETE"
                MIGRATIONS_SEEN=true
            fi
        elif docker logs gametaverns-auth 2>&1 | grep -q "Migrations already up to date"; then
            if [ "$MIGRATIONS_SEEN" = false ]; then
                info "  [$ELAPSED s] Migrations already up to date"
                MIGRATIONS_SEEN=true
            fi
        elif docker logs gametaverns-auth 2>&1 | grep -qE "^> "; then
            MIGRATION_COUNT=$(docker logs gametaverns-auth 2>&1 | grep -c "^> " 2>/dev/null || echo "0")
            echo "  [$ELAPSED s] Migrations in progress ($MIGRATION_COUNT applied so far)..."
        else
            echo "  [$ELAPSED s] Waiting for auth service to initialize..."
        fi
        
        # Check for fatal database errors
        if docker logs gametaverns-auth 2>&1 | grep -qiE "FATAL|could not connect to database"; then
            warn "  Database connection issue detected, auth may need restart..."
        fi
    fi
    
    # Try direct GoTrue port first (faster, no gateway overhead)
    if curl -sf http://127.0.0.1:9999/health >/dev/null 2>&1; then
        AUTH_READY=true
        break
    fi
    
    # Try via Kong gateway with apikey header
    if curl -sf \
        -H "apikey: ${ANON_KEY}" \
        "http://localhost:${KONG_HTTP_PORT:-8000}/auth/v1/health" >/dev/null 2>&1; then
        AUTH_READY=true
        break
    fi
    
    sleep 3
done

success "✓ Auth service is ready"

# Create user via Supabase Auth API
info "Creating user account..."

# IMPORTANT:
# - Kong key-auth accepts either ANON_KEY or SERVICE_ROLE_KEY as the apikey.
# - GoTrue admin endpoints require a service_role JWT in Authorization.
# Using apikey=ANON_KEY keeps the request shape consistent with other health checks.
AUTH_ADMIN_URL="http://localhost:${KONG_HTTP_PORT:-8000}/auth/v1/admin/users"

# Capture both body and status code for actionable debugging.
HTTP_RESPONSE=$(curl -sS -X POST "$AUTH_ADMIN_URL" \
    -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
    -H "apikey: $ANON_KEY" \
    -H "Content-Type: application/json" \
    -d "{
        \"email\": \"$ADMIN_EMAIL\",
        \"password\": \"$ADMIN_PASSWORD\",
        \"email_confirm\": true,
        \"user_metadata\": {
            \"display_name\": \"$DISPLAY_NAME\"
        }
    }" \
    -w "\n__HTTP_STATUS__:%{http_code}\n" 2>&1)

HTTP_STATUS=$(echo "$HTTP_RESPONSE" | sed -n 's/^__HTTP_STATUS__:\([0-9][0-9][0-9]\)$/\1/p' | tail -1)
RESPONSE=$(echo "$HTTP_RESPONSE" | sed '/^__HTTP_STATUS__:/d')

# If we didn't get a status code, curl likely failed (connection reset, DNS, etc.)
if [ -z "$HTTP_STATUS" ]; then
    error "Error creating user: request failed before receiving a response"
    echo ""
    echo "Raw output:"
    echo "$HTTP_RESPONSE"
    echo ""
    echo "Try: docker compose logs --tail=200 kong auth"
    exit 1
fi

# Non-2xx: show status + body
if [ "$HTTP_STATUS" -lt 200 ] || [ "$HTTP_STATUS" -ge 300 ]; then
    error "Error creating user (HTTP $HTTP_STATUS)"
    echo "Response: $RESPONSE"
    echo ""
    echo "Troubleshooting:"
    echo "  1. Confirm Kong keys injected: grep -q 'PLACEHOLDER' $INSTALL_DIR/kong.yml && echo 'KEYS NOT SET' || echo 'Keys configured'"
    echo "  2. Confirm JWT secret/key match: grep -E '^(JWT_SECRET|SERVICE_ROLE_KEY|ANON_KEY)=' $INSTALL_DIR/.env"
    echo "  3. Check logs: docker compose logs --tail=200 kong auth"
    exit 1
fi

# Check for error in response
if echo "$RESPONSE" | grep -qE '"error"|"code":'; then
    ERROR_MSG=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('message', d.get('error', 'Unknown error')))" 2>/dev/null || echo "$RESPONSE")
    error "Error creating user: $ERROR_MSG"
    
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
    error "Error: Could not extract user ID from response"
    echo "Response: $RESPONSE"
    exit 1
fi

success "✓ User created with ID: $USER_ID"

# Create user profile (trigger may not have fired if auth.users was created internally by API)
info "Creating user profile..."

PROFILE_CHECK=$(docker compose exec -T db psql -U supabase_admin -d postgres -tAc \
    "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_profiles');" 2>&1)

if [ "$PROFILE_CHECK" = "t" ]; then
    docker compose exec -T db psql -U supabase_admin -d postgres -c \
        "INSERT INTO public.user_profiles (user_id, display_name) VALUES ('$USER_ID', '$DISPLAY_NAME') ON CONFLICT (user_id) DO UPDATE SET display_name = EXCLUDED.display_name;" 2>/dev/null || true
    success "✓ User profile created"
else
    warn "Warning: user_profiles table does not exist yet. Run migrations first."
fi

# Add admin role
info "Adding admin role..."

# First check if user_roles table exists
TABLE_CHECK=$(docker compose exec -T db psql -U supabase_admin -d postgres -tAc \
    "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_roles');" 2>&1)

if [ "$TABLE_CHECK" != "t" ]; then
    warn "Warning: user_roles table does not exist yet."
    echo "Run migrations first: ./scripts/run-migrations.sh"
    echo ""
    echo "Then add admin role manually:"
    echo "  docker compose exec db psql -U supabase_admin -d postgres -c \"INSERT INTO user_roles (user_id, role) VALUES ('$USER_ID', 'admin');\""
else
    # Insert admin role
    ROLE_RESULT=$(docker compose exec -T db psql -U supabase_admin -d postgres -c \
        "INSERT INTO public.user_roles (user_id, role) VALUES ('$USER_ID', 'admin') ON CONFLICT (user_id, role) DO NOTHING RETURNING id;" 2>&1)

    if echo "$ROLE_RESULT" | grep -qiE "ERROR"; then
        warn "Warning: Could not add admin role automatically."
        echo ""
        echo "To add the admin role manually, run:"
        echo "  docker compose exec db psql -U supabase_admin -d postgres"
        echo "  INSERT INTO user_roles (user_id, role) VALUES ('$USER_ID', 'admin');"
    else
        success "✓ Admin role added successfully"
    fi
fi

echo ""
echo "=============================================="
success "  Admin user created successfully!"
echo "=============================================="
echo ""
echo "  Email: $ADMIN_EMAIL"
echo "  User ID: $USER_ID"
echo "  Display Name: $DISPLAY_NAME"
echo ""
echo "You can now log in at: https://$DOMAIN"
echo ""
