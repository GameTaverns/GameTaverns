-- =============================================================================
-- GameTaverns Self-Hosted: Fix loan_status enum - rename 'borrowed' to 'active'
-- The frontend code uses 'active' but the enum had 'borrowed'.
-- =============================================================================

-- Rename the enum value from 'borrowed' to 'active'
ALTER TYPE loan_status RENAME VALUE 'borrowed' TO 'active';
