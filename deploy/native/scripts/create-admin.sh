#!/bin/bash
#
# Create first admin user for GameTaverns
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
echo "║          GameTaverns - Create Admin User                         ║"
echo "╚═══════════════════════════════════════════════════════════════════╝"
echo ""

# Get admin details
read -p "Email address: " ADMIN_EMAIL
read -s -p "Password (min 8 chars): " ADMIN_PASSWORD
echo ""
read -p "Display name: " DISPLAY_NAME

# Validate
if [[ ${#ADMIN_PASSWORD} -lt 8 ]]; then
    echo -e "${RED}[ERROR]${NC} Password must be at least 8 characters"
    exit 1
fi

if [[ ! "$ADMIN_EMAIL" =~ ^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$ ]]; then
    echo -e "${RED}[ERROR]${NC} Invalid email address"
    exit 1
fi

# Hash password using Node.js bcrypt
echo ""
echo -e "${YELLOW}[INFO]${NC} Creating admin user..."

# Create temp script to hash password
cat > /tmp/hash-password.js <<EOF
const bcrypt = require('bcryptjs');
const password = process.argv[2];
const hash = bcrypt.hashSync(password, 12);
console.log(hash);
EOF

cd ${INSTALL_DIR}/server
PASSWORD_HASH=$(node /tmp/hash-password.js "${ADMIN_PASSWORD}")
rm /tmp/hash-password.js

# Insert user and assign admin role
sudo -u postgres psql -d ${DB_NAME} <<EOF
-- Create user
INSERT INTO users (email, password_hash, email_verified)
VALUES ('${ADMIN_EMAIL}', '${PASSWORD_HASH}', true)
ON CONFLICT (email) DO UPDATE SET 
    password_hash = EXCLUDED.password_hash,
    email_verified = true;

-- Get user ID
DO \$\$
DECLARE
    user_uuid UUID;
BEGIN
    SELECT id INTO user_uuid FROM users WHERE email = '${ADMIN_EMAIL}';
    
    -- Update display name
    UPDATE user_profiles 
    SET display_name = '${DISPLAY_NAME}'
    WHERE user_id = user_uuid;
    
    -- Assign admin role
    INSERT INTO user_roles (user_id, role)
    VALUES (user_uuid, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
    
    RAISE NOTICE 'Admin user created with ID: %', user_uuid;
END;
\$\$;
EOF

echo ""
echo -e "${GREEN}[OK]${NC} Admin user created successfully!"
echo ""
echo "You can now log in at your site with:"
echo "  Email: ${ADMIN_EMAIL}"
echo "  Password: (the password you entered)"
echo ""
