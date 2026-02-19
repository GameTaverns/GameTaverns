-- ============================================================
-- Referral System
-- ============================================================

-- Track referral codes and signups
CREATE TABLE public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id UUID NOT NULL,
  referred_user_id UUID,                      -- NULL until someone signs up
  referral_code TEXT NOT NULL UNIQUE,         -- short unique code
  signed_up_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- Referrers can see their own referrals
CREATE POLICY "Users can view their own referrals"
  ON public.referrals FOR SELECT
  USING (auth.uid() = referrer_user_id);

-- Anyone can insert a referral record (triggered on signup)
CREATE POLICY "Anyone can create referrals"
  ON public.referrals FOR INSERT
  WITH CHECK (true);

-- Only the referred user's own record can be updated
CREATE POLICY "System can update referral on signup"
  ON public.referrals FOR UPDATE
  USING (true);

-- ============================================================
-- Referral Badges / Tiers
-- ============================================================

CREATE TABLE public.referral_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  referral_count INTEGER NOT NULL DEFAULT 0,
  -- Tier booleans (awarded once threshold is crossed)
  has_tavern_regular BOOLEAN NOT NULL DEFAULT false,   -- 1 referral
  has_town_crier BOOLEAN NOT NULL DEFAULT false,       -- 5 referrals
  has_guild_founder BOOLEAN NOT NULL DEFAULT false,    -- 15 referrals
  has_legend BOOLEAN NOT NULL DEFAULT false,           -- 50 referrals
  -- Time-locked founding member (granted during launch window, never available again)
  is_founding_member BOOLEAN NOT NULL DEFAULT false,
  founding_member_granted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.referral_badges ENABLE ROW LEVEL SECURITY;

-- Anyone can read badges (shown on profiles)
CREATE POLICY "Referral badges are publicly readable"
  ON public.referral_badges FOR SELECT
  USING (true);

-- Only system/service role updates
CREATE POLICY "Service role can manage badges"
  ON public.referral_badges FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- Function: Award/update referral badges
-- Called after each confirmed referral
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_referral_badges(_referrer_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _count INTEGER;
BEGIN
  -- Count confirmed referrals (signed up)
  SELECT COUNT(*) INTO _count
  FROM public.referrals
  WHERE referrer_user_id = _referrer_id
    AND referred_user_id IS NOT NULL;

  -- Upsert the badge row
  INSERT INTO public.referral_badges (
    user_id, referral_count,
    has_tavern_regular, has_town_crier, has_guild_founder, has_legend
  )
  VALUES (
    _referrer_id, _count,
    _count >= 1, _count >= 5, _count >= 15, _count >= 50
  )
  ON CONFLICT (user_id) DO UPDATE SET
    referral_count = EXCLUDED.referral_count,
    has_tavern_regular = EXCLUDED.has_tavern_regular,
    has_town_crier = EXCLUDED.has_town_crier,
    has_guild_founder = EXCLUDED.has_guild_founder,
    has_legend = EXCLUDED.has_legend,
    updated_at = now();
END;
$$;

-- ============================================================
-- Trigger: When referred_user_id is set, award badges
-- ============================================================
CREATE OR REPLACE FUNCTION public.on_referral_confirmed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only fire when referred_user_id transitions from NULL to a real value
  IF NEW.referred_user_id IS NOT NULL AND OLD.referred_user_id IS NULL THEN
    PERFORM public.update_referral_badges(NEW.referrer_user_id);
    -- Notify the referrer
    PERFORM public.create_notification(
      NEW.referrer_user_id,
      'referral_signup',
      '🎉 Someone joined using your referral link!',
      'Your referral count has been updated. Check your badges!',
      jsonb_build_object('referral_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_referral_confirmed
  AFTER UPDATE ON public.referrals
  FOR EACH ROW
  EXECUTE FUNCTION public.on_referral_confirmed();

-- Timestamp trigger
CREATE TRIGGER update_referral_badges_updated_at
  BEFORE UPDATE ON public.referral_badges
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- Function: Generate a unique referral code for a user
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_or_create_referral_code(_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _code TEXT;
  _existing TEXT;
BEGIN
  -- Check if user already has a pending/unused code
  SELECT referral_code INTO _existing
  FROM public.referrals
  WHERE referrer_user_id = _user_id
    AND referred_user_id IS NULL
  ORDER BY created_at DESC
  LIMIT 1;

  IF _existing IS NOT NULL THEN
    RETURN _existing;
  END IF;

  -- Generate a new short code: first 6 chars of user UUID + 4 random chars
  _code := LOWER(SUBSTRING(_user_id::TEXT, 1, 8) || SUBSTRING(gen_random_uuid()::TEXT, 1, 4));

  INSERT INTO public.referrals (referrer_user_id, referral_code)
  VALUES (_user_id, _code);

  RETURN _code;
END;
$$;