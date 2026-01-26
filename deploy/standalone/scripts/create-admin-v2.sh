#!/bin/bash
#
# Create admin user for Game Haven v2
#
# Usage:
#   ./scripts/create-admin-v2.sh                    # Interactive mode
#   ./scripts/create-admin-v2.sh --non-interactive  # Uses ADMIN_EMAIL/ADMIN_PASSWORD env vars
#

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/.."

# Load environment
if [ -f .env ]; then
    source .env
fi

NON_INTERACTIVE=false
if [ "$1" = "--non-interactive" ]; then
    NON_INTERACTIVE=true
fi

# Get credentials
if [ -z "$ADMIN_EMAIL" ]; then
    if [ "$NON_INTERACTIVE" = true ]; then
        echo -e "${RED}Error: ADMIN_EMAIL environment variable required in non-interactive mode${NC}"
        exit 1
    fi
    read -p "Admin email: " ADMIN_EMAIL
fi

if [ -z "$ADMIN_PASSWORD" ]; then
    if [ "$NON_INTERACTIVE" = true ]; then
        echo -e "${RED}Error: ADMIN_PASSWORD environment variable required in non-interactive mode${NC}"
        exit 1
    fi
    read -sp "Admin password: " ADMIN_PASSWORD
    echo
fi

# Validate
if [ -z "$ADMIN_EMAIL" ] || [ -z "$ADMIN_PASSWORD" ]; then
    echo -e "${RED}Error: Email and password required${NC}"
    exit 1
fi

if [ ${#ADMIN_PASSWORD} -lt 6 ]; then
    echo -e "${RED}Error: Password must be at least 6 characters${NC}"
    exit 1
fi

echo -e "${YELLOW}Creating admin user...${NC}"

# Hash password using the API container
# Escape single quotes in password for JavaScript
ESCAPED_PASSWORD=$(echo "$ADMIN_PASSWORD" | sed "s/'/\\\\'/g")

PASSWORD_HASH=$(docker exec gamehaven-api-v2 node -e "
const bcrypt = require('bcryptjs');
const hash = bcrypt.hashSync('$ESCAPED_PASSWORD', 12);
console.log(hash);
")

if [ -z "$PASSWORD_HASH" ]; then
    echo -e "${RED}Error: Failed to generate password hash${NC}"
    exit 1
fi

# Insert user into database
docker exec -i gamehaven-db-v2 psql -U postgres -d gamehaven << EOSQL
INSERT INTO users (email, password_hash, display_name, role)
VALUES ('$ADMIN_EMAIL', '$PASSWORD_HASH', 'Admin', 'admin')
ON CONFLICT (email) DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    role = 'admin',
    updated_at = now();
EOSQL

echo -e "${GREEN}✓${NC} Admin user created: $ADMIN_EMAIL"
