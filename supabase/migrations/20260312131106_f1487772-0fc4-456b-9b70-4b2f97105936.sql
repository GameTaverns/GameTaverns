
-- Convention-specific settings layered on top of library_events
CREATE TABLE IF NOT EXISTS public.convention_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.library_events(id) ON DELETE CASCADE UNIQUE,
  club_id uuid REFERENCES public.clubs(id) ON DELETE SET NULL,
  lending_enabled boolean NOT NULL DEFAULT true,
  reservation_enabled boolean NOT NULL DEFAULT true,
  reservation_hold_minutes integer NOT NULL DEFAULT 30,
  max_concurrent_loans integer NOT NULL DEFAULT 4,
  require_badge_scan boolean NOT NULL DEFAULT false,
  kiosk_mode_enabled boolean NOT NULL DEFAULT true,
  quick_signup_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Convention reservations (attendee holds a game before pickup)
CREATE TABLE IF NOT EXISTS public.convention_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  convention_event_id uuid NOT NULL REFERENCES public.convention_events(id) ON DELETE CASCADE,
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  copy_id uuid REFERENCES public.game_copies(id) ON DELETE SET NULL,
  reserved_by uuid NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'fulfilled', 'expired', 'cancelled')),
  expires_at timestamptz NOT NULL,
  fulfilled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Convention quick signups (lightweight attendee registration)
CREATE TABLE IF NOT EXISTS public.convention_attendees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  convention_event_id uuid NOT NULL REFERENCES public.convention_events(id) ON DELETE CASCADE,
  user_id uuid,
  display_name text NOT NULL,
  badge_id text,
  contact_info text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(convention_event_id, badge_id)
);

-- RLS
ALTER TABLE public.convention_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.convention_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.convention_attendees ENABLE ROW LEVEL SECURITY;

-- Convention events: authenticated users can read; library owners/co-owners can manage
CREATE POLICY "Authenticated can view convention events"
  ON public.convention_events FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Library owners can manage convention events"
  ON public.convention_events FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.library_events le
      JOIN public.libraries l ON l.id = le.library_id
      WHERE le.id = convention_events.event_id
        AND (l.owner_id = auth.uid() OR public.is_library_co_owner(auth.uid(), l.id) OR public.has_role(auth.uid(), 'admin'))
    )
  );

-- Convention reservations: users can manage their own
CREATE POLICY "Users can view own reservations"
  ON public.convention_reservations FOR SELECT TO authenticated
  USING (reserved_by = auth.uid() OR EXISTS (
    SELECT 1 FROM public.convention_events ce
    JOIN public.library_events le ON le.id = ce.event_id
    JOIN public.libraries l ON l.id = le.library_id
    WHERE ce.id = convention_reservations.convention_event_id
      AND (l.owner_id = auth.uid() OR public.is_library_co_owner(auth.uid(), l.id))
  ));

CREATE POLICY "Users can create own reservations"
  ON public.convention_reservations FOR INSERT TO authenticated
  WITH CHECK (reserved_by = auth.uid());

CREATE POLICY "Users can update own reservations"
  ON public.convention_reservations FOR UPDATE TO authenticated
  USING (reserved_by = auth.uid() OR EXISTS (
    SELECT 1 FROM public.convention_events ce
    JOIN public.library_events le ON le.id = ce.event_id
    JOIN public.libraries l ON l.id = le.library_id
    WHERE ce.id = convention_reservations.convention_event_id
      AND (l.owner_id = auth.uid() OR public.is_library_co_owner(auth.uid(), l.id))
  ));

-- Convention attendees: staff can manage, attendees can view own
CREATE POLICY "Staff can manage convention attendees"
  ON public.convention_attendees FOR ALL TO authenticated
  USING (
    user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.convention_events ce
      JOIN public.library_events le ON le.id = ce.event_id
      JOIN public.libraries l ON l.id = le.library_id
      WHERE ce.id = convention_attendees.convention_event_id
        AND (l.owner_id = auth.uid() OR public.is_library_co_owner(auth.uid(), l.id) OR public.has_role(auth.uid(), 'admin'))
    )
  );

-- Grants
GRANT ALL ON public.convention_events TO authenticated, service_role;
GRANT ALL ON public.convention_reservations TO authenticated, service_role;
GRANT ALL ON public.convention_attendees TO authenticated, service_role;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_convention_events_event_id ON public.convention_events(event_id);
CREATE INDEX IF NOT EXISTS idx_convention_reservations_convention ON public.convention_reservations(convention_event_id, status);
CREATE INDEX IF NOT EXISTS idx_convention_reservations_user ON public.convention_reservations(reserved_by);
CREATE INDEX IF NOT EXISTS idx_convention_attendees_convention ON public.convention_attendees(convention_event_id);
CREATE INDEX IF NOT EXISTS idx_convention_attendees_badge ON public.convention_attendees(badge_id);
