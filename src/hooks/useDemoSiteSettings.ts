import { useState, useEffect, useCallback } from "react";
import { useDemoMode } from "@/contexts/DemoContext";
import { SiteSettings } from "./useSiteSettings";

const SESSION_KEY_SITE = "demo_session_site_settings";
const SESSION_KEY_THEME = "demo_session_theme_settings";

export interface DemoSiteSettingsData {
  site_name: string;
  site_author: string;
  site_description: string;
  contact_email: string;
  footer_text: string;
  twitter_handle: string;
  instagram_url: string;
  facebook_url: string;
  discord_url: string;
}

export interface DemoThemeSettings {
  primaryHue: number;
  primarySaturation: number;
  primaryLightness: number;
  accentHue: number;
  accentSaturation: number;
  accentLightness: number;
  backgroundHue: number;
  backgroundSaturation: number;
  backgroundLightness: number;
  cardHue: number;
  cardSaturation: number;
  cardLightness: number;
  displayFont: string;
  bodyFont: string;
}

export const DEFAULT_DEMO_SITE_SETTINGS: DemoSiteSettingsData = {
  site_name: "Demo Game Library",
  site_author: "Demo User",
  site_description: "This is a demo instance - explore and customize freely!",
  contact_email: "demo@example.com",
  footer_text: "© 2024 Demo Instance. All changes are session-only.",
  twitter_handle: "",
  instagram_url: "",
  facebook_url: "",
  discord_url: "",
};

export const DEFAULT_DEMO_THEME: DemoThemeSettings = {
  primaryHue: 200,
  primarySaturation: 70,
  primaryLightness: 45,
  accentHue: 30,
  accentSaturation: 80,
  accentLightness: 50,
  backgroundHue: 210,
  backgroundSaturation: 20,
  backgroundLightness: 97,
  cardHue: 210,
  cardSaturation: 25,
  cardLightness: 99,
  displayFont: "Montserrat",
  bodyFont: "Open Sans",
};

export function loadDemoSiteSettings(): DemoSiteSettingsData {
  try {
    const stored = sessionStorage.getItem(SESSION_KEY_SITE);
    if (stored) {
      return { ...DEFAULT_DEMO_SITE_SETTINGS, ...JSON.parse(stored) };
    }
  } catch (e) {
    console.warn("Failed to load demo site settings:", e);
  }
  return DEFAULT_DEMO_SITE_SETTINGS;
}

export function loadDemoThemeSettings(): DemoThemeSettings {
  try {
    const stored = sessionStorage.getItem(SESSION_KEY_THEME);
    if (stored) {
      return { ...DEFAULT_DEMO_THEME, ...JSON.parse(stored) };
    }
  } catch (e) {
    console.warn("Failed to load demo theme settings:", e);
  }
  return DEFAULT_DEMO_THEME;
}

export function saveDemoSiteSettings(settings: DemoSiteSettingsData): void {
  sessionStorage.setItem(SESSION_KEY_SITE, JSON.stringify(settings));
}

export function saveDemoThemeSettings(settings: DemoThemeSettings): void {
  sessionStorage.setItem(SESSION_KEY_THEME, JSON.stringify(settings));
}

/**
 * Converts demo settings to the SiteSettings format used by useSiteSettings
 */
export function convertDemoSettingsToSiteSettings(
  siteSettings: DemoSiteSettingsData,
  themeSettings: DemoThemeSettings
): SiteSettings {
  return {
    site_name: siteSettings.site_name,
    site_description: siteSettings.site_description,
    site_author: siteSettings.site_author,
    twitter_handle: siteSettings.twitter_handle,
    instagram_url: siteSettings.instagram_url,
    facebook_url: siteSettings.facebook_url,
    discord_url: siteSettings.discord_url,
    contact_email: siteSettings.contact_email,
    footer_text: siteSettings.footer_text,
    theme_primary_h: String(themeSettings.primaryHue),
    theme_primary_s: String(themeSettings.primarySaturation),
    theme_primary_l: String(themeSettings.primaryLightness),
    theme_accent_h: String(themeSettings.accentHue),
    theme_accent_s: String(themeSettings.accentSaturation),
    theme_accent_l: String(themeSettings.accentLightness),
    theme_background_h: String(themeSettings.backgroundHue),
    theme_background_s: String(themeSettings.backgroundSaturation),
    theme_background_l: String(themeSettings.backgroundLightness),
    theme_card_h: String(themeSettings.cardHue),
    theme_card_s: String(themeSettings.cardSaturation),
    theme_card_l: String(themeSettings.cardLightness),
    theme_font_display: themeSettings.displayFont,
    theme_font_body: themeSettings.bodyFont,
  };
}

/**
 * Hook to get combined demo site settings in SiteSettings format
 */
export function useDemoSiteSettings() {
  const { isDemoMode } = useDemoMode();
  const [settings, setSettings] = useState<SiteSettings | null>(null);

  const refresh = useCallback(() => {
    if (isDemoMode) {
      const siteSettings = loadDemoSiteSettings();
      const themeSettings = loadDemoThemeSettings();
      setSettings(convertDemoSettingsToSiteSettings(siteSettings, themeSettings));
    }
  }, [isDemoMode]);

  useEffect(() => {
    refresh();
    
    // Listen for storage changes within the same tab
    const handleStorage = () => refresh();
    window.addEventListener("demo-settings-updated", handleStorage);
    return () => window.removeEventListener("demo-settings-updated", handleStorage);
  }, [refresh]);

  return { data: settings, isLoading: false, refresh };
}
