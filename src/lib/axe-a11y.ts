/**
 * Initialise @axe-core/react in development mode only.
 * Call once from main.tsx — it's a no-op in production builds.
 *
 * Violations will appear as console warnings grouped by impact level.
 */
export async function initAxeA11y() {
  // Completely skip in production — no import attempted
  if (import.meta.env.PROD) return;

  try {
    const React = await import("react");
    const ReactDOM = await import("react-dom");
    // @ts-ignore — optional dev dependency, may not be installed
    const axe = await import(/* @vite-ignore */ "@axe-core/react");

    axe.default(React.default, ReactDOM.default, 1500, {
      rules: [
        { id: "color-contrast", enabled: true },
        { id: "image-alt", enabled: true },
        { id: "label", enabled: true },
        { id: "button-name", enabled: true },
        { id: "link-name", enabled: true },
        { id: "region", enabled: true },
        { id: "aria-valid-attr", enabled: true },
        { id: "aria-valid-attr-value", enabled: true },
      ],
    });

    console.log(
      "%c♿ axe-core accessibility checker active",
      "color: #4caf50; font-weight: bold; font-size: 12px;"
    );
  } catch {
    // axe-core not installed or failed — silently skip
  }
}
