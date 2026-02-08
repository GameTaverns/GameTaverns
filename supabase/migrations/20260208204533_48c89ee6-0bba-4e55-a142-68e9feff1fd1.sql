-- Add user_id to game_messages for logged-in users to track their inquiries
ALTER TABLE public.game_messages 
ADD COLUMN IF NOT EXISTS sender_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Create replies table for owner responses
CREATE TABLE public.game_message_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.game_messages(id) ON DELETE CASCADE,
  reply_text_encrypted TEXT NOT NULL,
  replied_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.game_message_replies ENABLE ROW LEVEL SECURITY;

-- Index for faster lookups
CREATE INDEX idx_game_message_replies_message_id ON public.game_message_replies(message_id);
CREATE INDEX idx_game_messages_sender_user_id ON public.game_messages(sender_user_id);

-- RLS: Library owners can create replies to messages about their games
CREATE POLICY "Library owners can reply to messages"
ON public.game_message_replies
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.game_messages gm
    JOIN public.games g ON g.id = gm.game_id
    JOIN public.libraries l ON l.id = g.library_id
    WHERE gm.id = message_id AND l.owner_id = auth.uid()
  )
);

-- RLS: Library owners can view replies they made
CREATE POLICY "Library owners can view their replies"
ON public.game_message_replies
FOR SELECT
TO authenticated
USING (replied_by = auth.uid());

-- RLS: Message sender can view replies to their messages
CREATE POLICY "Senders can view replies to their messages"
ON public.game_message_replies
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.game_messages gm
    WHERE gm.id = message_id AND gm.sender_user_id = auth.uid()
  )
);

-- Update game_messages policy to allow senders to view their own messages
CREATE POLICY "Senders can view their own messages"
ON public.game_messages
FOR SELECT
TO authenticated
USING (sender_user_id = auth.uid());