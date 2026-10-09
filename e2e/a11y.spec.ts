import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// Automated WCAG 2.2 AA checks in both languages and both themes. Dark mode
// matters on its own: the route colours are pale there, so text on them flips.
for (const lang of ["en", "ja"] as const) {
  for (const scheme of ["light", "dark"] as const) {
    test(`no WCAG A/AA violations (${lang}, ${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(`./?lang=${lang}`);
      await expect(page.locator("h1")).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      const { violations } = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();
      const summary = violations.map(
        (v) =>
          `${v.id} (${v.impact}): ${v.nodes.length}× — ${v.nodes
            .slice(0, 3)
            .map((n) => n.target.join(" "))
            .join(" | ")}`,
      );
      expect(summary).toEqual([]);
    });
  }
}
