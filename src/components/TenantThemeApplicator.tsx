import { useEffect, useState, useCallback } from "react";
import { useTenant } from "@/contexts/TenantContext";
import { useTheme } from "next-themes";

/**
 * Applies tenant-specific theme settings when viewing a library.
 * This takes precedence over the global theme when in tenant mode.
 * Listens for theme changes (light/dark) and reapplies colors accordingly.
 */
export function TenantThemeApplicator() {
  const { settings, isTenantMode } = useTenant();
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  
  // Avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);
  
  const applyTheme = useCallback(() => {
    if (!isTenantMode || !settings) return;
    
    const root = document.documentElement;
    const isDark = root.classList.contains('dark');
    
    // Helper to format HSL values properly
    const formatHSL = (h: string | null, s: string | null, l: string | null) => {
      if (!h || !s || !l) return null;
      const hVal = h;
      const sVal = s.includes('%') ? s : `${s}%`;
      const lVal = l.includes('%') ? l : `${l}%`;
      return `${hVal} ${sVal} ${lVal}`;
    };
    
    if (isDark) {
      // Apply dark mode colors
      const primary = formatHSL(settings.theme_dark_primary_h, settings.theme_dark_primary_s, settings.theme_dark_primary_l);
      const accent = formatHSL(settings.theme_dark_accent_h, settings.theme_dark_accent_s, settings.theme_dark_accent_l);
      const background = formatHSL(settings.theme_dark_background_h, settings.theme_dark_background_s, settings.theme_dark_background_l);
      const card = formatHSL(settings.theme_dark_card_h, settings.theme_dark_card_s, settings.theme_dark_card_l);
      const sidebar = formatHSL(settings.theme_dark_sidebar_h, settings.theme_dark_sidebar_s, settings.theme_dark_sidebar_l);
      
      if (primary) root.style.setProperty('--primary', primary);
      if (accent) root.style.setProperty('--accent', accent);
      if (background) {
        root.style.setProperty('--background', background);
        // Also update related colors for consistency
        root.style.setProperty('--muted', background);
      }
      if (card) root.style.setProperty('--card', card);
      if (sidebar) root.style.setProperty('--sidebar-background', sidebar);
    } else {
      // Apply light mode colors
      const primary = formatHSL(settings.theme_primary_h, settings.theme_primary_s, settings.theme_primary_l);
      const accent = formatHSL(settings.theme_accent_h, settings.theme_accent_s, settings.theme_accent_l);
      const background = formatHSL(settings.theme_background_h, settings.theme_background_s, settings.theme_background_l);
      const card = formatHSL(settings.theme_card_h, settings.theme_card_s, settings.theme_card_l);
      const sidebar = formatHSL(settings.theme_sidebar_h, settings.theme_sidebar_s, settings.theme_sidebar_l);
      
      if (primary) root.style.setProperty('--primary', primary);
      if (accent) root.style.setProperty('--accent', accent);
      if (background) {
        root.style.setProperty('--background', background);
        root.style.setProperty('--muted', background);
      }
      if (card) root.style.setProperty('--card', card);
      if (sidebar) root.style.setProperty('--sidebar-background', sidebar);
    }
    
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
    } else {
      document.body.style.backgroundImage = '';
    }
  }, [settings, isTenantMode]);
  
  // Apply theme on mount and when settings/theme changes
  useEffect(() => {
    if (!mounted) return;
    
    applyTheme();
    
    // Cleanup on unmount
    return () => {
      const root = document.documentElement;
      const cssVars = ['--primary', '--accent', '--background', '--muted', '--card', '--sidebar-background', '--font-display', '--font-body'];
      cssVars.forEach((key) => {
        root.style.removeProperty(key);
      });
      document.body.style.backgroundImage = '';
      document.body.style.backgroundSize = '';
      document.body.style.backgroundPosition = '';
      document.body.style.backgroundAttachment = '';
    };
  }, [mounted, applyTheme, resolvedTheme]);
  
  // Also listen for class changes on html element (for immediate response to theme toggle)
  useEffect(() => {
    if (!mounted || !isTenantMode) return;
    
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          applyTheme();
        }
      });
    });
    
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
    
    return () => observer.disconnect();
  }, [mounted, isTenantMode, applyTheme]);
  
  return null;
}
