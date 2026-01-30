/**
 * Supabase Client Re-export
 * 
 * This module provides the Supabase client that works in both:
 * - Lovable Cloud mode (real Supabase)
 * - Self-hosted mode (stub client, uses /api backend)
 * 
 * Import from here instead of @/integrations/supabase/client
 */
export { supabase, apiClient, isSelfHostedMode } from '@/integrations/backend/client';
