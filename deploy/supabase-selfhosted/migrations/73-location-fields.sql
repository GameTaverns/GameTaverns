-- =============================================================================
-- Migration 73: Add location fields to library_settings
-- =============================================================================

SET LOCAL lock_timeout = '5s';

ALTER TABLE public.library_settings
  ADD COLUMN IF NOT EXISTS location_city    TEXT,
  ADD COLUMN IF NOT EXISTS location_region  TEXT,
  ADD COLUMN IF NOT EXISTS location_country TEXT;
