-- Fix column name mismatch: code uses error_reason/error_category but table has error_message/error_type
ALTER TABLE public.import_item_errors RENAME COLUMN error_message TO error_reason;
ALTER TABLE public.import_item_errors RENAME COLUMN error_type TO error_category;

-- Add missing columns that the code expects
ALTER TABLE public.import_item_errors ADD COLUMN IF NOT EXISTS raw_input JSONB;

-- Add admin SELECT policy (missing in Cloud)
CREATE POLICY "Admins can view all import errors" ON public.import_item_errors
    FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- Add admin DELETE policy
CREATE POLICY "Admins can delete import errors" ON public.import_item_errors
    FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Add INSERT policy for service role (edge functions)
CREATE POLICY "Service role can insert import errors" ON public.import_item_errors
    FOR INSERT WITH CHECK (true);

NOTIFY pgrst, 'reload schema';