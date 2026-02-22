
-- Update founding member cutoff to April 1, 2026
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
  SELECT COUNT(*) INTO _count
  FROM public.referrals
  WHERE referrer_user_id = _referrer_id
    AND referred_user_id IS NOT NULL;

  _is_founding := now() < '2026-04-01T00:00:00Z'::timestamptz;

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
    is_founding_member = GREATEST(referral_badges.is_founding_member::int, EXCLUDED.is_founding_member::int)::boolean,
    founding_member_granted_at = COALESCE(referral_badges.founding_member_granted_at, EXCLUDED.founding_member_granted_at),
    updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.grant_founding_member_on_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF now() < '2026-04-01T00:00:00Z'::timestamptz THEN
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
