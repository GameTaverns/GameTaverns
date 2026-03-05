CREATE POLICY "Admins can delete login attempts"
  ON public.login_attempts FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));