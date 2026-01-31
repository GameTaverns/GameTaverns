-- =============================================================================
-- Part 1: Expand app_role Enum for 5-Tier Role Hierarchy
-- T1: admin (site super-admins)
-- T2: staff (site staff with elevated privileges)
-- T3: owner (library/community owners - explicit role assignment)
-- T4: moderator (community moderators - via library_member_role)
-- T5: regular users (no role entry)
-- =============================================================================

-- Add 'staff' and 'owner' values to the app_role enum
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'staff';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'owner';