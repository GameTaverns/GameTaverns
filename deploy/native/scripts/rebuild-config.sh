#!/bin/bash
#
# Regenerate runtime-config.js for self-hosted deployment
# Run after updates or to refresh configuration
#

set -e

INSTALL_DIR="/opt/gametaverns"

# In the native deployment we build into /opt/gametaverns/dist then sync to /opt/gametaverns/app.
# Inject runtime-config.js into the BUILT index.html (dist) BEFORE syncing, otherwise it will be overwritten.
DIST_DIR="${INSTALL_DIR}/dist"
APP_DIR="${INSTALL_DIR}/app"

CONFIG_JS_DIST="${DIST_DIR}/runtime-config.js"
CONFIG_JS_APP="${APP_DIR}/runtime-config.js"

INDEX_FILE_DIST="${DIST_DIR}/index.html"
INDEX_FILE_APP="${APP_DIR}/index.html"

echo "[INFO] Regenerating runtime configuration..."

# Create runtime config JavaScript file (write to both dist and app)
mkdir -p "$DIST_DIR" "$APP_DIR"

write_runtime_config() {
  local target="$1"
  cat > "$target" <<'EOF'
// GameTaverns Self-Hosted Runtime Configuration
// Generated: $(date)
window.__RUNTIME_CONFIG__ = {
  SELF_HOSTED: true,
  API_BASE_URL: "/api",
  SUPABASE_URL: "",
  SUPABASE_ANON_KEY: "",
  SITE_NAME: "GameTaverns",
  FEATURES: {
    PLAY_LOGS: true,
    WISHLIST: true,
    FOR_SALE: true,
    MESSAGING: true,
    COMING_SOON: true,
    RATINGS: true,
    EVENTS: true,
    ACHIEVEMENTS: true,
    LENDING: true
  }
};
console.log('[GameTaverns] Self-hosted mode active');
EOF
}

write_runtime_config "$CONFIG_JS_DIST"
write_runtime_config "$CONFIG_JS_APP"

inject_into_index() {
  local indexFile="$1"
  if [ ! -f "$indexFile" ]; then
    echo "[WARN] index.html not found at $indexFile (skipping injection)"
    return 0
  fi

  if grep -q "runtime-config.js" "$indexFile"; then
    echo "[INFO] runtime-config.js already referenced in $indexFile"
    return 0
  fi

  # IMPORTANT: must be early in <head> before the main bundle executes.
  # Insert immediately after the opening <head> tag.
  sed -i 's|<head>|<head>\n    <script src="/runtime-config.js"></script>|' "$indexFile"
  echo "[INFO] Runtime config script injected into $indexFile"
}

inject_into_index "$INDEX_FILE_DIST"
inject_into_index "$INDEX_FILE_APP"

# Set permissions (best-effort; user/group may vary)
chown gametaverns:gametaverns "$CONFIG_JS_DIST" "$CONFIG_JS_APP" 2>/dev/null || true
chmod 644 "$CONFIG_JS_DIST" "$CONFIG_JS_APP" 2>/dev/null || true

echo "[OK] Runtime configuration regenerated:"
echo "  - $CONFIG_JS_DIST"
echo "  - $CONFIG_JS_APP"
echo ""
echo "Reload nginx to apply changes:"
echo "  sudo systemctl reload nginx"
