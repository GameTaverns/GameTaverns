#!/bin/sh
set -eu

# Render Kong declarative config with env vars.
#
# Why: Kong does not consistently substitute ${VAR} placeholders inside
# declarative YAML. When it fails, key-auth credentials are stored as the
# literal string "${SUPABASE_ANON_KEY}", and every request gets 401.

SRC="/home/kong/kong.yml"
OUT="/home/kong/kong.generated.yml"

if [ ! -f "$SRC" ]; then
  echo "[kong-render] Missing source config: $SRC" >&2
  exit 1
fi

ANON_KEY="${SUPABASE_ANON_KEY:-}"
SERVICE_KEY="${SUPABASE_SERVICE_KEY:-}"

if [ -z "$ANON_KEY" ]; then
  echo "[kong-render] SUPABASE_ANON_KEY is empty; key-auth will fail." >&2
fi

# Escape for sed replacement.
escape_sed() {
  # escape: backslash, ampersand, delimiter
  printf '%s' "$1" | sed -e 's/[\\&|]/\\\\&/g'
}

ANON_ESC="$(escape_sed "$ANON_KEY")"
SERVICE_ESC="$(escape_sed "$SERVICE_KEY")"

sed \
  -e "s|\${SUPABASE_ANON_KEY}|$ANON_ESC|g" \
  -e "s|\${SUPABASE_SERVICE_KEY}|$SERVICE_ESC|g" \
  "$SRC" > "$OUT"

echo "[kong-render] Wrote rendered config to $OUT" >&2
