
-- Event games table
CREATE TABLE public.event_games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.library_events(id) ON DELETE CASCADE,
  game_id uuid REFERENCES public.games(id) ON DELETE SET NULL,
  catalog_game_id uuid REFERENCES public.game_catalog(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  image_url text,
  scheduled_time text,
  duration_minutes integer,
  min_players integer,
  max_players integer,
  table_label text,
  notes text,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Event supplies table
CREATE TABLE public.event_supplies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.library_events(id) ON DELETE CASCADE,
  item_name text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  category text NOT NULL DEFAULT 'other',
  claimed_by text,
  claimed_by_user_id uuid,
  is_fulfilled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Event tables
CREATE TABLE public.event_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.library_events(id) ON DELETE CASCADE,
  table_label text NOT NULL,
  game_id uuid REFERENCES public.games(id) ON DELETE SET NULL,
  game_title text,
  capacity integer NOT NULL DEFAULT 4,
  notes text,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Event table seats
CREATE TABLE public.event_table_seats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id uuid NOT NULL REFERENCES public.event_tables(id) ON DELETE CASCADE,
  player_name text NOT NULL,
  player_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Event attendee preferences
CREATE TABLE public.event_attendee_prefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.library_events(id) ON DELETE CASCADE,
  attendee_identifier text NOT NULL,
  attendee_name text,
  attendee_user_id uuid,
  wants_to_play text[] DEFAULT '{}',
  can_bring text[] DEFAULT '{}',
  dietary_notes text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.event_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_supplies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_table_seats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_attendee_prefs ENABLE ROW LEVEL SECURITY;

-- RLS policies: allow all authenticated users to CRUD (event-level access)
CREATE POLICY "Authenticated users can manage event games" ON public.event_games FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage event supplies" ON public.event_supplies FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage event tables" ON public.event_tables FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage event table seats" ON public.event_table_seats FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage event attendee prefs" ON public.event_attendee_prefs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Allow public read on event_games so guests can see the lineup
CREATE POLICY "Anyone can view event games" ON public.event_games FOR SELECT TO anon USING (true);
