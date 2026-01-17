-- Add purchase tracking fields to games table (admin-only visibility)
ALTER TABLE public.games
ADD COLUMN purchase_price numeric NULL,
ADD COLUMN purchase_date date NULL;