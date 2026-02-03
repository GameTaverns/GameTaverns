#!/bin/sh
# Inject runtime configuration into the frontend
# This runs at container start to inject environment-specific values
# Version: 2.7.0 - Complete Deployment Sweep Edition
# Audited: 2026-02-03
# Supports: Docker, Alpine, GNU/Linux
#
# CRITICAL FIXES IN THIS VERSION:
#   - SELF_HOSTED: false ensures we use Supabase client, NOT /api/* endpoints
#   - SUPABASE_URL points to the PUBLIC domain (same-origin)
#   - IS_PRODUCTION: true hides testing banner

set -e

CONFIG_FILE="/usr/share/nginx/html/runtime-config.js"
INDEX_FILE="/usr/share/nginx/html/index.html"

echo "=============================================="
echo "  Injecting Runtime Configuration"
echo "  Version: 2.7.0"
echo "=============================================="
echo ""
echo "  SUPABASE_URL: ${SUPABASE_URL:-not set}"
echo "  SUPABASE_ANON_KEY: ${SUPABASE_ANON_KEY:+configured}"
echo "  SITE_NAME: ${SITE_NAME:-GameTaverns}"
echo ""

# Escape special characters for JavaScript strings
escape_js() {
    printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g; s/'"'"'/\\'"'"'/g'
}

ESCAPED_SITE_NAME=$(escape_js "${SITE_NAME:-GameTaverns}")
ESCAPED_SITE_DESC=$(escape_js "${SITE_DESCRIPTION:-Browse and discover our collection of board games}")

# CRITICAL: Ensure SUPABASE_URL is set correctly
# This is the PUBLIC URL that the browser will use to access Supabase services
# It should be the main domain (e.g., https://gametaverns.com) because
# host Nginx proxies /auth/, /rest/, /functions/ to Kong on port 8000
SUPABASE_URL_VALUE="${SUPABASE_URL:-}"

# If SUPABASE_URL is not set but we have a SITE_URL, derive it
if [ -z "$SUPABASE_URL_VALUE" ] && [ -n "${SITE_URL:-}" ]; then
    SUPABASE_URL_VALUE="$SITE_URL"
    echo "  Derived SUPABASE_URL from SITE_URL: $SUPABASE_URL_VALUE"
fi

# Escape the URL for JavaScript
ESCAPED_SUPABASE_URL=$(escape_js "$SUPABASE_URL_VALUE")
ESCAPED_ANON_KEY=$(escape_js "${SUPABASE_ANON_KEY:-}")

# Generate runtime config with proper escaping using IIFE pattern
# IMPORTANT: 
# - SELF_HOSTED: false = Use Supabase client (Kong/GoTrue), NOT Express /api/*
#   The self-hosted Supabase stack IS a Supabase environment, just local.
#   The "self-hosted" mode in the frontend was for Express API, which we don't use.
# - IS_PRODUCTION: true = Hide testing banner, this IS a production deployment
# - SUPABASE_URL: The public URL where browser accesses the API (same-origin)
cat > "$CONFIG_FILE" << EOF
// Runtime configuration - injected at container start
// Generated: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
// Version: 2.7.0
// DO NOT EDIT - this file is auto-generated
(function() {
  'use strict';
  try {
    window.__RUNTIME_CONFIG__ = {
      // CRITICAL: false = Use standard Supabase client
      // true would trigger Express /api/* routing which we don't have
      SELF_HOSTED: false,
      
      // CRITICAL: true = Hide "Testing Environment" banner
      IS_PRODUCTION: true,
      
      // CRITICAL: The PUBLIC URL for Supabase services
      // Browser accesses /auth/, /rest/, /functions/ on this domain
      // Host Nginx proxies these to Kong on port 8000
      SUPABASE_URL: "${ESCAPED_SUPABASE_URL}",
      SUPABASE_ANON_KEY: "${ESCAPED_ANON_KEY}",
      
      // Site branding
      SITE_NAME: "${ESCAPED_SITE_NAME}",
      SITE_DESCRIPTION: "${ESCAPED_SITE_DESC}",
      
      // Feature flags
      FEATURE_DEMO_MODE: false,
      
      // Build metadata
      BUILD_TIME: "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    };
    
    // Log for debugging
    if (window.__RUNTIME_CONFIG__.SUPABASE_URL) {
      console.log('[GameTaverns] Runtime config loaded: Production Supabase Mode');
      console.log('[GameTaverns] API URL:', window.__RUNTIME_CONFIG__.SUPABASE_URL);
    } else {
      console.warn('[GameTaverns] No SUPABASE_URL configured - API calls may fail');
    }
  } catch (e) {
    console.error('[GameTaverns] Failed to load runtime config:', e);
  }
})();
EOF

# Ensure the file was created and is not empty
if [ ! -s "$CONFIG_FILE" ]; then
    echo "ERROR: Failed to create $CONFIG_FILE or file is empty"
    exit 1
fi

# Verify the config is valid JavaScript (basic syntax check)
if ! grep -q "window.__RUNTIME_CONFIG__" "$CONFIG_FILE"; then
    echo "ERROR: Config file appears malformed"
    exit 1
fi

echo "  ✓ Created $CONFIG_FILE ($(wc -c < "$CONFIG_FILE") bytes)"

# Inject script tag into index.html at the VERY BEGINNING of <head>
# This ensures config is available before any other scripts run
if [ -f "$INDEX_FILE" ]; then
    # Check if already injected
    if grep -q "runtime-config.js" "$INDEX_FILE"; then
        echo "  ✓ runtime-config.js already present in index.html"
    else
        # Create a backup first
        cp "$INDEX_FILE" "${INDEX_FILE}.bak"
        
        # Use sed to inject script tag after <head>
        # This pattern works on both GNU and Alpine's BusyBox sed
        sed -i 's|<head>|<head><script src="/runtime-config.js"></script>|' "$INDEX_FILE"
        
        # Verify injection worked
        if grep -q "runtime-config.js" "$INDEX_FILE"; then
            echo "  ✓ Injected runtime-config.js into index.html"
            rm -f "${INDEX_FILE}.bak"
        else
            echo "  ⚠ Warning: Could not inject script tag, restoring backup"
            mv "${INDEX_FILE}.bak" "$INDEX_FILE"
        fi
    fi
else
    echo "  ⚠ Warning: index.html not found at $INDEX_FILE"
fi

echo ""
echo "Runtime config injection complete"
echo ""
echo "Configuration Summary:"
echo "  SELF_HOSTED: false (using Supabase client)"
echo "  IS_PRODUCTION: true (no testing banner)"
echo "  SUPABASE_URL: ${SUPABASE_URL_VALUE:-not set}"
echo ""
