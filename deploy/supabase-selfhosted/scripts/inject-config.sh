#!/bin/sh
# Inject runtime configuration into the frontend
# This runs at container start to inject environment-specific values
# Version: 2.1.0
# Supports: Docker, Alpine, GNU/Linux

set -e

CONFIG_FILE="/usr/share/nginx/html/runtime-config.js"
INDEX_FILE="/usr/share/nginx/html/index.html"

echo "=============================================="
echo "  Injecting Runtime Configuration"
echo "=============================================="
echo ""
echo "  SUPABASE_URL: ${SUPABASE_URL:-not set}"
echo "  SITE_NAME: ${SITE_NAME:-GameTaverns}"
echo ""

# Escape special characters for JavaScript strings
escape_js() {
    printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g; s/'"'"'/\\'"'"'/g'
}

ESCAPED_SITE_NAME=$(escape_js "${SITE_NAME:-GameTaverns}")
ESCAPED_SITE_DESC=$(escape_js "${SITE_DESCRIPTION:-Browse and discover our collection of board games}")

# Generate runtime config with proper escaping using IIFE pattern
cat > "$CONFIG_FILE" << EOF
// Runtime configuration - injected at container start
// Generated: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
// DO NOT EDIT - this file is auto-generated
(function() {
  'use strict';
  try {
    window.__RUNTIME_CONFIG__ = {
      SELF_HOSTED: true,
      SUPABASE_URL: "${SUPABASE_URL:-}",
      SUPABASE_ANON_KEY: "${SUPABASE_ANON_KEY:-}",
      SITE_NAME: "${ESCAPED_SITE_NAME}",
      SITE_DESCRIPTION: "${ESCAPED_SITE_DESC}",
      FEATURE_DEMO_MODE: false,
      BUILD_TIME: "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    };
    console.log('[GameTaverns] Runtime config loaded: Self-Hosted Mode');
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
