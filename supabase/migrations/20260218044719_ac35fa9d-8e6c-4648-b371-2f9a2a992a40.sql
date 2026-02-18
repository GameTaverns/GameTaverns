-- Enable realtime for clubs table so admin dashboard updates live
ALTER PUBLICATION supabase_realtime ADD TABLE public.clubs;