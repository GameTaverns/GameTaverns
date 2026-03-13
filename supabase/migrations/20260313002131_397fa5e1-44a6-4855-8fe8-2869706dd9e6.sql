
CREATE OR REPLACE FUNCTION public.insert_platform_feedback(
  _type text,
  _sender_name text,
  _sender_email text,
  _message text,
  _screenshot_urls text[] DEFAULT '{}'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _id uuid;
BEGIN
  INSERT INTO public.platform_feedback (type, sender_name, sender_email, message, screenshot_urls)
  VALUES (_type::feedback_type, _sender_name, _sender_email, _message, _screenshot_urls)
  RETURNING id INTO _id;
  
  RETURN _id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.insert_platform_feedback(text, text, text, text, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.insert_platform_feedback(text, text, text, text, text[]) TO anon;
