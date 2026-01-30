#!/bin/bash
# =============================================================================
# Kong Configuration Renderer
# Substitutes environment variables in kong.yml
# =============================================================================

set -e

INSTALL_DIR="/opt/gametaverns"

if [ ! -f "$INSTALL_DIR/.env" ]; then
    echo "Error: .env file not found"
    exit 1
fi

source "$INSTALL_DIR/.env"

# Substitute variables in kong.yml
sed -e "s|{{ANON_KEY}}|${ANON_KEY}|g" \
    -e "s|{{SERVICE_ROLE_KEY}}|${SERVICE_ROLE_KEY}|g" \
    "$INSTALL_DIR/kong.yml.template" > "$INSTALL_DIR/kong.yml"

echo "Kong configuration rendered with API keys"
