import { useEffect } from "react";
import { useDemoMode } from "@/contexts/DemoContext";
import { loadDemoThemeSettings, loadDemoSiteSettings, DEFAULT_DEMO_THEME, DEFAULT_DEMO_SITE_SETTINGS } from "@/hooks/useDemoSiteSettings";

/**
 * Applies demo theme settings to CSS variables when in demo mode.
 * This overrides the live ThemeApplicator settings.
 */
export function DemoThemeApplicator() {
  const { isDemoMode } = useDemoMode();

  useEffect(() => {
    if (!isDemoMode) return;

    const applyDemoTheme = () => {
      const theme = loadDemoThemeSettings();
      const site = loadDemoSiteSettings();
      const root = document.documentElement;

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

      // Apply background color (only in light mode)
      if (!document.documentElement.classList.contains("dark")) {
        root.style.setProperty(
          "--background",
          `${theme.backgroundHue} ${theme.backgroundSaturation}% ${theme.backgroundLightness}%`
        );
        root.style.setProperty(
          "--parchment",
          `${theme.backgroundHue} ${theme.backgroundSaturation}% ${Number(theme.backgroundLightness) - 2}%`
        );
      }

      // Apply fonts
      if (theme.displayFont) {
        root.style.setProperty("--font-display", `"${theme.displayFont}", cursive`);
      }
      if (theme.bodyFont) {
        root.style.setProperty("--font-body", `"${theme.bodyFont}", serif`);
      }

      // Update document title for demo
      document.title = `${site.site_name || DEFAULT_DEMO_SITE_SETTINGS.site_name} (Demo)`;
    };

    // Apply immediately
    applyDemoTheme();

    // Listen for demo settings updates
    const handleSettingsUpdate = () => applyDemoTheme();
    window.addEventListener("demo-settings-updated", handleSettingsUpdate);

    return () => {
      window.removeEventListener("demo-settings-updated", handleSettingsUpdate);
    };
  }, [isDemoMode]);

  return null;
}
