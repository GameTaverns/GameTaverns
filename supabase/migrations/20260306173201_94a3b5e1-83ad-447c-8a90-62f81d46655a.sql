-- Club lending settings
CREATE TABLE public.club_lending_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid REFERENCES public.clubs(id) ON DELETE CASCADE NOT NULL UNIQUE,
  lending_enabled boolean NOT NULL DEFAULT false,
  max_concurrent_loans integer NOT NULL DEFAULT 3,
  default_duration_hours integer NOT NULL DEFAULT 4,
  require_contact_info boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.club_lending_settings ENABLE ROW LEVEL SECURITY;

-- Anyone can read settings to know if lending is enabled
CREATE POLICY "Club lending settings are publicly readable"
ON public.club_lending_settings FOR SELECT
USING (true);

-- Only club owner can update
CREATE POLICY "Club owners can manage lending settings"
ON public.club_lending_settings FOR ALL
TO authenticated
USING (public.is_club_owner(auth.uid(), club_id))
WITH CHECK (public.is_club_owner(auth.uid(), club_id));

-- Auto-create settings when club is created
CREATE OR REPLACE FUNCTION public.create_club_lending_settings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.club_lending_settings (club_id)
  VALUES (NEW.id)
  ON CONFLICT (club_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_create_club_lending_settings
  AFTER INSERT ON public.clubs
  FOR EACH ROW EXECUTE FUNCTION public.create_club_lending_settings();

-- Seed settings for existing clubs
INSERT INTO public.club_lending_settings (club_id)
SELECT id FROM public.clubs
ON CONFLICT (club_id) DO NOTHING;

-- Club loan status enum
CREATE TYPE public.club_loan_status AS ENUM ('checked_out', 'returned', 'overdue');

-- Club loans table
CREATE TABLE public.club_loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid REFERENCES public.clubs(id) ON DELETE CASCADE NOT NULL,
  game_id uuid REFERENCES public.games(id) ON DELETE CASCADE NOT NULL,
  library_id uuid REFERENCES public.libraries(id) ON DELETE CASCADE NOT NULL,
  borrower_user_id uuid DEFAULT NULL,
  guest_name text DEFAULT NULL,
  guest_contact text DEFAULT NULL,
  checked_out_by uuid NOT NULL,
  checked_out_at timestamptz NOT NULL DEFAULT now(),
  due_at timestamptz DEFAULT NULL,
  returned_at timestamptz DEFAULT NULL,
  condition_out text DEFAULT NULL,
  condition_in text DEFAULT NULL,
  notes text DEFAULT NULL,
  status public.club_loan_status NOT NULL DEFAULT 'checked_out',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.club_loans ENABLE ROW LEVEL SECURITY;

-- Club members can view loans for their club
CREATE POLICY "Club members can view club loans"
ON public.club_loans FOR SELECT
TO authenticated
USING (public.is_club_member(auth.uid(), club_id));

-- Club owner can manage loans
CREATE POLICY "Club owners can manage loans"
ON public.club_loans FOR INSERT
TO authenticated
WITH CHECK (public.is_club_owner(auth.uid(), club_id));

CREATE POLICY "Club owners can update loans"
ON public.club_loans FOR UPDATE
TO authenticated
USING (public.is_club_owner(auth.uid(), club_id))
WITH CHECK (public.is_club_owner(auth.uid(), club_id));

CREATE POLICY "Club owners can delete loans"
ON public.club_loans FOR DELETE
TO authenticated
USING (public.is_club_owner(auth.uid(), club_id));

-- Index for common queries
CREATE INDEX idx_club_loans_club_status ON public.club_loans (club_id, status);
CREATE INDEX idx_club_loans_game ON public.club_loans (game_id, status);