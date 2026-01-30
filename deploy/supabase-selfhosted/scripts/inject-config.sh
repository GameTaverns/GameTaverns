#!/bin/sh
# Inject runtime configuration into the frontend
# This runs at container start to inject environment-specific values

set -e

CONFIG_FILE="/usr/share/nginx/html/runtime-config.js"
INDEX_FILE="/usr/share/nginx/html/index.html"

echo "Injecting runtime configuration..."
echo "  SUPABASE_URL: ${SUPABASE_URL:-not set}"
echo "  SITE_NAME: ${SITE_NAME:-GameTaverns}"

# Generate runtime config with proper escaping
cat > "$CONFIG_FILE" << EOF
// Runtime configuration - injected at container start
// DO NOT EDIT - this file is auto-generated
(function() {
  window.__RUNTIME_CONFIG__ = {
    SELF_HOSTED: true,
    SUPABASE_URL: "${SUPABASE_URL:-}",
    SUPABASE_ANON_KEY: "${SUPABASE_ANON_KEY:-}",
    SITE_NAME: "${SITE_NAME:-GameTaverns}",
    SITE_DESCRIPTION: "${SITE_DESCRIPTION:-Browse and discover our collection of board games}",
    FEATURE_DEMO_MODE: false
  };
  console.log('[GameTaverns] Runtime config loaded:', window.__RUNTIME_CONFIG__.SELF_HOSTED ? 'Self-Hosted Mode' : 'Cloud Mode');
})();
EOF

# Ensure the file was created and is not empty
if [ ! -s "$CONFIG_FILE" ]; then
    echo "ERROR: Failed to create $CONFIG_FILE or file is empty"
    exit 1
fi

echo "  ✓ Created $CONFIG_FILE"

# Inject script tag into index.html at the VERY BEGINNING of <head>
# This ensures config is available before any other scripts run
if [ -f "$INDEX_FILE" ]; then
    # Check if already injected
    if grep -q "runtime-config.js" "$INDEX_FILE"; then
        echo "  ✓ runtime-config.js already present in index.html"
    else
        # Use sed to inject script tag after <head>
        # This pattern works on both GNU and Alpine's BusyBox sed
        sed -i 's|<head>|<head><script src="/runtime-config.js"></script>|' "$INDEX_FILE"
        
        # Verify injection worked
        if grep -q "runtime-config.js" "$INDEX_FILE"; then
            echo "  ✓ Injected runtime-config.js into index.html"
        else
            echo "  ⚠ Warning: Could not inject script tag into index.html"
        fi
    fi
else
    echo "  ⚠ Warning: index.html not found at $INDEX_FILE"
fi

echo "Runtime config injection complete"
