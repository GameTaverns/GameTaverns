#!/bin/bash
# ============================================================================
# Genre Classification Runner
# Classifies all game_catalog entries into genres using Gemini Flash Lite
# 
# Usage: ./classify-genres.sh [batch_size] [delay_seconds]
#   batch_size:     Number of entries per API call (default: 50)
#   delay_seconds:  Seconds between batches (default: 6 = ~500/min)
#
# Run in a separate terminal window:
#   cd /opt/gametaverns/deploy/supabase-selfhosted/scripts
#   chmod +x classify-genres.sh
#   ./classify-genres.sh 2>&1 | tee genre-classification.log
# ============================================================================

set -euo pipefail

BATCH_SIZE="${1:-50}"
DELAY="${2:-6}"
FUNC_URL="http://kong:8000/functions/v1/catalog-backfill"

# Get service role key from DB settings
SERVICE_ROLE_KEY=$(docker exec gametaverns-db psql -U postgres -d postgres -t -A -c "SELECT current_setting('app.settings.service_role_key', true);")

if [ -z "$SERVICE_ROLE_KEY" ]; then
  echo "ERROR: Could not retrieve service_role_key from database settings"
  exit 1
fi

echo "============================================"
echo "🎮 Genre Classification - Gemini Flash Lite"
echo "============================================"
echo "Batch size: $BATCH_SIZE entries"
echo "Delay: ${DELAY}s between batches (~$((BATCH_SIZE * 60 / DELAY))/min)"
echo "Started: $(date)"
echo "============================================"
echo ""

TOTAL_CLASSIFIED=0
TOTAL_ERRORS=0
BATCH_NUM=0

while true; do
  BATCH_NUM=$((BATCH_NUM + 1))
  
  RESPONSE=$(docker exec gametaverns-functions curl -s \
    -X POST "$FUNC_URL" \
    -H "Content-Type: application/json" \
    -H "apikey: $SERVICE_ROLE_KEY" \
    -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
    -d "{\"mode\": \"classify-genres\", \"batch_size\": $BATCH_SIZE}")

  # Parse response
  SUCCESS=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('success', False))" 2>/dev/null || echo "False")
  CLASSIFIED=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('classified', 0))" 2>/dev/null || echo "0")
  HAS_MORE=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('hasMore', False))" 2>/dev/null || echo "False")
  ERRORS=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); errs=d.get('errors',[]); print(len(errs))" 2>/dev/null || echo "0")
  ERROR_MSG=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('error',''))" 2>/dev/null || echo "")

  if [ "$SUCCESS" != "True" ]; then
    echo "❌ [Batch $BATCH_NUM] FAILED: $ERROR_MSG"
    echo "   Full response: $RESPONSE"
    TOTAL_ERRORS=$((TOTAL_ERRORS + 1))
    
    if [ $TOTAL_ERRORS -ge 5 ]; then
      echo ""
      echo "⛔ Too many consecutive errors. Stopping."
      break
    fi
    
    # If rate limited, wait longer
    if echo "$RESPONSE" | grep -qi "rate.limit\|429"; then
      echo "   ⏳ Rate limited. Waiting 60s before retry..."
      sleep 60
    else
      sleep "$DELAY"
    fi
    continue
  fi

  # Reset error counter on success
  TOTAL_ERRORS=0
  TOTAL_CLASSIFIED=$((TOTAL_CLASSIFIED + CLASSIFIED))

  TIMESTAMP=$(date +"%H:%M:%S")
  echo "✅ [$TIMESTAMP] Batch $BATCH_NUM: classified $CLASSIFIED | Total: $TOTAL_CLASSIFIED | Errors in batch: $ERRORS | More: $HAS_MORE"

  if [ "$ERRORS" -gt 0 ]; then
    echo "   ⚠️  Errors: $(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); [print(f'     - {e}') for e in d.get('errors',[])]" 2>/dev/null)"
  fi

  if [ "$HAS_MORE" != "True" ]; then
    echo ""
    echo "============================================"
    echo "🎉 COMPLETE!"
    echo "Total classified: $TOTAL_CLASSIFIED"
    echo "Finished: $(date)"
    echo "============================================"
    break
  fi

  sleep "$DELAY"
done
