import { useEffect } from "react";
import { useTenant } from "@/contexts/TenantContext";

/**
 * Applies tenant-specific theme settings when viewing a library.
 * This takes precedence over the global theme when in tenant mode.
 */
export function TenantThemeApplicator() {
  const { settings, isTenantMode } = useTenant();
  
  useEffect(() => {
    if (!isTenantMode || !settings) return;
    
    const root = document.documentElement;
    
    // Apply light mode colors
    const lightVars = {
      '--primary': `${settings.theme_primary_h} ${settings.theme_primary_s} ${settings.theme_primary_l}`,
      '--accent': `${settings.theme_accent_h} ${settings.theme_accent_s} ${settings.theme_accent_l}`,
      '--background': `${settings.theme_background_h} ${settings.theme_background_s} ${settings.theme_background_l}`,
      '--card': `${settings.theme_card_h} ${settings.theme_card_s} ${settings.theme_card_l}`,
      '--sidebar-background': `${settings.theme_sidebar_h} ${settings.theme_sidebar_s} ${settings.theme_sidebar_l}`,
    };
    
    // Apply dark mode colors
    const darkVars = {
      '--primary': `${settings.theme_dark_primary_h} ${settings.theme_dark_primary_s} ${settings.theme_dark_primary_l}`,
      '--accent': `${settings.theme_dark_accent_h} ${settings.theme_dark_accent_s} ${settings.theme_dark_accent_l}`,
      '--background': `${settings.theme_dark_background_h} ${settings.theme_dark_background_s} ${settings.theme_dark_background_l}`,
      '--card': `${settings.theme_dark_card_h} ${settings.theme_dark_card_s} ${settings.theme_dark_card_l}`,
      '--sidebar-background': `${settings.theme_dark_sidebar_h} ${settings.theme_dark_sidebar_s} ${settings.theme_dark_sidebar_l}`,
    };
    
    // Determine current theme
    const isDark = root.classList.contains('dark');
    const vars = isDark ? darkVars : lightVars;
    
    // Apply CSS variables
    Object.entries(vars).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });
    
    // Apply fonts
    if (settings.theme_font_display) {
      root.style.setProperty('--font-display', settings.theme_font_display);
    }
    if (settings.theme_font_body) {
      root.style.setProperty('--font-body', settings.theme_font_body);
    }
    
    // Apply background image if set
    if (settings.background_image_url) {
      document.body.style.backgroundImage = `url(${settings.background_image_url})`;
      document.body.style.backgroundSize = 'cover';
      document.body.style.backgroundPosition = 'center';
      document.body.style.backgroundAttachment = 'fixed';
    }
    
    // Cleanup on unmount
    return () => {
      Object.keys(vars).forEach((key) => {
        root.style.removeProperty(key);
      });
      root.style.removeProperty('--font-display');
      root.style.removeProperty('--font-body');
      document.body.style.backgroundImage = '';
      document.body.style.backgroundSize = '';
      document.body.style.backgroundPosition = '';
      document.body.style.backgroundAttachment = '';
    };
  }, [settings, isTenantMode]);
  
  return null;
}
