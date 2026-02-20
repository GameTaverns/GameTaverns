-- User special badges: admin-granted profile badges (e.g. Designer, Verified, etc.)
CREATE TABLE IF NOT EXISTS public.user_special_badges (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  badge_type TEXT NOT NULL,
  badge_label TEXT NOT NULL,
  badge_color TEXT NOT NULL DEFAULT '#6366f1',
  badge_icon TEXT,
  granted_by UUID NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  UNIQUE(user_id, badge_type)
);

ALTER TABLE public.user_special_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Special badges are publicly readable"
  ON public.user_special_badges FOR SELECT USING (true);

CREATE POLICY "Only admins can insert special badges"
  ON public.user_special_badges FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can update special badges"
  ON public.user_special_badges FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can delete special badges"
  ON public.user_special_badges FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));
