import { test, expect } from "../playwright-fixture";
import AxeBuilder from "@axe-core/playwright";

/**
 * Automated accessibility audit using axe-core + Playwright.
 *
 * Runs against key pages and fails the test if any serious or
 * critical WCAG violations are found. Moderate / minor issues are
 * logged but don't break the build so teams can triage them.
 */

const ROUTES_TO_AUDIT = [
  { name: "Landing page", path: "/" },
  { name: "Login", path: "/login" },
  { name: "Directory", path: "/directory" },
  { name: "Catalog", path: "/catalog" },
  { name: "Install", path: "/install" },
  { name: "Privacy", path: "/privacy" },
  { name: "Terms", path: "/terms" },
  { name: "Cookies", path: "/cookies" },
];

for (const route of ROUTES_TO_AUDIT) {
  test(`a11y: ${route.name} (${route.path}) has no critical violations`, async ({ page }) => {
    await page.goto(route.path, { waitUntil: "networkidle" });

    // Give React time to render
    await page.waitForTimeout(1500);

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    // Log all violations for visibility
    if (results.violations.length > 0) {
      console.log(`\n♿ ${route.name} — ${results.violations.length} a11y violations found:`);
      for (const v of results.violations) {
        console.log(`  [${v.impact}] ${v.id}: ${v.description} (${v.nodes.length} instances)`);
      }
    }

    // Only fail on serious / critical
    const criticalViolations = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious"
    );

    expect(
      criticalViolations,
      `${route.name} has ${criticalViolations.length} serious/critical a11y violations:\n` +
        criticalViolations
          .map((v) => `  [${v.impact}] ${v.id}: ${v.description}`)
          .join("\n")
    ).toHaveLength(0);
  });
}
