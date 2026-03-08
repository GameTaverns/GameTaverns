-- =============================================================================
-- GameTaverns Self-Hosted: Feedback Note Attachments
-- Adds attachment_urls column to feedback_notes for photo replies
-- =============================================================================

ALTER TABLE public.feedback_notes
  ADD COLUMN IF NOT EXISTS attachment_urls TEXT[] DEFAULT '{}';
