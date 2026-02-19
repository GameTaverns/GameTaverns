-- Create special display badges for platform users (designers, artists, influencers, etc.)
CREATE TABLE public.user_special_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  badge_type text NOT NULL, -- e.g. 'designer', 'artist', 'influencer', 'creator', 'publisher'
  badge_label text NOT NULL, -- Display label e.g. 'Game Designer', 'Board Game Artist'
  badge_color text NOT NULL DEFAULT '#6366f1', -- Hex color for the badge
  badge_icon text, -- Optional lucide icon name
  granted_by uuid NOT NULL, -- admin user who granted it
  granted_at timestamptz NOT NULL DEFAULT now(),
  notes text, -- Internal admin notes
  UNIQUE (user_id, badge_type)
);

ALTER TABLE public.user_special_badges ENABLE ROW LEVEL SECURITY;

-- Anyone can read special badges (they're display-only public info)
CREATE POLICY "Special badges are publicly readable"
  ON public.user_special_badges FOR SELECT
  USING (true);

-- Only platform admins can insert/update/delete special badges
CREATE POLICY "Only admins can manage special badges"
  ON public.user_special_badges FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can update special badges"
  ON public.user_special_badges FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can delete special badges"
  ON public.user_special_badges FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));