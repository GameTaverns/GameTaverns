/**
 * PocketBase Site Settings Hook
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { pb } from '@/integrations/pocketbase/client';
import { Collections, type SiteSetting } from '@/integrations/pocketbase/types';
import { useDemoMode } from '@/contexts/DemoContext';
import { 
  loadDemoSiteSettings, 
  loadDemoThemeSettings, 
  convertDemoSettingsToSiteSettings 
} from './useDemoSiteSettings';

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
    queryKey: ['site-settings', isDemoMode],
    queryFn: async (): Promise<SiteSettings> => {
      if (isDemoMode) {
        const siteSettings = loadDemoSiteSettings();
        const themeSettings = loadDemoThemeSettings();
        return convertDemoSettingsToSiteSettings(siteSettings, themeSettings);
      }

      const records = await pb.collection(Collections.SITE_SETTINGS).getFullList<SiteSetting>();
      
      const settings: SiteSettings = {};
      records.forEach((record) => {
        settings[record.key as keyof SiteSettings] = record.value || undefined;
      });

      return settings;
    },
    staleTime: isDemoMode ? 0 : 5 * 60 * 1000,
  });
}

export function useTurnstileSiteKey() {
  const { data: settings } = useSiteSettings();
  return settings?.turnstile_site_key || '0x4AAAAAACMX7o8e260x6gzV';
}

// Hook to update site settings (admin only)
export function useUpdateSiteSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: Partial<SiteSettings>) => {
      for (const [key, value] of Object.entries(updates)) {
        // Try to find existing setting
        const existing = await pb.collection(Collections.SITE_SETTINGS).getList<SiteSetting>(1, 1, {
          filter: `key = "${key}"`,
        });

        if (existing.items.length > 0) {
          await pb.collection(Collections.SITE_SETTINGS).update(existing.items[0].id, { value });
        } else {
          await pb.collection(Collections.SITE_SETTINGS).create({ key, value });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-settings'] });
    },
  });
}
