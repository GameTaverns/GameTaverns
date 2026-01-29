-- Game Polls table for quick votes and game night polls
CREATE TABLE public.game_polls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    library_id UUID NOT NULL REFERENCES public.libraries(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    poll_type TEXT NOT NULL DEFAULT 'quick' CHECK (poll_type IN ('quick', 'game_night')),
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('draft', 'open', 'closed')),
    
    -- For game night polls
    event_date TIMESTAMP WITH TIME ZONE,
    event_location TEXT,
    
    -- Voting settings
    voting_ends_at TIMESTAMP WITH TIME ZONE,
    max_votes_per_user INTEGER DEFAULT 1,
    show_results_before_close BOOLEAN DEFAULT false,
    
    -- Share settings
    share_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
    
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id)
);

-- Poll options (games to vote on)
CREATE TABLE public.poll_options (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    poll_id UUID NOT NULL REFERENCES public.game_polls(id) ON DELETE CASCADE,
    game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(poll_id, game_id)
);

-- Poll votes
CREATE TABLE public.poll_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    poll_id UUID NOT NULL REFERENCES public.game_polls(id) ON DELETE CASCADE,
    option_id UUID NOT NULL REFERENCES public.poll_options(id) ON DELETE CASCADE,
    voter_identifier TEXT NOT NULL, -- Guest identifier or user ID
    voter_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(poll_id, voter_identifier, option_id)
);

-- Game night RSVPs
CREATE TABLE public.game_night_rsvps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    poll_id UUID NOT NULL REFERENCES public.game_polls(id) ON DELETE CASCADE,
    guest_identifier TEXT NOT NULL,
    guest_name TEXT,
    status TEXT NOT NULL DEFAULT 'going' CHECK (status IN ('going', 'maybe', 'not_going')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(poll_id, guest_identifier)
);

-- Enable RLS
ALTER TABLE public.game_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_night_rsvps ENABLE ROW LEVEL SECURITY;

-- RLS Policies for game_polls
CREATE POLICY "Library owners can manage their polls"
ON public.game_polls FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM libraries 
        WHERE libraries.id = game_polls.library_id 
        AND libraries.owner_id = auth.uid()
    ) OR has_role(auth.uid(), 'admin')
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM libraries 
        WHERE libraries.id = game_polls.library_id 
        AND libraries.owner_id = auth.uid()
    ) OR has_role(auth.uid(), 'admin')
);

CREATE POLICY "Anyone can view open polls"
ON public.game_polls FOR SELECT
USING (status = 'open' OR status = 'closed');

-- RLS Policies for poll_options
CREATE POLICY "Library owners can manage poll options"
ON public.poll_options FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM game_polls gp
        JOIN libraries l ON l.id = gp.library_id
        WHERE gp.id = poll_options.poll_id
        AND l.owner_id = auth.uid()
    ) OR has_role(auth.uid(), 'admin')
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM game_polls gp
        JOIN libraries l ON l.id = gp.library_id
        WHERE gp.id = poll_options.poll_id
        AND l.owner_id = auth.uid()
    ) OR has_role(auth.uid(), 'admin')
);

CREATE POLICY "Anyone can view poll options"
ON public.poll_options FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM game_polls 
        WHERE game_polls.id = poll_options.poll_id 
        AND (game_polls.status = 'open' OR game_polls.status = 'closed')
    )
);

-- RLS Policies for poll_votes
CREATE POLICY "Library owners can view votes on their polls"
ON public.poll_votes FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM game_polls gp
        JOIN libraries l ON l.id = gp.library_id
        WHERE gp.id = poll_votes.poll_id
        AND l.owner_id = auth.uid()
    ) OR has_role(auth.uid(), 'admin')
);

CREATE POLICY "Anyone can insert votes on open polls"
ON public.poll_votes FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM game_polls 
        WHERE game_polls.id = poll_votes.poll_id 
        AND game_polls.status = 'open'
        AND (game_polls.voting_ends_at IS NULL OR game_polls.voting_ends_at > now())
    )
);

CREATE POLICY "Anyone can delete their own votes"
ON public.poll_votes FOR DELETE
USING (true);

-- RLS Policies for game_night_rsvps
CREATE POLICY "Library owners can view RSVPs"
ON public.game_night_rsvps FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM game_polls gp
        JOIN libraries l ON l.id = gp.library_id
        WHERE gp.id = game_night_rsvps.poll_id
        AND l.owner_id = auth.uid()
    ) OR has_role(auth.uid(), 'admin')
);

CREATE POLICY "Anyone can manage their own RSVP"
ON public.game_night_rsvps FOR ALL
USING (true)
WITH CHECK (true);

-- Create view for poll vote counts (public)
CREATE VIEW public.poll_results AS
SELECT 
    po.poll_id,
    po.id as option_id,
    po.game_id,
    g.title as game_title,
    g.image_url,
    COUNT(pv.id) as vote_count
FROM poll_options po
LEFT JOIN poll_votes pv ON pv.option_id = po.id
LEFT JOIN games g ON g.id = po.game_id
GROUP BY po.poll_id, po.id, po.game_id, g.title, g.image_url;

-- Triggers for updated_at
CREATE TRIGGER update_game_polls_updated_at
    BEFORE UPDATE ON public.game_polls
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_game_night_rsvps_updated_at
    BEFORE UPDATE ON public.game_night_rsvps
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();