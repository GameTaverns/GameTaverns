import { useEffect } from "react";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { useDemoMode } from "@/contexts/DemoContext";

// Track loaded Google Fonts to avoid duplicate loading
const loadedFonts = new Set<string>();

/**
 * Dynamically load a Google Font if not already loaded
 */
function loadGoogleFont(fontName: string) {
  if (!fontName || loadedFonts.has(fontName)) return;
  
  // Create the Google Fonts URL
  const fontFamily = fontName.replace(/\s+/g, '+');
  const linkId = `google-font-${fontFamily}`;
  
  // Check if already in DOM
  if (document.getElementById(linkId)) {
    loadedFonts.add(fontName);
    return;
  }
  
  const link = document.createElement('link');
  link.id = linkId;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${fontFamily}:wght@400;500;600;700&display=swap`;
  document.head.appendChild(link);
  loadedFonts.add(fontName);
}

/**
 * Applies saved theme settings from the database to CSS variables on mount.
 * This component should be rendered once near the root of the app.
 * In demo mode, this applicator is skipped to let DemoThemeApplicator take over.
 */
export function ThemeApplicator() {
  const { data: settings, isLoading } = useSiteSettings();
  const { isDemoMode } = useDemoMode();

  useEffect(() => {
    // Skip in demo mode - DemoThemeApplicator handles theming
    if (isDemoMode) return;
    if (isLoading || !settings) return;

    const applyTheme = () => {
      const root = document.documentElement;
      const isDark = root.classList.contains("dark");

      // Apply primary color
      if (settings.theme_primary_h && settings.theme_primary_s && settings.theme_primary_l) {
        root.style.setProperty(
          "--primary",
          `${settings.theme_primary_h} ${settings.theme_primary_s}% ${settings.theme_primary_l}%`
        );
        root.style.setProperty(
          "--ring",
          `${settings.theme_primary_h} ${settings.theme_primary_s}% ${settings.theme_primary_l}%`
        );
        root.style.setProperty(
          "--forest",
          `${settings.theme_primary_h} ${settings.theme_primary_s}% ${settings.theme_primary_l}%`
        );
      }

      // Apply accent color
      if (settings.theme_accent_h && settings.theme_accent_s && settings.theme_accent_l) {
        root.style.setProperty(
          "--accent",
          `${settings.theme_accent_h} ${settings.theme_accent_s}% ${settings.theme_accent_l}%`
        );
        root.style.setProperty(
          "--sienna",
          `${settings.theme_accent_h} ${settings.theme_accent_s}% ${settings.theme_accent_l}%`
        );
      }

      // Apply background and card colors only in light mode
      // In dark mode, clear custom styles to use CSS defaults
      if (isDark) {
        root.style.removeProperty("--background");
        root.style.removeProperty("--parchment");
        root.style.removeProperty("--card");
        root.style.removeProperty("--popover");
      } else if (
        settings.theme_background_h &&
        settings.theme_background_s &&
        settings.theme_background_l
      ) {
        const bgL = Number(settings.theme_background_l);
        const bgS = Number(settings.theme_background_s);
        root.style.setProperty(
          "--background",
          `${settings.theme_background_h} ${settings.theme_background_s}% ${settings.theme_background_l}%`
        );
        root.style.setProperty(
          "--parchment",
          `${settings.theme_background_h} ${settings.theme_background_s}% ${bgL - 2}%`
        );
        // Card is slightly lighter than background
        root.style.setProperty(
          "--card",
          `${settings.theme_background_h} ${Math.min(bgS + 5, 100)}% ${Math.min(bgL + 2, 100)}%`
        );
        root.style.setProperty(
          "--popover",
          `${settings.theme_background_h} ${settings.theme_background_s}% ${Math.min(bgL + 3, 100)}%`
        );
      }

      // Load and apply fonts
      if (settings.theme_font_display) {
        loadGoogleFont(settings.theme_font_display);
        // NOTE: Tailwind maps font-display to CSS var (see tailwind.config.ts)
        root.style.setProperty("--font-display", `"${settings.theme_font_display}"`);
      }
      if (settings.theme_font_body) {
        loadGoogleFont(settings.theme_font_body);
        root.style.setProperty("--font-body", `"${settings.theme_font_body}"`);
      }
    };

    // Apply immediately
    applyTheme();

    // Watch for dark mode class changes on documentElement
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.attributeName === "class") {
          applyTheme();
          break;
        }
      }
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => {
      observer.disconnect();
    };
  }, [settings, isLoading, isDemoMode]);

  return null;
}
