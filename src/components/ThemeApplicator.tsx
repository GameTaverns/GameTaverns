import { useEffect } from "react";
import { useSiteSettings } from "@/hooks/useSiteSettings";

/**
 * Applies saved theme settings from the database to CSS variables on mount.
 * This component should be rendered once near the root of the app.
 */
export function ThemeApplicator() {
  const { data: settings, isLoading } = useSiteSettings();

  useEffect(() => {
    if (isLoading || !settings) return;

    const root = document.documentElement;

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

    // Apply background color (only in light mode)
    if (
      settings.theme_background_h &&
      settings.theme_background_s &&
      settings.theme_background_l &&
      !document.documentElement.classList.contains("dark")
    ) {
      root.style.setProperty(
        "--background",
        `${settings.theme_background_h} ${settings.theme_background_s}% ${settings.theme_background_l}%`
      );
      root.style.setProperty(
        "--parchment",
        `${settings.theme_background_h} ${settings.theme_background_s}% ${Number(settings.theme_background_l) - 2}%`
      );
    }

    // Apply fonts via CSS variables (requires corresponding CSS setup)
    if (settings.theme_font_display) {
      root.style.setProperty("--font-display", `"${settings.theme_font_display}", cursive`);
    }
    if (settings.theme_font_body) {
      root.style.setProperty("--font-body", `"${settings.theme_font_body}", serif`);
    }
  }, [settings, isLoading]);

  return null;
}
