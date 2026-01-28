-- Create feedback type enum
CREATE TYPE public.feedback_type AS ENUM ('feedback', 'bug', 'feature_request');

-- Create platform_feedback table
CREATE TABLE public.platform_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type feedback_type NOT NULL,
    sender_name TEXT NOT NULL,
    sender_email TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.platform_feedback ENABLE ROW LEVEL SECURITY;

-- Admins can view all feedback
CREATE POLICY "Admins can view all feedback"
ON public.platform_feedback
FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Admins can update feedback (mark as read)
CREATE POLICY "Admins can update feedback"
ON public.platform_feedback
FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

-- Admins can delete feedback
CREATE POLICY "Admins can delete feedback"
ON public.platform_feedback
FOR DELETE
USING (has_role(auth.uid(), 'admin'));

-- Anyone can insert feedback (public submissions)
CREATE POLICY "Anyone can submit feedback"
ON public.platform_feedback
FOR INSERT
WITH CHECK (true);