import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { getSupabaseConfig } from "@/config/runtime";

/**
 * Runtime-configurable client.
 *
 * Why: the generated supabase client is build-time only (VITE_*), which breaks
 * self-hosted/standalone deployments that inject the backend URL at runtime.
 */
const { url, anonKey } = getSupabaseConfig();

export const supabase = createClient<Database>(url, anonKey, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});
