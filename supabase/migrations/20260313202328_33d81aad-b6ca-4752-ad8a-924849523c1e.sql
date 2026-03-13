-- Enable realtime for convention_reservations (club_loans already enabled)
ALTER PUBLICATION supabase_realtime ADD TABLE public.convention_reservations;