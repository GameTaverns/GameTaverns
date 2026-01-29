#!/bin/bash
#
# Create admin user for GameTaverns
#
# Usage: ./create-admin.sh
#

set -e

INSTALL_DIR="/opt/gametaverns"
DB_NAME="gametaverns"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo ""
echo "╔═══════════════════════════════════════════════════════════════════╗"
echo "║          GameTaverns - Create Admin User                          ║"
echo "╚═══════════════════════════════════════════════════════════════════╝"
echo ""

# Check if server directory exists
if [[ ! -d "${INSTALL_DIR}/server" ]]; then
    echo -e "${RED}[ERROR]${NC} Server not found at ${INSTALL_DIR}/server"
    echo "Run the installer first: sudo ./install.sh"
    exit 1
fi

# Check if bcryptjs is installed
if [[ ! -d "${INSTALL_DIR}/server/node_modules/bcryptjs" ]]; then
    echo -e "${YELLOW}[INFO]${NC} Installing dependencies..."
    cd ${INSTALL_DIR}/server && npm install bcryptjs --silent
fi

# Get admin details
read -p "Email address: " ADMIN_EMAIL

# Validate email
if [[ ! "$ADMIN_EMAIL" =~ ^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$ ]]; then
    echo -e "${RED}[ERROR]${NC} Invalid email address"
    exit 1
fi

# Check if user already exists
EXISTING=$(sudo -u postgres psql -d ${DB_NAME} -tAc "SELECT 1 FROM users WHERE email = '${ADMIN_EMAIL}'" 2>/dev/null || echo "")
if [[ "$EXISTING" == "1" ]]; then
    echo -e "${YELLOW}[WARN]${NC} User already exists. Update password? (y/N)"
    read -r UPDATE
    if [[ ! "$UPDATE" =~ ^[Yy]$ ]]; then
        echo "Cancelled."
        exit 0
    fi
fi

# Get password (with confirmation)
while true; do
    read -s -p "Password (min 8 chars): " ADMIN_PASSWORD
    echo ""
    
    if [[ ${#ADMIN_PASSWORD} -lt 8 ]]; then
        echo -e "${RED}[ERROR]${NC} Password must be at least 8 characters"
        continue
    fi
    
    read -s -p "Confirm password: " ADMIN_PASSWORD_CONFIRM
    echo ""
    
    if [[ "$ADMIN_PASSWORD" != "$ADMIN_PASSWORD_CONFIRM" ]]; then
        echo -e "${RED}[ERROR]${NC} Passwords don't match"
        continue
    fi
    
    break
done

read -p "Display name: " DISPLAY_NAME
DISPLAY_NAME=${DISPLAY_NAME:-Admin}

# Hash password using Node.js bcrypt
echo ""
echo -e "${YELLOW}[INFO]${NC} Creating admin user..."

cd ${INSTALL_DIR}/server
PASSWORD_HASH=$(node -e "console.log(require('bcryptjs').hashSync('${ADMIN_PASSWORD}', 12))")

# Insert/update user and assign admin role
sudo -u postgres psql -d ${DB_NAME} <<EOF >/dev/null 2>&1
-- Create or update user
INSERT INTO users (email, password_hash, email_verified)
VALUES ('${ADMIN_EMAIL}', '${PASSWORD_HASH}', true)
ON CONFLICT (email) DO UPDATE SET 
    password_hash = EXCLUDED.password_hash,
    email_verified = true,
    updated_at = NOW();

-- Ensure profile and role exist
DO \$\$
DECLARE
    user_uuid UUID;
BEGIN
    SELECT id INTO user_uuid FROM users WHERE email = '${ADMIN_EMAIL}';
    
    -- Create/update profile
    INSERT INTO user_profiles (user_id, display_name)
    VALUES (user_uuid, '${DISPLAY_NAME}')
    ON CONFLICT (user_id) DO UPDATE SET 
        display_name = EXCLUDED.display_name,
        updated_at = NOW();
    
    -- Assign admin role
    INSERT INTO user_roles (user_id, role)
    VALUES (user_uuid, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
END;
\$\$;
EOF

echo ""
echo -e "${GREEN}[OK]${NC} Admin user created successfully!"
echo ""
echo "Log in at your site with:"
echo "  Email: ${ADMIN_EMAIL}"
echo "  Password: (the password you entered)"
echo ""
