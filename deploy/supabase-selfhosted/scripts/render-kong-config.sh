#!/bin/bash
# =============================================================================
# Kong Configuration Renderer
# Substitutes environment variables in kong.yml
# Version: 2.2.0 - 5-Tier Role Hierarchy
# Last Audit: 2026-01-31
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
