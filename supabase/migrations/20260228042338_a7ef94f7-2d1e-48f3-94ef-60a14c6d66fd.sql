
-- Photo gallery table
CREATE TABLE public.user_photos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  image_url text NOT NULL,
  caption text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Photo likes table
CREATE TABLE public.photo_likes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  photo_id uuid NOT NULL REFERENCES public.user_photos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(photo_id, user_id)
);

-- Indexes
CREATE INDEX idx_user_photos_user_id ON public.user_photos(user_id);
CREATE INDEX idx_user_photos_created_at ON public.user_photos(created_at DESC);
CREATE INDEX idx_photo_likes_photo_id ON public.photo_likes(photo_id);

-- Enable RLS
ALTER TABLE public.user_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photo_likes ENABLE ROW LEVEL SECURITY;

-- RLS: anyone can view photos
CREATE POLICY "Anyone can view photos" ON public.user_photos FOR SELECT USING (true);
-- RLS: users can insert their own photos
CREATE POLICY "Users can insert own photos" ON public.user_photos FOR INSERT WITH CHECK (auth.uid() = user_id);
-- RLS: users can update their own photos
CREATE POLICY "Users can update own photos" ON public.user_photos FOR UPDATE USING (auth.uid() = user_id);
-- RLS: users can delete their own photos
CREATE POLICY "Users can delete own photos" ON public.user_photos FOR DELETE USING (auth.uid() = user_id);

-- RLS: anyone can view likes
CREATE POLICY "Anyone can view photo likes" ON public.photo_likes FOR SELECT USING (true);
-- RLS: authenticated users can like
CREATE POLICY "Users can like photos" ON public.photo_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
-- RLS: users can unlike their own likes
CREATE POLICY "Users can unlike" ON public.photo_likes FOR DELETE USING (auth.uid() = user_id);

-- Storage bucket for photo uploads
INSERT INTO storage.buckets (id, name, public) VALUES ('user-photos', 'user-photos', true);

-- Storage policies
CREATE POLICY "Anyone can view user photos" ON storage.objects FOR SELECT USING (bucket_id = 'user-photos');
CREATE POLICY "Authenticated users can upload photos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'user-photos' AND auth.role() = 'authenticated');
CREATE POLICY "Users can delete own photos" ON storage.objects FOR DELETE USING (bucket_id = 'user-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Activity event trigger for photo uploads
CREATE OR REPLACE FUNCTION public.emit_activity_photo_posted()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.activity_events (user_id, event_type, metadata)
  VALUES (
    NEW.user_id,
    'photo_posted',
    jsonb_build_object(
      'photo_id', NEW.id,
      'image_url', NEW.image_url,
      'caption', COALESCE(NEW.caption, '')
    )
  );
  RETURN NEW;
END;
$function$;

CREATE TRIGGER on_photo_posted
  AFTER INSERT ON public.user_photos
  FOR EACH ROW
  EXECUTE FUNCTION public.emit_activity_photo_posted();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_photos;
