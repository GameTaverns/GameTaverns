-- Enable realtime for direct_messages table so new messages appear instantly
ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;