#!/bin/bash
# ============================================================================
# Full AI Bulk Enrichment Runner
# Runs both genre AND mechanic classification sequentially
#
# Usage: ./bulk-enrich.sh [genre_batch] [mech_batch] [delay]
#   genre_batch:  Entries per genre batch (default: 50)
#   mech_batch:   Entries per mechanic batch (default: 30)
#   delay:        Seconds between batches (default: 8)
#
# Run:
#   cd /opt/gametaverns/deploy/supabase-selfhosted/scripts
#   chmod +x bulk-enrich.sh classify-genres.sh classify-mechanics.sh
#   ./bulk-enrich.sh 2>&1 | tee bulk-enrich.log
# ============================================================================

set -uo pipefail

GENRE_BATCH="${1:-50}"
MECH_BATCH="${2:-30}"
DELAY="${3:-8}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "╔══════════════════════════════════════════╗"
echo "║  🎮 GameTaverns Full AI Enrichment       ║"
echo "║  Using Cortex (Gemini Flash Lite)        ║"
echo "╚══════════════════════════════════════════╝"
echo ""
echo "Started: $(date)"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Phase 1: Genre Classification"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
"$SCRIPT_DIR/classify-genres.sh" "$GENRE_BATCH" "$DELAY"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Phase 2: Mechanic Family Classification"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
"$SCRIPT_DIR/classify-mechanics.sh" "$MECH_BATCH" "$DELAY"

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║  🎉 Full Enrichment Complete!            ║"
echo "║  Finished: $(date)"
echo "╚══════════════════════════════════════════╝"
