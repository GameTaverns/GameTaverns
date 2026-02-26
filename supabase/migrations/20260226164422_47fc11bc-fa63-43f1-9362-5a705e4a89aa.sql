
-- Create storage bucket for feedback attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('feedback-attachments', 'feedback-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to upload to feedback-attachments (public feedback form)
CREATE POLICY "Anyone can upload feedback attachments"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'feedback-attachments');

-- Allow anyone to read feedback attachments
CREATE POLICY "Anyone can read feedback attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'feedback-attachments');

-- Allow admins to delete feedback attachments
CREATE POLICY "Admins can delete feedback attachments"
ON storage.objects FOR DELETE
USING (bucket_id = 'feedback-attachments' AND has_role(auth.uid(), 'admin'::app_role));
