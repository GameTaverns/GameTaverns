import { useEffect } from "react";
import { useDemoMode } from "@/contexts/DemoContext";

/**
 * Applies runtime theme config for self-hosted/standalone deployments only.
 * In demo mode, this is skipped so DemoThemeApplicator takes over.
 */
export function ThemeApplicator() {
  const { isDemoMode } = useDemoMode();

  useEffect(() => {
    if (isDemoMode) return;

    const runtimeConfig = (window as any).__RUNTIME_CONFIG__;
    const runtimeTheme = runtimeConfig?.THEME;
    if (!runtimeTheme) return;

    const applyTheme = () => {
      const root = document.documentElement;
      const isDark = root.classList.contains("dark");
      const themeMode = isDark ? runtimeTheme.DARK : runtimeTheme.LIGHT;
      if (!themeMode) return;

      const props: Record<string, string | undefined> = {
        "--background": themeMode.background,
        "--foreground": themeMode.foreground,
        "--card": themeMode.card,
        "--card-foreground": themeMode.cardForeground,
        "--primary": themeMode.primary,
        "--primary-foreground": themeMode.primaryForeground,
        "--secondary": themeMode.secondary,
        "--secondary-foreground": themeMode.secondaryForeground,
        "--muted": themeMode.muted,
        "--muted-foreground": themeMode.mutedForeground,
        "--accent": themeMode.accent,
        "--accent-foreground": themeMode.accentForeground,
        "--border": themeMode.border,
        "--sidebar-background": themeMode.sidebarBackground,
        "--sidebar-foreground": themeMode.sidebarForeground,
        "--sidebar-border": themeMode.sidebarBorder,
      };

      for (const [key, value] of Object.entries(props)) {
        if (value) root.style.setProperty(key, value);
      }

      // Set neutral fonts for standalone
      root.style.setProperty("--font-display", '"Inter"');
      root.style.setProperty("--font-body", '"Inter"');
    };

    applyTheme();

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

    return () => observer.disconnect();
  }, [isDemoMode]);

  return null;
}
