-- Step 1: Add co_owner value to library_member_role enum
ALTER TYPE library_member_role ADD VALUE IF NOT EXISTS 'co_owner';