-- Add 'owner' to the app_role enum for explicit Tier 3 assignment
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'owner';