#!/bin/bash
# ============================================================================
# Expansion Parent Linker
# Links orphaned expansions to parent games via title prefix matching
# No BGG API calls — runs entirely against local database
#
# Usage: ./link-expansions.sh [batch_size] [dry_run]
#   batch_size:  Number of expansions per batch (default: 1000)
#   dry_run:     Set to "true" for preview without changes (default: false)
#
# Run:
#   cd /opt/gametaverns/deploy/supabase-selfhosted/scripts
#   chmod +x link-expansions.sh
#   ./link-expansions.sh 1000 true    # dry run first
#   ./link-expansions.sh 1000         # then for real
# ============================================================================

set -uo pipefail

BATCH_SIZE="${1:-1000}"
DRY_RUN="${2:-false}"
FUNC_URL="http://localhost:8000/functions/v1/catalog-backfill"

SERVICE_ROLE_KEY=$(docker exec gametaverns-db psql -U postgres -d postgres -t -A -c "SELECT current_setting('app.settings.service_role_key', true);" | tr -d '[:space:]')

if [ -z "$SERVICE_ROLE_KEY" ]; then
  echo "ERROR: Could not retrieve service_role_key"
  exit 1
fi

echo "============================================"
echo "🔗 Expansion Parent Linker (Title Matching)"
echo "============================================"
echo "Batch size: $BATCH_SIZE"
echo "Dry run: $DRY_RUN"
echo "Started: $(date)"
echo "============================================"
echo ""

TOTAL_LINKED=0
TOTAL_NO_MATCH=0
BATCH_NUM=0
OFFSET=0

while true; do
  BATCH_NUM=$((BATCH_NUM + 1))

  RAW_RESPONSE=$(curl -sS \
    --connect-timeout 10 \
    --max-time 300 \
    -w "\nHTTP_STATUS:%{http_code}" \
    -X POST "$FUNC_URL" \
    -H "Content-Type: application/json" \
    -H "apikey: $SERVICE_ROLE_KEY" \
    -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
    -d "{\"mode\": \"link-expansions\", \"batch_size\": $BATCH_SIZE, \"dry_run\": $DRY_RUN, \"offset\": $OFFSET}" 2>&1)

  CURL_EXIT=$?
  if [ $CURL_EXIT -ne 0 ]; then
    echo "❌ [Batch $BATCH_NUM] curl failed (exit $CURL_EXIT)"
    break
  fi

  HTTP_STATUS=$(echo "$RAW_RESPONSE" | sed -n 's/^HTTP_STATUS://p' | tail -1)
  RESPONSE=$(echo "$RAW_RESPONSE" | sed '/^HTTP_STATUS:/d')

  if [ -z "$HTTP_STATUS" ] || [ "$HTTP_STATUS" -lt 200 ] || [ "$HTTP_STATUS" -ge 300 ]; then
    echo "❌ [Batch $BATCH_NUM] HTTP $HTTP_STATUS"
    echo "   $RESPONSE"
    break
  fi

  LINKED=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('linked', 0))" 2>/dev/null || echo "0")
  NO_MATCH=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('no_match', 0))" 2>/dev/null || echo "0")
  HAS_MORE=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('hasMore', False))" 2>/dev/null || echo "False")
  IS_DRY=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('dry_run', False))" 2>/dev/null || echo "False")

  TOTAL_LINKED=$((TOTAL_LINKED + LINKED))
  TOTAL_NO_MATCH=$((TOTAL_NO_MATCH + NO_MATCH))

  TIMESTAMP=$(date +"%H:%M:%S")
  echo "✅ [$TIMESTAMP] Batch $BATCH_NUM: linked=$LINKED no_match=$NO_MATCH | Total linked: $TOTAL_LINKED | dry_run=$IS_DRY"

  # Show sample links
  echo "$RESPONSE" | python3 -c "
import sys, json
d = json.load(sys.stdin)
for s in d.get('sample_links', [])[:5]:
    print(f'   🔗 \"{s[\"expansion\"]}\" → \"{s[\"parent\"]}\"')
for s in d.get('sample_no_match', [])[:3]:
    print(f'   ❓ No match: \"{s}\"')
" 2>/dev/null || true

  if [ "$HAS_MORE" != "True" ]; then
    echo ""
    echo "============================================"
    echo "🎉 COMPLETE!"
    echo "Total linked: $TOTAL_LINKED"
    echo "Total no match: $TOTAL_NO_MATCH"
    echo "Finished: $(date)"
    echo "============================================"
    break
  fi

  sleep 1
done
