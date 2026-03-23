#!/bin/bash
# ============================================================================
# Mechanic Family Classification Runner
# Classifies catalog entries into mechanic families using Gemini Flash Lite
#
# Usage: ./classify-mechanics.sh [batch_size] [delay_seconds]
#   batch_size:     Number of entries per API call (default: 30)
#   delay_seconds:  Seconds between batches (default: 8)
#
# Run in a separate terminal window:
#   cd /opt/gametaverns/deploy/supabase-selfhosted/scripts
#   chmod +x classify-mechanics.sh
#   ./classify-mechanics.sh 2>&1 | tee mechanic-classification.log
# ============================================================================

set -uo pipefail

BATCH_SIZE="${1:-30}"
DELAY="${2:-8}"
FUNC_URL="http://localhost:8000/functions/v1/catalog-backfill"
MAX_CONSECUTIVE_ERRORS=5

# Get service role key from DB settings
SERVICE_ROLE_KEY=$(docker exec gametaverns-db psql -U postgres -d postgres -t -A -c "SELECT current_setting('app.settings.service_role_key', true);" | tr -d '[:space:]')

if [ -z "$SERVICE_ROLE_KEY" ]; then
  echo "ERROR: Could not retrieve service_role_key from database settings"
  exit 1
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "ERROR: curl is not available on this host. Install with: apt install curl"
  exit 1
fi

echo "============================================"
echo "🔧 Mechanic Family Classification - Gemini"
echo "============================================"
echo "Batch size: $BATCH_SIZE entries"
echo "Delay: ${DELAY}s between batches"
echo "Started: $(date)"
echo "============================================"
echo ""

TOTAL_CLASSIFIED=0
TOTAL_MECHANICS=0
TOTAL_ERRORS=0
BATCH_NUM=0

while true; do
  BATCH_NUM=$((BATCH_NUM + 1))

  RAW_RESPONSE=$(curl -sS \
    --connect-timeout 10 \
    --max-time 120 \
    -w "\nHTTP_STATUS:%{http_code}" \
    -X POST "$FUNC_URL" \
    -H "Content-Type: application/json" \
    -H "apikey: $SERVICE_ROLE_KEY" \
    -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
    -d "{\"mode\": \"classify-mechanics\", \"batch_size\": $BATCH_SIZE}" 2>&1)

  CURL_EXIT=$?
  if [ $CURL_EXIT -ne 0 ]; then
    echo "❌ [Batch $BATCH_NUM] curl failed (exit $CURL_EXIT): $RAW_RESPONSE"
    TOTAL_ERRORS=$((TOTAL_ERRORS + 1))
    if [ $TOTAL_ERRORS -ge $MAX_CONSECUTIVE_ERRORS ]; then
      echo "⛔ Too many consecutive errors. Stopping."
      break
    fi
    sleep "$DELAY"
    continue
  fi

  HTTP_STATUS=$(echo "$RAW_RESPONSE" | sed -n 's/^HTTP_STATUS://p' | tail -1)
  RESPONSE=$(echo "$RAW_RESPONSE" | sed '/^HTTP_STATUS:/d')

  if [ -z "$HTTP_STATUS" ] || [ "$HTTP_STATUS" -lt 200 ] || [ "$HTTP_STATUS" -ge 300 ]; then
    echo "❌ [Batch $BATCH_NUM] HTTP error: ${HTTP_STATUS:-unknown}"
    echo "   Response: $RESPONSE"
    TOTAL_ERRORS=$((TOTAL_ERRORS + 1))
    if [ $TOTAL_ERRORS -ge $MAX_CONSECUTIVE_ERRORS ]; then
      echo "⛔ Too many consecutive errors. Stopping."
      break
    fi
    if echo "$RESPONSE" | grep -qi "rate.limit\|429\|quota"; then
      echo "   ⏳ Rate limited. Waiting 60s before retry..."
      sleep 60
    else
      sleep "$DELAY"
    fi
    continue
  fi

  SUCCESS=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('success', False))" 2>/dev/null || echo "False")
  CLASSIFIED=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('classified', 0))" 2>/dev/null || echo "0")
  MECHS_INSERTED=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('mechanics_inserted', 0))" 2>/dev/null || echo "0")
  HAS_MORE=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('hasMore', False))" 2>/dev/null || echo "False")
  ERRORS=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); errs=d.get('errors',[]); print(len(errs))" 2>/dev/null || echo "0")
  ERROR_MSG=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('error',''))" 2>/dev/null || echo "")

  if [ "$SUCCESS" != "True" ]; then
    echo "❌ [Batch $BATCH_NUM] FAILED: $ERROR_MSG"
    TOTAL_ERRORS=$((TOTAL_ERRORS + 1))
    if [ $TOTAL_ERRORS -ge $MAX_CONSECUTIVE_ERRORS ]; then
      echo "⛔ Too many consecutive errors. Stopping."
      break
    fi
    if echo "$RESPONSE" | grep -qi "rate.limit\|429\|quota"; then
      echo "   ⏳ Rate limited. Waiting 60s before retry..."
      sleep 60
    else
      sleep "$DELAY"
    fi
    continue
  fi

  TOTAL_ERRORS=0
  TOTAL_CLASSIFIED=$((TOTAL_CLASSIFIED + CLASSIFIED))
  TOTAL_MECHANICS=$((TOTAL_MECHANICS + MECHS_INSERTED))

  TIMESTAMP=$(date +"%H:%M:%S")
  echo "✅ [$TIMESTAMP] Batch $BATCH_NUM: classified $CLASSIFIED (+$MECHS_INSERTED mechanics) | Total: $TOTAL_CLASSIFIED games, $TOTAL_MECHANICS mechanics | Errors: $ERRORS | More: $HAS_MORE"

  if [ "$ERRORS" -gt 0 ]; then
    echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); [print(f'   ⚠️  {e}') for e in d.get('errors',[])]" 2>/dev/null || true
  fi

  if [ "$HAS_MORE" != "True" ]; then
    echo ""
    echo "============================================"
    echo "🎉 COMPLETE!"
    echo "Total games classified: $TOTAL_CLASSIFIED"
    echo "Total mechanics inserted: $TOTAL_MECHANICS"
    echo "Finished: $(date)"
    echo "============================================"
    break
  fi

  sleep "$DELAY"
done
