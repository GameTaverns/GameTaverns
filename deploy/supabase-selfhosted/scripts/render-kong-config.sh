#!/bin/bash
# =============================================================================
# Kong Configuration Renderer
# Substitutes placeholder API keys in kong.yml
# Version: 2.7.4 - Single .env Edition
# Audited: 2026-02-03
# =============================================================================
# 
# This script is generally NOT needed - install.sh directly substitutes the
# placeholders in kong.yml. This utility is for manually re-rendering the
# config after key rotation.
#
# SINGLE .ENV ARCHITECTURE:
#   - All config lives in /opt/gametaverns/.env
#   - NEVER duplicate .env files
# =============================================================================

set -e

# ===========================================
# Configuration - SINGLE .ENV ARCHITECTURE
# ===========================================
INSTALL_DIR="/opt/gametaverns"
ENV_FILE="$INSTALL_DIR/.env"

if [ ! -f "$ENV_FILE" ]; then
    echo "Error: .env file not found at $ENV_FILE"
    exit 1
fi

source "$ENV_FILE"

if [ -z "$ANON_KEY" ] || [ -z "$SERVICE_ROLE_KEY" ]; then
    echo "Error: ANON_KEY or SERVICE_ROLE_KEY not set in .env"
    exit 1
fi

# Substitute placeholder keys in kong.yml (matches install.sh format)
# install.sh uses ANON_KEY_PLACEHOLDER and SERVICE_ROLE_KEY_PLACEHOLDER
sed -i \
    -e "s|ANON_KEY_PLACEHOLDER|${ANON_KEY}|g" \
    -e "s|SERVICE_ROLE_KEY_PLACEHOLDER|${SERVICE_ROLE_KEY}|g" \
    "$INSTALL_DIR/kong.yml"

echo "Kong configuration rendered with API keys"
echo ""
echo "Verify keys were substituted:"
echo "  grep -q 'PLACEHOLDER' $INSTALL_DIR/kong.yml && echo 'KEYS NOT SET' || echo 'Keys configured'"
