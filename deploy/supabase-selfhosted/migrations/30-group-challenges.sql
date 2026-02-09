-- =============================================================================
-- Group Challenges System
-- Version: 2.3.4
-- =============================================================================

-- Challenge types enum
DO $$ BEGIN
    CREATE TYPE challenge_type AS ENUM (
        'play_count',        -- Play X games total
        'unique_games',      -- Play X different games
        'specific_game',     -- Everyone plays a specific game
        'high_score',        -- Achieve highest score
        'most_plays',        -- Most plays wins
        'most_unique'        -- Most unique games played wins
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Challenge status enum
DO $$ BEGIN
    CREATE TYPE challenge_status AS ENUM (
        'draft',
        'active',
        'completed',
        'cancelled'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Main challenges table
CREATE TABLE IF NOT EXISTS public.library_challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    library_id UUID NOT NULL REFERENCES public.libraries(id) ON DELETE CASCADE,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    challenge_type challenge_type NOT NULL,
    target_game_id UUID REFERENCES public.games(id) ON DELETE SET NULL,
    target_value INTEGER NOT NULL DEFAULT 1,
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,
    status challenge_status NOT NULL DEFAULT 'draft',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Challenge participants
CREATE TABLE IF NOT EXISTS public.challenge_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    challenge_id UUID NOT NULL REFERENCES public.library_challenges(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    current_progress INTEGER NOT NULL DEFAULT 0,
    completed_at TIMESTAMPTZ,
    UNIQUE(challenge_id, user_id)
);

-- Enable RLS
ALTER TABLE public.library_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_participants ENABLE ROW LEVEL SECURITY;

-- RLS Policies for challenges
CREATE POLICY "Library members can view challenges"
ON public.library_challenges FOR SELECT
TO authenticated
USING (public.is_library_member(auth.uid(), library_id));

CREATE POLICY "Library owners and moderators can manage challenges"
ON public.library_challenges FOR ALL
TO authenticated
USING (public.is_library_moderator(auth.uid(), library_id))
WITH CHECK (public.is_library_moderator(auth.uid(), library_id));

-- RLS Policies for participants
CREATE POLICY "Anyone can view challenge participants"
ON public.challenge_participants FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.library_challenges c 
        WHERE c.id = challenge_id 
        AND public.is_library_member(auth.uid(), c.library_id)
    )
);

CREATE POLICY "Members can join challenges"
ON public.challenge_participants FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
        SELECT 1 FROM public.library_challenges c 
        WHERE c.id = challenge_id 
        AND c.status = 'active'
        AND public.is_library_member(auth.uid(), c.library_id)
    )
);

CREATE POLICY "Users can leave challenges"
ON public.challenge_participants FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_library_challenges_library_id ON public.library_challenges(library_id);
CREATE INDEX IF NOT EXISTS idx_library_challenges_status ON public.library_challenges(status);
CREATE INDEX IF NOT EXISTS idx_challenge_participants_challenge_id ON public.challenge_participants(challenge_id);
CREATE INDEX IF NOT EXISTS idx_challenge_participants_user_id ON public.challenge_participants(user_id);

-- Trigger for updated_at
CREATE TRIGGER update_library_challenges_updated_at
    BEFORE UPDATE ON public.library_challenges
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
