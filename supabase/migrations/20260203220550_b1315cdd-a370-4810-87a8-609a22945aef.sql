-- Create trigger to auto-create library settings when a library is created
CREATE TRIGGER create_library_settings_on_library
    AFTER INSERT ON public.libraries
    FOR EACH ROW
    EXECUTE FUNCTION public.create_library_settings();

-- Add INSERT policy for library_settings (triggered by the owner creating their library)
CREATE POLICY "Library owners can insert their settings" ON public.library_settings
    FOR INSERT 
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.libraries 
            WHERE libraries.id = library_settings.library_id 
            AND libraries.owner_id = auth.uid()
        )
    );