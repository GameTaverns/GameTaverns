-- Fix gallery backfill stuck loop
-- Previously, entries with no BGG gallery images stayed NULL and got re-processed forever
-- Now: mark them with empty array [] so they're skipped on future runs
-- Also: backfill entries that returned 0 images (set to empty array)

-- Mark entries that were previously stuck (have bgg_id, no gallery, but have been enriched)
-- These are likely games with genuinely no gallery images on BGG
-- The updated edge function now sets [] for these automatically
