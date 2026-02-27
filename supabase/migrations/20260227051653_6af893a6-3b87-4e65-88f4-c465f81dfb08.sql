-- Add triage columns to platform_feedback
ALTER TABLE public.platform_feedback
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_to_name text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Create feedback_notes table for internal staff notes and replies
CREATE TABLE IF NOT EXISTS public.feedback_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id uuid NOT NULL REFERENCES public.platform_feedback(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_name text,
  content text NOT NULL,
  note_type text NOT NULL DEFAULT 'internal', -- 'internal' or 'reply' (sent to user)
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.feedback_notes ENABLE ROW LEVEL SECURITY;

-- Only staff+ can view/manage feedback notes
CREATE POLICY "Staff can manage feedback notes" ON public.feedback_notes
  FOR ALL USING (public.has_role_level(auth.uid(), 'staff'))
  WITH CHECK (public.has_role_level(auth.uid(), 'staff'));

-- Update platform_feedback RLS to allow staff access
DROP POLICY IF EXISTS "Admins can manage feedback" ON public.platform_feedback;
CREATE POLICY "Staff and admins can manage feedback" ON public.platform_feedback
  FOR ALL USING (public.has_role_level(auth.uid(), 'staff'))
  WITH CHECK (public.has_role_level(auth.uid(), 'staff'));