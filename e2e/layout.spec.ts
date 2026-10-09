import { expect, test, type Page } from "@playwright/test";

const LANGS = ["en", "ja"] as const;

async function open(page: Page, lang: (typeof LANGS)[number]) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    // Google Fonts can be unreachable in CI; that is not a page bug.
    if (m.type() === "error" && !m.location().url.includes("fonts.g"))
      errors.push(m.text());
  });
  await page.goto(`./?lang=${lang}`);
  await expect(page.locator("h1")).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  return errors;
}

for (const lang of LANGS) {
  test(`renders without errors and never scrolls sideways (${lang})`, async ({
    page,
  }) => {
    const errors = await open(page, lang);
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
    expect(errors).toEqual([]);
  });
}

test("every in-page link lands on exactly one element", async ({ page }) => {
  await open(page, "en");
  const hrefs = await page
    .locator("a[href^='#']")
    .evaluateAll((as) => as.map((a) => a.getAttribute("href")));
  for (const h of new Set(hrefs)) {
    if (!h || h === "#") continue;
    await expect(page.locator(h), h).toHaveCount(1);
  }
});

test("the language switch rewrites the page and the URL", async ({ page }) => {
  await open(page, "en");
  await page.getByRole("button", { name: "日本語" }).click();
  await expect(page).toHaveURL(/lang=ja/);
  await expect(page.locator("html")).toHaveAttribute("lang", "ja");
});
