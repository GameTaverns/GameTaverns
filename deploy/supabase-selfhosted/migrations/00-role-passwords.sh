#!/bin/sh
# =============================================================================
# GameTaverns Self-Hosted: Bootstrap role passwords
# Version: 2.3.3
#
# Purpose:
# GoTrue (auth) connects as supabase_auth_admin using POSTGRES_PASSWORD.
# On a fresh initdb, these internal roles may exist without passwords,
# causing GoTrue/PostgREST/Storage to crash-loop with SASL auth failures.
#
# This script runs automatically via Postgres image initdb.d.
# =============================================================================

set -eu

if [ -z "${POSTGRES_PASSWORD:-}" ]; then
  echo "[00-role-passwords] POSTGRES_PASSWORD is not set; cannot bootstrap role passwords" >&2
  exit 1
fi

# psql variables are safer than string interpolation.
psql -v ON_ERROR_STOP=1 --username "supabase_admin" --dbname "postgres" <<'EOSQL'
DO $$
BEGIN
  -- Create roles if missing (fresh install safety)
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticator') THEN
    CREATE ROLE authenticator WITH LOGIN NOINHERIT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
    CREATE ROLE supabase_auth_admin WITH LOGIN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_storage_admin') THEN
    CREATE ROLE supabase_storage_admin WITH LOGIN;
  END IF;

  -- GoTrue expects a postgres role to exist (it hardcodes grants to it)
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'postgres') THEN
    CREATE ROLE postgres WITH LOGIN SUPERUSER;
  END IF;
END $$;
EOSQL

psql -v ON_ERROR_STOP=1 -v POSTGRES_PASSWORD="${POSTGRES_PASSWORD}" --username "supabase_admin" --dbname "postgres" <<EOSQL
-- Ensure login roles have passwords matching POSTGRES_PASSWORD
ALTER ROLE authenticator WITH LOGIN PASSWORD :'POSTGRES_PASSWORD';
ALTER ROLE supabase_auth_admin WITH LOGIN PASSWORD :'POSTGRES_PASSWORD';
ALTER ROLE supabase_storage_admin WITH LOGIN PASSWORD :'POSTGRES_PASSWORD';
ALTER ROLE supabase_admin WITH PASSWORD :'POSTGRES_PASSWORD';

-- Optional but helpful for troubleshooting (lets you psql as postgres if needed)
ALTER ROLE postgres WITH LOGIN PASSWORD :'POSTGRES_PASSWORD';
EOSQL

echo "[00-role-passwords] Bootstrapped internal role passwords"
