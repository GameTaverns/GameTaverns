#!/bin/bash
# =============================================
# GameTaverns - Create New Tenant Script
# =============================================
# 
# This script creates a new tenant (library) in the 
# GameTaverns platform. It:
# 1. Creates a record in the core tenants table
# 2. Creates the tenant's database/schema
# 3. Creates the tenant owner user
# 4. Sets up default data
#
# USAGE:
#   ./create-tenant.sh <slug> <display_name> <owner_email> <owner_password>
#
# EXAMPLE:
#   ./create-tenant.sh tzolak "Tzolak's Game Library" tzolak@example.com MyP@ssw0rd
#
# =============================================

set -e

# Configuration
DB_HOST="${DB_HOST:-localhost}"
DB_USER="${DB_USER:-gametaverns}"
DB_PASSWORD="${DB_PASSWORD:-}"
DB_NAME="${DB_NAME:-gametaverns_core}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Parse arguments
if [ $# -lt 4 ]; then
    echo -e "${RED}Error: Missing arguments${NC}"
    echo "Usage: $0 <slug> <display_name> <owner_email> <owner_password>"
    echo "Example: $0 tzolak \"Tzolak's Game Library\" tzolak@example.com MyP@ssw0rd"
    exit 1
fi

SLUG="$1"
DISPLAY_NAME="$2"
OWNER_EMAIL="$3"
OWNER_PASSWORD="$4"

# Validate slug (lowercase, alphanumeric, hyphens only)
if ! [[ "$SLUG" =~ ^[a-z0-9]([a-z0-9-]*[a-z0-9])?$ ]]; then
    echo -e "${RED}Error: Invalid slug format${NC}"
    echo "Slug must be lowercase alphanumeric with optional hyphens, 3-63 characters"
    echo "Valid examples: tzolak, my-library, game-collection-123"
    exit 1
fi

if [ ${#SLUG} -lt 3 ] || [ ${#SLUG} -gt 63 ]; then
    echo -e "${RED}Error: Slug must be between 3 and 63 characters${NC}"
    exit 1
fi

# Generate schema name
SCHEMA_NAME="tenant_${SLUG//-/_}"

# Generate UUIDs
TENANT_ID=$(cat /proc/sys/kernel/random/uuid)
USER_ID=$(cat /proc/sys/kernel/random/uuid)
MEMBER_ID=$(cat /proc/sys/kernel/random/uuid)

# Hash password using bcrypt (requires htpasswd or node)
echo -e "${YELLOW}Hashing password...${NC}"
if command -v node &> /dev/null; then
    PASSWORD_HASH=$(node -e "
        const bcrypt = require('bcrypt');
        const hash = bcrypt.hashSync('${OWNER_PASSWORD}', 12);
        console.log(hash);
    " 2>/dev/null || echo "")
fi

if [ -z "$PASSWORD_HASH" ]; then
    echo -e "${RED}Error: Could not hash password. Install bcrypt: npm install -g bcrypt${NC}"
    exit 1
fi

echo -e "${GREEN}Creating tenant: ${SLUG}${NC}"
echo "  Display Name: ${DISPLAY_NAME}"
echo "  Schema: ${SCHEMA_NAME}"
echo "  Owner: ${OWNER_EMAIL}"

# Create MySQL command
MYSQL_CMD="mysql -h${DB_HOST} -u${DB_USER}"
if [ -n "$DB_PASSWORD" ]; then
    MYSQL_CMD="${MYSQL_CMD} -p${DB_PASSWORD}"
fi

# Check if slug already exists
echo -e "${YELLOW}Checking for existing tenant...${NC}"
EXISTS=$($MYSQL_CMD -N -e "SELECT COUNT(*) FROM ${DB_NAME}.tenants WHERE slug = '${SLUG}';" 2>/dev/null)
if [ "$EXISTS" -gt 0 ]; then
    echo -e "${RED}Error: Tenant with slug '${SLUG}' already exists${NC}"
    exit 1
fi

# Check if email already exists
EMAIL_EXISTS=$($MYSQL_CMD -N -e "SELECT COUNT(*) FROM ${DB_NAME}.users WHERE email = '${OWNER_EMAIL}';" 2>/dev/null)

# Start transaction
echo -e "${YELLOW}Creating database records...${NC}"

if [ "$EMAIL_EXISTS" -gt 0 ]; then
    # User exists, get their ID
    USER_ID=$($MYSQL_CMD -N -e "SELECT id FROM ${DB_NAME}.users WHERE email = '${OWNER_EMAIL}';" 2>/dev/null)
    echo "  Using existing user: ${USER_ID}"
else
    # Create new user
    $MYSQL_CMD -e "
        INSERT INTO ${DB_NAME}.users (id, email, password_hash, display_name, email_verified, status)
        VALUES ('${USER_ID}', '${OWNER_EMAIL}', '${PASSWORD_HASH}', '${DISPLAY_NAME} Owner', TRUE, 'active');
    " 2>/dev/null
    echo "  Created user: ${USER_ID}"
fi

# Create tenant record
$MYSQL_CMD -e "
    INSERT INTO ${DB_NAME}.tenants (id, slug, display_name, owner_id, schema_name, status)
    VALUES ('${TENANT_ID}', '${SLUG}', '${DISPLAY_NAME}', '${USER_ID}', '${SCHEMA_NAME}', 'active');
" 2>/dev/null
echo "  Created tenant: ${TENANT_ID}"

# Create membership record
$MYSQL_CMD -e "
    INSERT INTO ${DB_NAME}.tenant_members (id, tenant_id, user_id, role)
    VALUES ('${MEMBER_ID}', '${TENANT_ID}', '${USER_ID}', 'owner');
" 2>/dev/null
echo "  Created membership: owner"

# Create tenant database/schema
echo -e "${YELLOW}Creating tenant schema: ${SCHEMA_NAME}${NC}"

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Read template and replace placeholder
TEMPLATE_FILE="${SCRIPT_DIR}/01-tenant-template.sql"
if [ ! -f "$TEMPLATE_FILE" ]; then
    echo -e "${RED}Error: Template file not found: ${TEMPLATE_FILE}${NC}"
    exit 1
fi

# Create tenant schema by replacing placeholder in template
sed "s/{TENANT_SLUG}/${SLUG//-/_}/g" "$TEMPLATE_FILE" | $MYSQL_CMD 2>/dev/null

echo -e "${GREEN}✓ Tenant created successfully!${NC}"
echo ""
echo "=================================="
echo "Tenant Details:"
echo "=================================="
echo "  Subdomain:    ${SLUG}.gametaverns.com"
echo "  Database:     ${SCHEMA_NAME}"
echo "  Tenant ID:    ${TENANT_ID}"
echo "  Owner Email:  ${OWNER_EMAIL}"
echo ""
echo "The owner can now log in at:"
echo "  https://${SLUG}.gametaverns.com/login"
echo "=================================="
