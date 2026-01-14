import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
  theme_primary_h?: string;
  theme_primary_s?: string;
  theme_primary_l?: string;
  theme_accent_h?: string;
  theme_accent_s?: string;
  theme_accent_l?: string;
  theme_background_h?: string;
  theme_background_s?: string;
  theme_background_l?: string;
  theme_font_display?: string;
  theme_font_body?: string;
  turnstile_site_key?: string;
}

export function useSiteSettings() {
  return useQuery({
    queryKey: ["site-settings"],
    queryFn: async (): Promise<SiteSettings> => {
      const { data, error } = await supabase
        .from("site_settings")
        .select("key, value");

      if (error) throw error;

      const settings: SiteSettings = {};
      data?.forEach((setting) => {
        settings[setting.key as keyof SiteSettings] = setting.value || undefined;
      });

      return settings;
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
}

export function useTurnstileSiteKey() {
  const { data: settings } = useSiteSettings();
  return settings?.turnstile_site_key || "0x4AAAAAACMX7o8e260x6gzV";
}
