import { useEffect, useRef } from "react";
import { useDemoMode } from "@/contexts/DemoContext";
import { loadDemoThemeSettings, loadDemoSiteSettings, DEFAULT_DEMO_SITE_SETTINGS, DEFAULT_DEMO_THEME } from "@/hooks/useDemoSiteSettings";

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
 * Applies demo theme settings to CSS variables when in demo mode.
 * This overrides the live ThemeApplicator settings.
 */
export function DemoThemeApplicator() {
  const { isDemoMode } = useDemoMode();
  const appliedRef = useRef(false);

  useEffect(() => {
    if (!isDemoMode) {
      appliedRef.current = false;
      return;
    }

    const applyDemoTheme = () => {
      const theme = loadDemoThemeSettings();
      const site = loadDemoSiteSettings();
      const root = document.documentElement;
      const isDark = root.classList.contains("dark");

      // Apply primary color
      root.style.setProperty(
        "--primary",
        `${theme.primaryHue} ${theme.primarySaturation}% ${theme.primaryLightness}%`
      );
      root.style.setProperty(
        "--ring",
        `${theme.primaryHue} ${theme.primarySaturation}% ${theme.primaryLightness}%`
      );
      root.style.setProperty(
        "--forest",
        `${theme.primaryHue} ${theme.primarySaturation}% ${theme.primaryLightness}%`
      );

      // Apply accent color
      root.style.setProperty(
        "--accent",
        `${theme.accentHue} ${theme.accentSaturation}% ${theme.accentLightness}%`
      );
      root.style.setProperty(
        "--sienna",
        `${theme.accentHue} ${theme.accentSaturation}% ${theme.accentLightness}%`
      );

      // Apply background and card colors only in light mode
      // In dark mode, clear custom styles to use CSS defaults
      if (isDark) {
        root.style.removeProperty("--background");
        root.style.removeProperty("--parchment");
        root.style.removeProperty("--card");
        root.style.removeProperty("--popover");
      } else {
        root.style.setProperty(
          "--background",
          `${theme.backgroundHue} ${theme.backgroundSaturation}% ${theme.backgroundLightness}%`
        );
        root.style.setProperty(
          "--parchment",
          `${theme.backgroundHue} ${theme.backgroundSaturation}% ${Number(theme.backgroundLightness) - 2}%`
        );
        // Card is slightly lighter than background
        root.style.setProperty(
          "--card",
          `${theme.backgroundHue} ${Math.min(theme.backgroundSaturation + 5, 100)}% ${Math.min(theme.backgroundLightness + 2, 100)}%`
        );
        root.style.setProperty(
          "--popover",
          `${theme.backgroundHue} ${theme.backgroundSaturation}% ${Math.min(theme.backgroundLightness + 3, 100)}%`
        );
      }

      // Load and apply fonts
      const displayFont = theme.displayFont || DEFAULT_DEMO_THEME.displayFont;
      const bodyFont = theme.bodyFont || DEFAULT_DEMO_THEME.bodyFont;
      
      // Load Google Fonts dynamically
      loadGoogleFont(displayFont);
      loadGoogleFont(bodyFont);
      
      // Apply font CSS variables
      // NOTE: Tailwind maps font-display/font-body to CSS vars (see tailwind.config.ts)
      root.style.setProperty("--font-display", `"${displayFont}"`);
      root.style.setProperty("--font-body", `"${bodyFont}"`);

      // Update document title for demo
      document.title = `${site.site_name || DEFAULT_DEMO_SITE_SETTINGS.site_name} (Demo)`;
      
      appliedRef.current = true;
    };

    // Apply immediately
    applyDemoTheme();

    // Re-apply after a short delay to ensure it overrides ThemeApplicator
    const overrideTimer = setTimeout(applyDemoTheme, 100);

    // Listen for demo settings updates
    const handleSettingsUpdate = () => applyDemoTheme();
    window.addEventListener("demo-settings-updated", handleSettingsUpdate);

    // Watch for dark mode class changes on documentElement
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.attributeName === "class") {
          applyDemoTheme();
          break;
        }
      }
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => {
      clearTimeout(overrideTimer);
      window.removeEventListener("demo-settings-updated", handleSettingsUpdate);
      observer.disconnect();
    };
  }, [isDemoMode]);

  return null;
}
