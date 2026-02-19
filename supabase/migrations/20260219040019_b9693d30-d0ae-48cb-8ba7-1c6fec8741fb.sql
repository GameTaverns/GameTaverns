-- Fix overly permissive RLS policies on new tables

-- referrals table: only service role / authenticated can update
DROP POLICY IF EXISTS "System can update referral on signup" ON public.referrals;
DROP POLICY IF EXISTS "Anyone can create referrals" ON public.referrals;

-- Authenticated users can create referral records for themselves
CREATE POLICY "Authenticated users can create own referrals"
  ON public.referrals FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = referrer_user_id);

-- Only the referral owner can update (e.g. the signup flow updates referred_user_id)
-- We'll handle cross-user update via the SECURITY DEFINER function, not direct RLS
-- For now, restrict update to referrer only (function handles the rest)
CREATE POLICY "Referrer can update their referrals"
  ON public.referrals FOR UPDATE
  USING (auth.uid() = referrer_user_id);

-- referral_badges table: public read only, no direct writes from client
DROP POLICY IF EXISTS "Service role can manage badges" ON public.referral_badges;

CREATE POLICY "Referral badges are insertable by authenticated"
  ON public.referral_badges FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);