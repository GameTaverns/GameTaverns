#!/bin/bash
# =============================================================================
# Post Latest Changelog to Discord
# Reads the most recent version block from CHANGELOG.md and posts it
# to a Discord webhook URL.
# =============================================================================

set -e

INSTALL_DIR="/opt/gametaverns"
CHANGELOG="$INSTALL_DIR/CHANGELOG.md"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Load .env for DISCORD_CHANGELOG_WEBHOOK_URL
if [ -f "$INSTALL_DIR/.env" ]; then
    set -a
    source "$INSTALL_DIR/.env"
    set +a
fi

WEBHOOK_URL="${DISCORD_CHANGELOG_WEBHOOK_URL:-}"

if [ -z "$WEBHOOK_URL" ]; then
    echo -e "${YELLOW}DISCORD_CHANGELOG_WEBHOOK_URL not set in .env — skipping changelog post${NC}"
    exit 0
fi

if [ ! -f "$CHANGELOG" ]; then
    echo -e "${YELLOW}CHANGELOG.md not found at $CHANGELOG — skipping${NC}"
    exit 0
fi

# Extract the latest version block (from first ## [...] to the next ## [...] or end)
LATEST_BLOCK=$(awk '
    /^## \[/ {
        if (found) exit;
        found=1;
    }
    found { print }
' "$CHANGELOG")

if [ -z "$LATEST_BLOCK" ]; then
    echo -e "${YELLOW}No changelog entries found — skipping${NC}"
    exit 0
fi

# Extract version and date from the header line
VERSION=$(echo "$LATEST_BLOCK" | head -1 | sed 's/^## \[\(.*\)\].*/\1/')
DATE=$(echo "$LATEST_BLOCK" | head -1 | sed 's/.*— \(.*\)/\1/')

# Build the Discord message content (strip the header, limit to 1900 chars for Discord)
BODY=$(echo "$LATEST_BLOCK" | tail -n +2)

# Truncate if too long for Discord (2000 char limit minus embed overhead)
if [ ${#BODY} -gt 1800 ]; then
    BODY="${BODY:0:1800}

... _(truncated — see full changelog on GitHub)_"
fi

# Escape for JSON: backslashes, quotes, newlines
BODY_ESCAPED=$(echo "$BODY" | python3 -c '
import sys, json
print(json.dumps(sys.stdin.read())[1:-1])
' 2>/dev/null || echo "$BODY" | sed 's/\\/\\\\/g; s/"/\\"/g' | awk '{printf "%s\\n", $0}')

# Post to Discord using embeds for a nice format
PAYLOAD=$(cat <<EOF
{
  "embeds": [{
    "title": "🎲 GameTaverns ${VERSION}",
    "description": "${BODY_ESCAPED}",
    "color": 16750848,
    "footer": {
      "text": "Released ${DATE}"
    }
  }]
}
EOF
)

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD" \
    "$WEBHOOK_URL")

if [ "$HTTP_CODE" = "204" ] || [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ Changelog v${VERSION} posted to Discord${NC}"
else
    echo -e "${RED}✗ Failed to post changelog to Discord (HTTP ${HTTP_CODE})${NC}"
fi
