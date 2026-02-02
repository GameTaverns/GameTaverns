import { useQuery } from "@tanstack/react-query";
import { supabase, apiClient, isSelfHostedMode } from "@/integrations/backend/client";
import { useDemoMode } from "@/contexts/DemoContext";
import { 
  loadDemoSiteSettings, 
  loadDemoThemeSettings, 
  convertDemoSettingsToSiteSettings 
} from "./useDemoSiteSettings";

export interface SiteSettings {
  site_name?: string;
  site_description?: string;
  site_author?: string;
  twitter_handle?: string;
  instagram_url?: string;
  facebook_url?: string;
  discord_url?: string;
  contact_email?: string;
  footer_text?: string;
  announcement_banner?: string;
  // Light mode theme
  theme_primary_h?: string;
  theme_primary_s?: string;
  theme_primary_l?: string;
  theme_accent_h?: string;
  theme_accent_s?: string;
  theme_accent_l?: string;
  theme_background_h?: string;
  theme_background_s?: string;
  theme_background_l?: string;
  theme_card_h?: string;
  theme_card_s?: string;
  theme_card_l?: string;
  theme_sidebar_h?: string;
  theme_sidebar_s?: string;
  theme_sidebar_l?: string;
  // Dark mode theme
  theme_dark_primary_h?: string;
  theme_dark_primary_s?: string;
  theme_dark_primary_l?: string;
  theme_dark_accent_h?: string;
  theme_dark_accent_s?: string;
  theme_dark_accent_l?: string;
  theme_dark_background_h?: string;
  theme_dark_background_s?: string;
  theme_dark_background_l?: string;
  theme_dark_card_h?: string;
  theme_dark_card_s?: string;
  theme_dark_card_l?: string;
  theme_dark_sidebar_h?: string;
  theme_dark_sidebar_s?: string;
  theme_dark_sidebar_l?: string;
  // Typography
  theme_font_display?: string;
  theme_font_body?: string;
  turnstile_site_key?: string;
  // Feature flags
  feature_play_logs?: string;
  feature_wishlist?: string;
  feature_for_sale?: string;
  feature_messaging?: string;
  feature_coming_soon?: string;
  feature_demo_mode?: string;
}

export function useSiteSettings() {
  const { isDemoMode } = useDemoMode();

  return useQuery({
    queryKey: ["site-settings", isDemoMode, isSelfHostedMode()],
    queryFn: async (): Promise<SiteSettings> => {
      // In demo mode, return demo settings from sessionStorage
      if (isDemoMode) {
        const siteSettings = loadDemoSiteSettings();
        const themeSettings = loadDemoThemeSettings();
        return convertDemoSettingsToSiteSettings(siteSettings, themeSettings);
      }

      // Self-hosted mode with Supabase stack: use PostgREST directly via Kong
      // The Express API doesn't exist in the Supabase self-hosted deployment
      if (isSelfHostedMode()) {
        try {
          // Get runtime config for API URL
          const runtimeConfig = (typeof window !== 'undefined' && (window as any).__RUNTIME_CONFIG__) || {};
          const supabaseUrl = runtimeConfig.SUPABASE_URL || '';
          const anonKey = runtimeConfig.SUPABASE_ANON_KEY || '';
          
          if (!supabaseUrl || !anonKey) {
            console.warn('[Self-Hosted] No Supabase config in runtime config, using defaults');
            return {
              site_name: runtimeConfig.SITE_NAME || 'GameTaverns',
              site_description: runtimeConfig.SITE_DESCRIPTION || '',
            };
          }
          
          // Fetch from PostgREST via Kong gateway
          const response = await fetch(`${supabaseUrl}/rest/v1/site_settings_public?select=key,value`, {
            headers: {
              'apikey': anonKey,
              'Authorization': `Bearer ${anonKey}`,
              'Accept': 'application/json',
            },
          });
          
          if (!response.ok) {
            throw new Error(`PostgREST error: ${response.status}`);
          }
          
          const data = await response.json();
          const settings: SiteSettings = {};
          data?.forEach((setting: { key: string; value: string | null }) => {
            settings[setting.key as keyof SiteSettings] = setting.value || undefined;
          });
          
          return settings;
        } catch (error) {
          // If the settings table doesn't exist or API fails, return runtime config defaults
          console.warn('[Self-Hosted] Failed to fetch site settings from PostgREST:', error);
          const runtimeConfig = (typeof window !== 'undefined' && (window as any).__RUNTIME_CONFIG__) || {};
          return {
            site_name: runtimeConfig.SITE_NAME || 'GameTaverns',
            site_description: runtimeConfig.SITE_DESCRIPTION || '',
          };
        }
      }

      // Cloud mode: fetch from Supabase
      let data, error;
      
      // First try the full table (admins only)
      const adminResult = await supabase
        .from("site_settings")
        .select("key, value");
      
      if (adminResult.error || !adminResult.data?.length) {
        // Fallback to public view for non-admins
        const publicResult = await supabase
          .from("site_settings_public")
          .select("key, value");
        data = publicResult.data;
        error = publicResult.error;
      } else {
        data = adminResult.data;
        error = adminResult.error;
      }

      if (error) throw error;

      const settings: SiteSettings = {};
      data?.forEach((setting) => {
        settings[setting.key as keyof SiteSettings] = setting.value || undefined;
      });

      return settings;
    },
    staleTime: isDemoMode ? 0 : 5 * 60 * 1000, // No cache in demo mode
  });
}

export function useTurnstileSiteKey() {
  const { data: settings, isLoading } = useSiteSettings();
  
  // Return undefined while loading to prevent bypass message flashing
  if (isLoading) return undefined;
  
  // Return the configured key, or undefined if not set (will trigger bypass)
  return settings?.turnstile_site_key || undefined;
}

export function useSiteSettingsLoaded() {
  const { isLoading, isFetched } = useSiteSettings();
  return !isLoading && isFetched;
}
