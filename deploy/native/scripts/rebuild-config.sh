#!/bin/bash
#
# Regenerate runtime-config.js for self-hosted deployment
# Run after updates or to refresh configuration
#

set -e

INSTALL_DIR="/opt/gametaverns"
CONFIG_JS="${INSTALL_DIR}/app/runtime-config.js"
INDEX_FILE="${INSTALL_DIR}/app/index.html"

echo "[INFO] Regenerating runtime configuration..."

# Create runtime config JavaScript file
cat > "$CONFIG_JS" <<'EOF'
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

# Ensure script tag is in index.html
if ! grep -q "runtime-config.js" "$INDEX_FILE"; then
    sed -i 's|<script|<script src="/runtime-config.js"></script>\n    <script|' "$INDEX_FILE"
    echo "[INFO] Runtime config script injected into index.html"
fi

# Set permissions
chown gametaverns:gametaverns "$CONFIG_JS"
chmod 644 "$CONFIG_JS"

echo "[OK] Runtime configuration regenerated at $CONFIG_JS"
echo ""
echo "Reload nginx to apply changes:"
echo "  sudo systemctl reload nginx"
