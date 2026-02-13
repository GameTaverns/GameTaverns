import { useEffect, useState, useCallback, useRef } from "react";
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
  const appliedRef = useRef(false);
  
  // Avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);
  
  const applyTheme = useCallback(() => {
    if (!isTenantMode || !settings) {
      return;
    }
    
    const root = document.documentElement;
    const isDark = root.classList.contains('dark');
    
    console.log('[TenantTheme] Applying theme:', { isDark, isTenantMode, hasSettings: !!settings });
    
    // Helper to format HSL values properly - handles both "50%" and "50" formats
    const formatHSL = (
      h: string | null | undefined,
      s: string | null | undefined,
      l: string | null | undefined
    ): string | null => {
      if (!h || !s || !l) return null;
      const hVal = h.replace('%', ''); // Hue shouldn't have %
      const sVal = s.includes('%') ? s : `${s}%`;
      const lVal = l.includes('%') ? l : `${l}%`;
      return `${hVal} ${sVal} ${lVal}`;
    };

    const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
    const toNum = (v: string | null | undefined, fallback: number) => {
      if (!v) return fallback;
      const parsed = Number(String(v).replace('%', ''));
      return Number.isFinite(parsed) ? parsed : fallback;
    };
    
    // Calculate foreground color — picks up subtle warmth from the background hue
    const getBgHue = (): { h: string; s: number } => {
      if (isDark) {
        const h = (settings.theme_dark_background_h || '25').replace('%', '');
        const s = toNum(settings.theme_dark_background_s, 20);
        return { h, s };
      }
      const h = (settings.theme_background_h || '25').replace('%', '');
      const s = toNum(settings.theme_background_s, 30);
      return { h, s };
    };
    const getForeground = (l: string | null | undefined): string => {
      const bg = getBgHue();
      const warmS = Math.min(bg.s * 0.4, 15); // subtle warmth, max 15% saturation
      if (!l) return isDark ? `${bg.h} ${warmS}% 95%` : `${bg.h} ${warmS}% 10%`;
      const lightness = parseInt(l.replace('%', ''));
      return lightness > 50 ? `${bg.h} ${warmS}% 10%` : `${bg.h} ${warmS}% 95%`;
    };

    // Derive border/input as neutral grey appropriate for the background lightness
    const getNeutralBorder = (bgL: number): string => {
      if (isDark) {
        return `0 0% ${clamp(bgL + 12, 0, 100)}%`;
      }
      return `0 0% ${clamp(bgL - 16, 0, 100)}%`;
    };

    const getNeutralInput = (bgL: number): string => {
      if (isDark) {
        return `0 0% ${clamp(bgL + 8, 0, 100)}%`;
      }
      return `0 0% ${clamp(bgL - 9, 0, 100)}%`;
    };
    
    if (isDark) {
      // Apply dark mode colors
      const primary = formatHSL(settings.theme_dark_primary_h, settings.theme_dark_primary_s, settings.theme_dark_primary_l);
      const accent = formatHSL(settings.theme_dark_accent_h, settings.theme_dark_accent_s, settings.theme_dark_accent_l);
      const background = formatHSL(settings.theme_dark_background_h, settings.theme_dark_background_s, settings.theme_dark_background_l);
      const card = formatHSL(settings.theme_dark_card_h, settings.theme_dark_card_s, settings.theme_dark_card_l);
      const sidebar = formatHSL(settings.theme_dark_sidebar_h, settings.theme_dark_sidebar_s, settings.theme_dark_sidebar_l);
      
      // Resolve explicit foreground color once
      const s = settings as any;
      const explicitFg = formatHSL(s.theme_dark_foreground_h, s.theme_dark_foreground_s, s.theme_dark_foreground_l);
      const explicitFgL = explicitFg ? parseInt((s.theme_dark_foreground_l || '90').replace('%', '')) : null;
      
      console.log('[TenantTheme] Dark mode values:', { primary, accent, background, card, sidebar, explicitFg });
      
      if (primary) {
        root.style.setProperty('--primary', primary);
        root.style.setProperty('--primary-foreground', getForeground(settings.theme_dark_primary_l));
        root.style.setProperty('--forest', primary);
        root.style.setProperty('--ring', primary);
      }
      if (accent) {
        root.style.setProperty('--accent', accent);
        root.style.setProperty('--accent-foreground', getForeground(settings.theme_dark_accent_l));
        root.style.setProperty('--sienna', accent);

        const h = settings.theme_dark_accent_h;
        const sVal = toNum(settings.theme_dark_accent_s, 50);
        const l = toNum(settings.theme_dark_accent_l, 45);
        root.style.setProperty('--gold', `${String(h || '28').replace('%', '')} ${clamp(sVal, 0, 100)}% ${clamp(l + 10, 0, 100)}%`);
      }
      if (background) {
        root.style.setProperty('--background', background);
        const fg = explicitFg || getForeground(settings.theme_dark_background_l);
        root.style.setProperty('--foreground', fg);
        const bgL = parseInt((settings.theme_dark_background_l || '10').replace('%', ''));
        const mutedL = Math.min(bgL + 5, 100);
        root.style.setProperty('--muted', `0 0% ${mutedL}%`);
        const fgL = explicitFgL ?? 95;
        root.style.setProperty('--muted-foreground', `0 0% ${clamp(fgL - 30, 0, 100)}%`);
        root.style.setProperty('--border', getNeutralBorder(bgL));
        root.style.setProperty('--input', getNeutralInput(bgL));

        const parchmentL = clamp(bgL + 2, 0, 100);
        root.style.setProperty('--parchment', `${settings.theme_dark_background_h} ${settings.theme_dark_background_s} ${parchmentL}%`);
      } else if (explicitFg) {
        // Apply foreground even without a custom background
        root.style.setProperty('--foreground', explicitFg);
        root.style.setProperty('--muted-foreground', `0 0% ${clamp(explicitFgL! - 30, 0, 100)}%`);
      }
      if (card) {
        root.style.setProperty('--card', card);
        const cardFg = explicitFg || getForeground(settings.theme_dark_card_l);
        root.style.setProperty('--card-foreground', cardFg);
        root.style.setProperty('--popover', card);
        root.style.setProperty('--popover-foreground', cardFg);
      }
      if (sidebar) {
        root.style.setProperty('--sidebar-background', sidebar);
        const sidebarFg = explicitFg || getForeground(settings.theme_dark_sidebar_l);
        root.style.setProperty('--sidebar-foreground', sidebarFg);
      }
      // If explicit foreground set but no card/sidebar customized, still apply to those tokens
      if (explicitFg) {
        if (!card) {
          root.style.setProperty('--card-foreground', explicitFg);
          root.style.setProperty('--popover-foreground', explicitFg);
        }
        if (!sidebar) {
          root.style.setProperty('--sidebar-foreground', explicitFg);
        }
      }
    } else {
      // Apply light mode colors
      const primary = formatHSL(settings.theme_primary_h, settings.theme_primary_s, settings.theme_primary_l);
      const accent = formatHSL(settings.theme_accent_h, settings.theme_accent_s, settings.theme_accent_l);
      const background = formatHSL(settings.theme_background_h, settings.theme_background_s, settings.theme_background_l);
      const card = formatHSL(settings.theme_card_h, settings.theme_card_s, settings.theme_card_l);
      const sidebar = formatHSL(settings.theme_sidebar_h, settings.theme_sidebar_s, settings.theme_sidebar_l);
      
      // Resolve explicit foreground color once
      const s = settings as any;
      const explicitFg = formatHSL(s.theme_foreground_h, s.theme_foreground_s, s.theme_foreground_l);
      const explicitFgL = explicitFg ? parseInt((s.theme_foreground_l || '15').replace('%', '')) : null;
      
      console.log('[TenantTheme] Light mode values:', { primary, accent, background, card, sidebar, explicitFg });
      
      if (primary) {
        root.style.setProperty('--primary', primary);
        root.style.setProperty('--primary-foreground', getForeground(settings.theme_primary_l));
        root.style.setProperty('--forest', primary);
        root.style.setProperty('--ring', primary);
      }
      if (accent) {
        root.style.setProperty('--accent', accent);
        root.style.setProperty('--accent-foreground', getForeground(settings.theme_accent_l));
        root.style.setProperty('--sienna', accent);

        const h = settings.theme_accent_h;
        const sVal = toNum(settings.theme_accent_s, 50);
        const l = toNum(settings.theme_accent_l, 48);
        root.style.setProperty('--gold', `${String(h || '28').replace('%', '')} ${clamp(sVal, 0, 100)}% ${clamp(l + 15, 0, 100)}%`);
      }
      if (background) {
        root.style.setProperty('--background', background);
        const fg = explicitFg || getForeground(settings.theme_background_l);
        root.style.setProperty('--foreground', fg);
        const bgL = parseInt((settings.theme_background_l || '95').replace('%', ''));
        const mutedL = Math.max(bgL - 5, 0);
        root.style.setProperty('--muted', `0 0% ${mutedL}%`);
        const fgL = explicitFgL ?? 10;
        root.style.setProperty('--muted-foreground', `0 0% ${clamp(fgL + 30, 0, 100)}%`);
        root.style.setProperty('--border', getNeutralBorder(bgL));
        root.style.setProperty('--input', getNeutralInput(bgL));

        const parchmentL = clamp(bgL - 2, 0, 100);
        root.style.setProperty('--parchment', `${settings.theme_background_h} ${settings.theme_background_s} ${parchmentL}%`);
      } else if (explicitFg) {
        // Apply foreground even without a custom background
        root.style.setProperty('--foreground', explicitFg);
        root.style.setProperty('--muted-foreground', `0 0% ${clamp(explicitFgL! + 30, 0, 100)}%`);
      }
      if (card) {
        root.style.setProperty('--card', card);
        const cardFg = explicitFg || getForeground(settings.theme_card_l);
        root.style.setProperty('--card-foreground', cardFg);
        root.style.setProperty('--popover', card);
        root.style.setProperty('--popover-foreground', cardFg);
      }
      if (sidebar) {
        root.style.setProperty('--sidebar-background', sidebar);
        const sidebarFg = explicitFg || getForeground(settings.theme_sidebar_l);
        root.style.setProperty('--sidebar-foreground', sidebarFg);
      }
      // If explicit foreground set but no card/sidebar customized, still apply to those tokens
      if (explicitFg) {
        if (!card) {
          root.style.setProperty('--card-foreground', explicitFg);
          root.style.setProperty('--popover-foreground', explicitFg);
        }
        if (!sidebar) {
          root.style.setProperty('--sidebar-foreground', explicitFg);
        }
      }
    }
    
    // Derive wood/cream tokens from background so Dashboard tabs etc. follow the theme
    {
      const s = settings as any;
      const darkFgL = formatHSL(s.theme_dark_foreground_h, s.theme_dark_foreground_s, s.theme_dark_foreground_l)
        ? parseInt((s.theme_dark_foreground_l || '90').replace('%', ''))
        : null;
      const lightFgL = formatHSL(s.theme_foreground_h, s.theme_foreground_s, s.theme_foreground_l)
        ? parseInt((s.theme_foreground_l || '15').replace('%', ''))
        : null;

      if (isDark) {
        const bgH = settings.theme_dark_background_h || settings.theme_dark_card_h;
        const bgS = settings.theme_dark_background_s || settings.theme_dark_card_s;
        const bgLVal = settings.theme_dark_background_l || settings.theme_dark_card_l;
        if (bgH && bgS && bgLVal) {
          const h = bgH.replace('%', '');
          const sv = toNum(bgS, 30);
          const l = toNum(bgLVal, 10);
          root.style.setProperty('--wood-dark', `${h} ${clamp(sv, 0, 100)}% ${clamp(l - 2, 0, 100)}%`);
          root.style.setProperty('--wood-medium', `${h} ${clamp(sv - 5, 0, 100)}% ${clamp(l + 8, 0, 100)}%`);
        }
        const creamL = darkFgL ?? 90;
        root.style.setProperty('--cream', `0 0% ${clamp(creamL, 0, 100)}%`);
      } else {
        const bgH = settings.theme_background_h || settings.theme_card_h;
        const bgS = settings.theme_background_s || settings.theme_card_s;
        const bgLVal = settings.theme_background_l || settings.theme_card_l;
        if (bgH && bgS && bgLVal) {
          const h = bgH.replace('%', '');
          const sv = toNum(bgS, 30);
          const l = toNum(bgLVal, 94);
          root.style.setProperty('--wood-dark', `${h} ${clamp(sv, 0, 100)}% ${clamp(l - 76, 0, 100)}%`);
          root.style.setProperty('--wood-medium', `${h} ${clamp(sv - 5, 0, 100)}% ${clamp(l - 66, 0, 100)}%`);
        }
        const creamL = lightFgL != null ? (100 - lightFgL) : 96;
        root.style.setProperty('--cream', `0 0% ${clamp(creamL, 0, 100)}%`);
      }
    }

    // Apply fonts (wrap in quotes for CSS font-family)
    if (settings.theme_font_display) {
      root.style.setProperty('--font-display', `"${settings.theme_font_display}"`);
      loadGoogleFont(settings.theme_font_display);
    }
    if (settings.theme_font_body) {
      root.style.setProperty('--font-body', `"${settings.theme_font_body}"`);
      loadGoogleFont(settings.theme_font_body);
    }
    if ((settings as any).theme_font_accent) {
      root.style.setProperty('--font-accent', `"${(settings as any).theme_font_accent}"`);
      loadGoogleFont((settings as any).theme_font_accent);
    }
    
    // Apply background image if set
    if (settings.background_image_url) {
      document.body.style.backgroundImage = `url(${settings.background_image_url})`;
      document.body.style.backgroundSize = 'cover';
      document.body.style.backgroundPosition = 'center';
      document.body.style.backgroundAttachment = 'fixed';
      document.body.classList.add('has-background-image');
      
      // Apply overlay opacity as CSS variable
      const overlayOpacity = settings.background_overlay_opacity || '0.85';
      root.style.setProperty('--background-overlay-opacity', overlayOpacity);
    } else {
      document.body.style.backgroundImage = '';
      document.body.classList.remove('has-background-image');
      root.style.removeProperty('--background-overlay-opacity');
    }
    
    appliedRef.current = true;
  }, [settings, isTenantMode]);
  
  // Load Google Font dynamically
  const loadGoogleFont = (fontName: string) => {
    const linkId = `google-font-${fontName.replace(/\s+/g, '-').toLowerCase()}`;
    if (!document.getElementById(linkId)) {
      const link = document.createElement('link');
      link.id = linkId;
      link.rel = 'stylesheet';
      link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontName)}:wght@400;500;600;700&display=swap`;
      document.head.appendChild(link);
    }
  };
  
  // Apply theme on mount and when settings/theme changes
  useEffect(() => {
    if (!mounted) return;
    
    applyTheme();
    
    // Cleanup on unmount
    return () => {
      if (appliedRef.current) {
        const root = document.documentElement;
        const cssVars = [
          '--primary', '--primary-foreground',
          '--accent', '--accent-foreground', 
          '--background', '--foreground',
          '--muted', '--muted-foreground',
          '--card', '--card-foreground',
          '--popover', '--popover-foreground',
          '--sidebar-background', '--sidebar-foreground',
          '--parchment', '--gold', '--forest', '--sienna', '--ring',
          '--border', '--input',
          '--wood-dark', '--wood-medium', '--cream',
          '--font-display', '--font-body'
        ];
        cssVars.forEach((key) => {
          root.style.removeProperty(key);
        });
        document.body.style.backgroundImage = '';
        document.body.style.backgroundSize = '';
        document.body.style.backgroundPosition = '';
        document.body.style.backgroundAttachment = '';
        document.body.classList.remove('has-background-image');
        root.style.removeProperty('--background-overlay-opacity');
      }
    };
  }, [mounted, applyTheme, resolvedTheme, settings]);
  
  // Also listen for class changes on html element (for immediate response to theme toggle)
  useEffect(() => {
    if (!mounted || !isTenantMode) return;
    
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          // Small delay to let the theme class change propagate
          setTimeout(applyTheme, 10);
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
