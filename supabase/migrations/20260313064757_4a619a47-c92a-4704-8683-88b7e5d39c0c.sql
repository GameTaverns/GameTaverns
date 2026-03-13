
-- =============================================================================
-- Mechanic Families: Consolidate 253 granular mechanics into ~30 families
-- =============================================================================

-- 1. Create mechanic_families table
CREATE TABLE IF NOT EXISTS public.mechanic_families (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Add family_id to mechanics
ALTER TABLE public.mechanics ADD COLUMN IF NOT EXISTS family_id UUID REFERENCES public.mechanic_families(id) ON DELETE SET NULL;

-- 3. Grant permissions
GRANT SELECT ON public.mechanic_families TO authenticated, anon;

-- 4. Insert families
INSERT INTO public.mechanic_families (name, slug, display_order) VALUES
  ('Abstract Strategy', 'abstract-strategy', 1),
  ('Action Selection', 'action-selection', 2),
  ('Area Control', 'area-control', 3),
  ('Auction & Bidding', 'auction-bidding', 4),
  ('Bluffing & Deduction', 'bluffing-deduction', 5),
  ('Card Play', 'card-play', 6),
  ('Cooperative Play', 'cooperative-play', 7),
  ('Deck Building', 'deck-building', 8),
  ('Dexterity', 'dexterity', 9),
  ('Dice', 'dice', 10),
  ('Drafting', 'drafting', 11),
  ('Economic & Trading', 'economic-trading', 12),
  ('Engine Building', 'engine-building', 13),
  ('Grid & Spatial', 'grid-spatial', 14),
  ('Legacy & Campaign', 'legacy-campaign', 15),
  ('Movement', 'movement', 16),
  ('Network & Routes', 'network-routes', 17),
  ('Party & Social', 'party-social', 18),
  ('Pattern & Collection', 'pattern-collection', 19),
  ('Player Interaction', 'player-interaction', 20),
  ('Press Your Luck', 'press-your-luck', 21),
  ('Resource Management', 'resource-management', 22),
  ('Role Playing & Narrative', 'role-playing-narrative', 23),
  ('Scoring & Endgame', 'scoring-endgame', 24),
  ('Solo Play', 'solo-play', 25),
  ('Special Powers', 'special-powers', 26),
  ('Turn Order', 'turn-order', 27),
  ('Wargame Tactics', 'wargame-tactics', 28),
  ('Worker Placement', 'worker-placement', 29),
  ('Miscellaneous', 'miscellaneous', 30)
ON CONFLICT (slug) DO NOTHING;

-- 5. Map existing mechanics to families (Cloud subset)
UPDATE public.mechanics SET family_id = (SELECT id FROM public.mechanic_families WHERE slug = 'abstract-strategy') WHERE name IN ('Abstract Placement', 'Abstract Strategy');
UPDATE public.mechanics SET family_id = (SELECT id FROM public.mechanic_families WHERE slug = 'action-selection') WHERE name IN ('Action Points', 'Action Queue', 'Action Retrieval', 'Action Timer', 'Action / Event', 'Action Drafting', 'Advantage Token', 'Simultaneous Action Selection', 'Passed Action Token', 'Follow');
UPDATE public.mechanics SET family_id = (SELECT id FROM public.mechanic_families WHERE slug = 'area-control') WHERE name IN ('Area Control', 'Area Control / Area Influence', 'Area Majority / Influence', 'Area Management', 'Area-Impulse', 'Enclosure', 'Area Enclosure', 'King of the Hill', 'Zone of Control', 'Tug of War');
UPDATE public.mechanics SET family_id = (SELECT id FROM public.mechanic_families WHERE slug = 'auction-bidding') WHERE name IN ('Auction', 'Auction / Bidding', 'Auction/Bidding', 'Auction Compensation', 'Auction: Dexterity', 'Auction: Dutch', 'Auction: Dutch Priority', 'Auction: English', 'Auction: Fixed Placement', 'Auction: Multiple Lot', 'Auction: Once Around', 'Auction: Sealed Bid', 'Auction: Turn Order Until Pass', 'Bidding', 'Bids As Wagers', 'Closed Economy Auction', 'Constrained Bidding', 'Predictive Bid', 'Selection Order Bid', 'Turn Order: Auction');
UPDATE public.mechanics SET family_id = (SELECT id FROM public.mechanic_families WHERE slug = 'bluffing-deduction') WHERE name IN ('Bluffing', 'Betting and Bluffing', 'Deduction', 'Hidden Roles', 'Hidden Ranks', 'Hidden Movement', 'Hidden Victory Points', 'Secret Unit Deployment', 'Traitor Game', 'Induction', 'Secret Identity', 'Secret Roles', 'Roles with Asymmetric Information');
UPDATE public.mechanics SET family_id = (SELECT id FROM public.mechanic_families WHERE slug = 'card-play') WHERE name IN ('Card Game', 'Card Play', 'Card Placement', 'Card Play Conflict Resolution', 'Card Driven', 'Card Driven Battle', 'Card-Driven Battle', 'Campaign / Battle Card Driven', 'Command Cards', 'Hand Management', 'Ladder Climbing', 'Melding and Splaying', 'Move Through Deck', 'Multi-Use Cards', 'Trick-taking', 'Trick-Taking');
UPDATE public.mechanics SET family_id = (SELECT id FROM public.mechanic_families WHERE slug = 'cooperative-play') WHERE name IN ('Cooperative', 'Cooperative Game', 'Communication Limits', 'Team-Based Game', 'Semi-Cooperative Game');
UPDATE public.mechanics SET family_id = (SELECT id FROM public.mechanic_families WHERE slug = 'deck-building') WHERE name IN ('Deck Building', 'Deck-Building', 'Deck Construction', 'Deck, Bag, and Pool Building', 'Deck / Bag and Pool Building');
UPDATE public.mechanics SET family_id = (SELECT id FROM public.mechanic_families WHERE slug = 'dexterity') WHERE name IN ('Flicking', 'Stacking and Balancing', 'Physical Removal', 'Slide / Push');
UPDATE public.mechanics SET family_id = (SELECT id FROM public.mechanic_families WHERE slug = 'dice') WHERE name IN ('Dice Rolling', 'Dice Combat', 'Die Icon Resolution', 'Different Dice Movement', 'Re-rolling and Locking', 'Roll and Write', 'Critical Hits and Failures', 'Cube Tower', 'Doubling Cube');
UPDATE public.mechanics SET family_id = (SELECT id FROM public.mechanic_families WHERE slug = 'drafting') WHERE name IN ('Drafting', 'Card Drafting', 'Action Drafting', 'Open Drafting', 'Closed Drafting', 'Tile Drafting', 'Dice Drafting', 'I Cut, You Choose');
UPDATE public.mechanics SET family_id = (SELECT id FROM public.mechanic_families WHERE slug = 'economic-trading') WHERE name IN ('Economic', 'Commodity Speculation', 'Market', 'Income', 'Trading', 'Contracts', 'Order Fulfillment', 'Contract Fulfillment', 'Investment', 'Loans', 'Stock Holding', 'Delayed Purchase', 'Increase Value of Unchosen Resources', 'Automatic Resource Growth', 'Victory Points as a Resource');
UPDATE public.mechanics SET family_id = (SELECT id FROM public.mechanic_families WHERE slug = 'engine-building') WHERE name IN ('Engine Building', 'Chaining', 'Tableau Building', 'Technology Tree', 'Tech Trees / Tech Tracks');
UPDATE public.mechanics SET family_id = (SELECT id FROM public.mechanic_families WHERE slug = 'grid-spatial') WHERE name IN ('Grid Coverage', 'Grid Movement', 'Hexagon Grid', 'Hex-and-Counter', 'Hex & Counter', 'Square Grid', 'Tile Placement', 'Modular Board', 'Stacking', 'Layering', 'Map Addition', 'Map Deformation', 'Map Reduction', 'Pieces as Map', 'Multiple Maps', 'Three Dimensional Movement', 'Minimap Resolution');
UPDATE public.mechanics SET family_id = (SELECT id FROM public.mechanic_families WHERE slug = 'legacy-campaign') WHERE name IN ('Legacy Game', 'Scenario / Mission / Campaign Game', 'Simulation');
UPDATE public.mechanics SET family_id = (SELECT id FROM public.mechanic_families WHERE slug = 'movement') WHERE name IN ('Area Movement', 'Movement Points', 'Point to Point Movement', 'Track Movement', 'Programmed Movement', 'Roll / Spin and Move', 'Roll/Spin and Move', 'Fleet Movement', 'Impulse Movement', 'Measurement Movement', 'Movement Template', 'Pattern Movement', 'Relative Movement', 'Moving Multiple Units');
UPDATE public.mechanics SET family_id = (SELECT id FROM public.mechanic_families WHERE slug = 'network-routes') WHERE name IN ('Network and Route Building', 'Network Building', 'Route/Network Building', 'Route Building', 'Crayon Rail System', 'Connections');
UPDATE public.mechanics SET family_id = (SELECT id FROM public.mechanic_families WHERE slug = 'party-social') WHERE name IN ('Acting', 'Charades', 'Singing', 'Drawing', 'Line Drawing', 'Player Judge', 'Word Association', 'Word Game', 'Spelling', 'Trivia', 'Question & Answer', 'Questions and Answers', 'Clue-Giving', 'Targeted Clues', 'Speed Matching', 'Bingo', 'Text Messaging');
UPDATE public.mechanics SET family_id = (SELECT id FROM public.mechanic_families WHERE slug = 'pattern-collection') WHERE name IN ('Pattern Building', 'Pattern Recognition', 'Set Collection', 'Matching', 'Ordering');
UPDATE public.mechanics SET family_id = (SELECT id FROM public.mechanic_families WHERE slug = 'player-interaction') WHERE name IN ('Take That', 'Player Elimination', 'Player Eliminiation', 'Negotiation', 'Alliances', 'Voting', 'Bribery', 'Rock-Paper-Scissors', 'Hot Potato', 'Kill Steal', 'Catch the Leader', 'Bias', 'Single Loser Game');
UPDATE public.mechanics SET family_id = (SELECT id FROM public.mechanic_families WHERE slug = 'press-your-luck') WHERE name IN ('Press Your Luck', 'Push Your Luck', 'Betting and Bluffing', 'Betting');
UPDATE public.mechanics SET family_id = (SELECT id FROM public.mechanic_families WHERE slug = 'resource-management') WHERE name IN ('Resource Management', 'Resource Gathering', 'Resource Queue', 'Resource to Move', 'Random Production', 'Automatic Resource Growth');
UPDATE public.mechanics SET family_id = (SELECT id FROM public.mechanic_families WHERE slug = 'role-playing-narrative') WHERE name IN ('Role Playing', 'Storytelling', 'Narrative Choice / Storytelling', 'Narrative Choice / Paragraph');
UPDATE public.mechanics SET family_id = (SELECT id FROM public.mechanic_families WHERE slug = 'scoring-endgame') WHERE name IN ('End Game Bonuses', 'Score-and-Reset Game', 'Finale Ending', 'Highest-Lowest Scoring', 'Sudden Death Ending');
UPDATE public.mechanics SET family_id = (SELECT id FROM public.mechanic_families WHERE slug = 'solo-play') WHERE name IN ('Solo / Solitaire Game');
UPDATE public.mechanics SET family_id = (SELECT id FROM public.mechanic_families WHERE slug = 'special-powers') WHERE name IN ('Asymmetric Powers', 'Variable Player Powers', 'Once-Per-Game Abilities', 'Variable Phase Order', 'Variable Set-up');
UPDATE public.mechanics SET family_id = (SELECT id FROM public.mechanic_families WHERE slug = 'turn-order') WHERE name IN ('Turn Order: Claim Action', 'Turn Order: Pass Order', 'Turn Order: Progressive', 'Turn Order: Random', 'Turn Order: Role Order', 'Turn Order: Stat-Based', 'Turn Order: Time Track', 'Order Counters');
UPDATE public.mechanics SET family_id = (SELECT id FROM public.mechanic_families WHERE slug = 'wargame-tactics') WHERE name IN ('Attrition', 'Chit-Pull System', 'Force Commitment', 'Line of Sight', 'Ratio / Combat Results Table', 'Stat Check Resolution', 'Static Capture', 'Miniatures', 'Neighbor Scope', 'Moving Multiple Units');
UPDATE public.mechanics SET family_id = (SELECT id FROM public.mechanic_families WHERE slug = 'worker-placement') WHERE name IN ('Worker Placement', 'Worker Placement, Different Worker Types', 'Worker Placement with Dice Workers', 'Follower Placement');
UPDATE public.mechanics SET family_id = (SELECT id FROM public.mechanic_families WHERE slug = 'miscellaneous') WHERE family_id IS NULL;

-- 6. Create index
CREATE INDEX IF NOT EXISTS idx_mechanics_family ON public.mechanics(family_id);
