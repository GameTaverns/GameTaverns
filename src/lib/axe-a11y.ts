/**
 * Initialise @axe-core/react in development mode only.
 * Call once from main.tsx — it's a no-op in production builds.
 *
 * Violations will appear as console warnings grouped by impact level.
 */
export async function initAxeA11y() {
  if (import.meta.env.PROD) return;

  try {
    const React = await import("react");
    const ReactDOM = await import("react-dom");
    const axe = await import("@axe-core/react");

    axe.default(React.default, ReactDOM.default, 1500, {
      // Only flag serious / critical issues to avoid noise
      rules: [
        // Ensure colour contrast meets WCAG AA
        { id: "color-contrast", enabled: true },
        // Ensure images have alt text
        { id: "image-alt", enabled: true },
        // Ensure form inputs have labels
        { id: "label", enabled: true },
        // Ensure buttons have accessible names
        { id: "button-name", enabled: true },
        // Ensure links have discernible text
        { id: "link-name", enabled: true },
        // Ensure landmark regions are correct
        { id: "region", enabled: true },
        // Ensure ARIA attributes are valid
        { id: "aria-valid-attr", enabled: true },
        { id: "aria-valid-attr-value", enabled: true },
      ],
    });

    console.log(
      "%c♿ axe-core accessibility checker active — violations will appear below",
      "color: #4caf50; font-weight: bold; font-size: 12px;"
    );
  } catch (err) {
    console.warn("axe-core failed to initialise:", err);
  }
}
