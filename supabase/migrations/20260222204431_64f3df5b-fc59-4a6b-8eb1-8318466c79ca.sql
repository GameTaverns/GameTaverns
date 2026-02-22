
-- Auto-grant founding member badge to all users who create a referral_badges row before Sept 1, 2026
-- This modifies the update_referral_badges function to also set founding member if within window
CREATE OR REPLACE FUNCTION public.update_referral_badges(_referrer_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _count INTEGER;
  _is_founding BOOLEAN;
BEGIN
  -- Count confirmed referrals (signed up)
  SELECT COUNT(*) INTO _count
  FROM public.referrals
  WHERE referrer_user_id = _referrer_id
    AND referred_user_id IS NOT NULL;

  -- Check if within founding member window
  _is_founding := now() < '2026-09-01T00:00:00Z'::timestamptz;

  -- Upsert the badge row
  INSERT INTO public.referral_badges (
    user_id, referral_count,
    has_tavern_regular, has_town_crier, has_guild_founder, has_legend,
    is_founding_member, founding_member_granted_at
  )
  VALUES (
    _referrer_id, _count,
    _count >= 1, _count >= 5, _count >= 15, _count >= 50,
    _is_founding, CASE WHEN _is_founding THEN now() ELSE NULL END
  )
  ON CONFLICT (user_id) DO UPDATE SET
    referral_count = EXCLUDED.referral_count,
    has_tavern_regular = EXCLUDED.has_tavern_regular,
    has_town_crier = EXCLUDED.has_town_crier,
    has_guild_founder = EXCLUDED.has_guild_founder,
    has_legend = EXCLUDED.has_legend,
    -- Only grant founding member, never revoke it
    is_founding_member = GREATEST(referral_badges.is_founding_member::int, EXCLUDED.is_founding_member::int)::boolean,
    founding_member_granted_at = COALESCE(referral_badges.founding_member_granted_at, EXCLUDED.founding_member_granted_at),
    updated_at = now();
END;
$$;

-- Also grant founding member to any user who gets a referral_badges row created via signup
-- Create a trigger on user_profiles insert to auto-create a founding member badge row
CREATE OR REPLACE FUNCTION public.grant_founding_member_on_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only grant if within the founding member window
  IF now() < '2026-09-01T00:00:00Z'::timestamptz THEN
    INSERT INTO public.referral_badges (user_id, is_founding_member, founding_member_granted_at)
    VALUES (NEW.user_id, true, now())
    ON CONFLICT (user_id) DO UPDATE SET
      is_founding_member = true,
      founding_member_granted_at = COALESCE(referral_badges.founding_member_granted_at, now()),
      updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_founding_member_on_signup
  AFTER INSERT ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.grant_founding_member_on_signup();

-- Grant founding member to all existing users who don't have it yet
INSERT INTO public.referral_badges (user_id, is_founding_member, founding_member_granted_at)
SELECT user_id, true, now()
FROM public.user_profiles
WHERE NOT EXISTS (
  SELECT 1 FROM public.referral_badges rb WHERE rb.user_id = user_profiles.user_id
)
ON CONFLICT (user_id) DO UPDATE SET
  is_founding_member = true,
  founding_member_granted_at = COALESCE(referral_badges.founding_member_granted_at, now()),
  updated_at = now();
