#!/bin/bash

# ============================================
# Create Admin User
# ============================================
# Creates the first platform admin with a library

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=== Create Platform Admin ===${NC}"
echo ""

# Load config
if [ -f ".env" ]; then
    source .env
fi

# Get user input
read -p "Email: " ADMIN_EMAIL
read -p "Display Name: " DISPLAY_NAME
read -p "Library URL slug (e.g., 'mylib' for mylib.${DOMAIN:-gametaverns.com}): " LIBRARY_SLUG
read -s -p "Password: " PASSWORD
echo ""
read -s -p "Confirm Password: " PASSWORD_CONFIRM
echo ""

if [ "$PASSWORD" != "$PASSWORD_CONFIRM" ]; then
    echo -e "${RED}✗ Passwords do not match${NC}"
    exit 1
fi

if [ ${#PASSWORD} -lt 8 ]; then
    echo -e "${RED}✗ Password must be at least 8 characters${NC}"
    exit 1
fi

# Validate slug
if [[ ! "$LIBRARY_SLUG" =~ ^[a-z0-9]([a-z0-9-]*[a-z0-9])?$ ]]; then
    echo -e "${RED}✗ Invalid library slug. Use lowercase letters, numbers, and hyphens only.${NC}"
    exit 1
fi

# Generate password hash using bcrypt
# Note: This requires the bcrypt command or we can use docker
PASSWORD_HASH=$(docker run --rm -it node:20-alpine node -e "
const bcrypt = require('bcryptjs');
const hash = bcrypt.hashSync('${PASSWORD}', 12);
console.log(hash);
" 2>/dev/null | tr -d '\r')

if [ -z "$PASSWORD_HASH" ]; then
    echo -e "${RED}✗ Failed to generate password hash${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}Creating admin user...${NC}"

# Generate UUIDs
USER_ID=$(cat /proc/sys/kernel/random/uuid)
LIBRARY_ID=$(cat /proc/sys/kernel/random/uuid)
PROFILE_ID=$(cat /proc/sys/kernel/random/uuid)
ROLE_ID=$(cat /proc/sys/kernel/random/uuid)

# Execute SQL
docker exec -i gametaverns-db psql -U postgres -d gametaverns << EOF
BEGIN;

-- Create user
INSERT INTO users (id, email, password_hash, email_verified, created_at, updated_at)
VALUES ('${USER_ID}', '${ADMIN_EMAIL}', '${PASSWORD_HASH}', true, now(), now())
ON CONFLICT (email) DO UPDATE SET 
    password_hash = EXCLUDED.password_hash,
    updated_at = now();

-- Create/update profile
INSERT INTO user_profiles (id, user_id, display_name, created_at, updated_at)
VALUES ('${PROFILE_ID}', '${USER_ID}', '${DISPLAY_NAME}', now(), now())
ON CONFLICT (user_id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    updated_at = now();

-- Assign admin role
INSERT INTO user_roles (id, user_id, role, created_at)
VALUES ('${ROLE_ID}', '${USER_ID}', 'admin', now())
ON CONFLICT (user_id, role) DO NOTHING;

-- Create library
INSERT INTO libraries (id, slug, name, description, owner_id, is_active, is_premium, created_at, updated_at)
VALUES (
    '${LIBRARY_ID}',
    '${LIBRARY_SLUG}',
    '${DISPLAY_NAME}''s Library',
    'Board game collection',
    '${USER_ID}',
    true,
    true,
    now(),
    now()
) ON CONFLICT (slug) DO UPDATE SET
    owner_id = EXCLUDED.owner_id,
    updated_at = now();

COMMIT;
EOF

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}╔═══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║               Admin Created Successfully!                  ║${NC}"
    echo -e "${GREEN}╚═══════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "  Email:    ${BLUE}${ADMIN_EMAIL}${NC}"
    echo -e "  Library:  ${BLUE}https://${LIBRARY_SLUG}.${DOMAIN:-gametaverns.com}${NC}"
    echo -e "  Admin:    ${BLUE}https://${DOMAIN:-gametaverns.com}/admin${NC}"
    echo ""
else
    echo -e "${RED}✗ Failed to create admin user${NC}"
    exit 1
fi
