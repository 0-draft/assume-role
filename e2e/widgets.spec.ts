import { expect, test, type Locator, type Page } from "@playwright/test";

// Interaction checks for the labs. They run against the English UI and lean on
// roles, ids and stable labels. Expected values come from the pure models
// (endpoints/model.ts, sessions/model.ts, ...), so a failure here means the
// picture on the page no longer matches the model, or the model changed.

async function open(page: Page) {
  await page.goto("./?lang=en");
  await expect(page.locator("h1")).toBeVisible();
  // Chapters after the first are lazy chunks; the last one marks "all loaded".
  await expect(page.locator("#glossary h2")).toBeVisible();
}

/** Segmented controls are visually hidden radios inside labels. */
async function pick(scope: Locator, name: string) {
  const radio = scope.getByRole("radio", { name, exact: true });
  await radio.check({ force: true });
  await expect(radio).toBeChecked();
}

const figure = (page: Page, title: string) =>
  page.locator("figure").filter({ hasText: title }).first();

/** The <dd> that follows a <dt> with this exact label. */
const field = (scope: Locator, label: string) =>
  scope.locator(`dt:text-is("${label}") + dd`);

test.describe("widgets (desktop)", () => {
  test.beforeEach(({ page: _page }, info) => {
    test.skip(info.project.name !== "desktop", "desktop-only interactions");
  });

  test("hero: switching the caller reprints the pass and links to a real chapter", async ({
    page,
  }) => {
    await open(page);
    const hero = page.locator('section[aria-labelledby="hero-title"]');
    await expect(hero.getByRole("img", { name: /by AssumeRole for/ })).toBeVisible();

    await pick(hero, "A GitHub Actions job");
    await expect(
      hero.getByRole("img", { name: /by AssumeRoleWithWebIdentity for/ }),
    ).toBeVisible();
    await expect(hero).toContainText("sts:AssumeRoleWithWebIdentity");

    const href = await hero.locator('p a[href^="#"]').getAttribute("href");
    expect(href).toMatch(/^#[a-z]+$/);
    await expect(page.locator(href!)).toHaveCount(1);
  });

  test("endpoints: the router shows where a global call is served, before and after April 2025", async ({
    page,
  }) => {
    await open(page);
    const sim = figure(page, "Where does my STS request actually go?");
    const served = field(sim, "Served in");
    const trail = field(sim, "CloudTrail event lands in");

    // Default: since 2025-04-18, EC2 in eu-north-1, global hostname, Amazon DNS.
    await expect(served).toContainText("eu-north-1");
    await expect(served).toContainText("served locally");
    await expect(trail).toContainText("us-east-1");

    await pick(sim, "Before Apr 2025");
    await expect(served).toContainText("us-east-1");
    await expect(served).not.toContainText("served locally");
    await expect(trail).toContainText("us-east-1");

    await pick(sim, "Since 2025-04-18");
    await pick(sim, "Laptop in Tokyo (outside AWS)");
    await expect(served).toContainText("us-east-1");

    await pick(sim, "EC2 in eu-north-1 (enabled by default)");
    await pick(sim, "sts.eu-north-1.amazonaws.com");
    await expect(served).toContainText("eu-north-1");
    await expect(trail).toContainText("eu-north-1");
  });

  test("endpoints: the hostname builder builds FIPS in us-east-1 and refuses it in Tokyo", async ({
    page,
  }) => {
    await open(page);
    const builder = figure(page, "Anatomy of an STS hostname");
    await builder.getByLabel("Region", { exact: true }).selectOption("us-east-1");
    await pick(builder, "FIPS");
    await expect(builder).toContainText("sts-fips");
    await expect(builder).not.toContainText("No such window");

    await builder.getByLabel("Region", { exact: true }).selectOption("ap-northeast-1");
    await expect(builder).toContainText("No such window");
  });

  test("api: choosing what you hold selects the matching ticket window", async ({
    page,
  }) => {
    await open(page);
    const api = page.locator("#api");
    await pick(api, "A SAML assertion from my IdP");
    await expect(api.locator('button[aria-pressed="true"][data-match]')).toContainText(
      "AssumeRoleWithSAML",
    );
    await expect(page.locator("#op-AssumeRoleWithSAML")).toBeVisible();

    await pick(api, "Just want to know who I am");
    await expect(page.locator("#op-GetCallerIdentity")).toBeVisible();
  });

  test("paths: the GitHub Actions flow steps to the end and back", async ({ page }) => {
    await open(page);
    const paths = page.locator("#paths");
    await pick(paths, "GitHub Actions OIDC");
    await expect(
      paths.getByRole("heading", { name: "GitHub Actions OIDC" }),
    ).toBeVisible();

    const counter = paths.getByText(/^Step \d+ \/ \d+$/);
    await expect(counter).toHaveText(/^Step 1 \/ \d+$/);
    const total = Number((await counter.textContent())!.split("/")[1]);
    expect(total).toBeGreaterThan(2);

    const next = paths.getByRole("button", { name: "Next", exact: true });
    for (let i = 1; i < total; i++) await next.click();
    await expect(counter).toHaveText(`Step ${total} / ${total}`);
    await expect(paths.getByRole("button", { name: "Start over" })).toBeVisible();

    await paths.getByRole("button", { name: "Back", exact: true }).click();
    await expect(counter).toHaveText(`Step ${total - 1} / ${total}`);
  });

  test("sessions: a chained hop asking for more than 1 h is rejected", async ({
    page,
  }) => {
    await open(page);
    const sessions = page.locator("#sessions");
    const chain = sessions.getByText("Role chaining is capped at 1 hour");
    await expect(chain).toHaveCount(0);

    // Hop 2 is a role session assuming a role: chaining.
    await sessions.getByLabel("DurationSeconds").nth(1).selectOption("7200");
    await expect(chain.first()).toBeVisible();
    await expect(sessions.getByText("Rejected", { exact: true }).first()).toBeVisible();

    await sessions.getByLabel("DurationSeconds").nth(1).selectOption("3600");
    await expect(chain).toHaveCount(0);
  });

  test("sessions: revoking active sessions turns earlier ones denied", async ({
    page,
  }) => {
    await open(page);
    // Filter on the figure title: the button text changes once you press it.
    const revoke = figure(page, "Revoke active sessions");
    const denied = revoke.getByText("denied", { exact: true });
    await expect(denied).toHaveCount(0);

    await revoke.getByRole("button", { name: "Revoke active sessions" }).click();
    await expect(denied.first()).toBeVisible();
    await expect(revoke).toContainText("AWSRevokeOlderSessions");
  });

  test("trust: a repo:* sub condition is flagged as open to every GitHub repo", async ({
    page,
  }) => {
    await open(page);
    const trust = page.locator("#trust");
    const warning = trust.getByText("Open to every GitHub repo");
    await pick(trust, "One repo, main only");
    await expect(warning).toHaveCount(0);

    await pick(trust, "repo:*");
    await expect(warning.first()).toBeVisible();
  });

  test("errors: a pasted ExpiredToken message is decoded", async ({ page }) => {
    await open(page);
    const errors = page.locator("#errors");
    await errors
      .getByLabel("Error message")
      .fill(
        "An error occurred (ExpiredToken) when calling the AssumeRoleWithWebIdentity operation: Token expired: current date/time 1760000000 must be before the expiration date/time 1759990000",
      );
    const result = errors.locator('[aria-live="polite"]').first();
    await expect(result.getByText("ExpiredToken", { exact: true }).first()).toBeVisible();
    await expect(result).toContainText("Request refused");

    await errors
      .getByLabel("Error message")
      .fill("something no STS error ever said, zzzz");
    await expect(result).toContainText("No documented STS error matches");
  });

  test("timeline: category chips filter the events", async ({ page }) => {
    await open(page);
    const timeline = page.locator("#timeline");
    const events = timeline.getByRole("link", { name: /^Read:/ });
    const all = await events.count();
    expect(all).toBeGreaterThan(10);

    const apis = timeline.getByRole("button", { name: "APIs" });
    await expect(apis).toHaveAttribute("aria-pressed", "true");
    await apis.click();
    await expect(apis).toHaveAttribute("aria-pressed", "false");
    await expect.poll(() => events.count()).toBeLessThan(all);

    await apis.click();
    await expect.poll(() => events.count()).toBe(all);
  });

  test("glossary: search narrows the terms", async ({ page }) => {
    await open(page);
    const glossary = page.locator("#glossary");
    const terms = glossary.locator("dt");
    const all = await terms.count();
    expect(all).toBeGreaterThan(30);

    await glossary.getByLabel("Search terms").fill("IRSA");
    await expect.poll(() => terms.count()).toBeLessThan(all);
    await expect(terms.filter({ hasText: "IRSA" }).first()).toBeVisible();

    await glossary.getByLabel("Search terms").fill("zzzz-no-such-term");
    await expect(glossary).toContainText("No term matches");
  });

  test("header: the Chapters menu jumps to a chapter", async ({ page }) => {
    await open(page);
    await page.getByRole("button", { name: "Chapters" }).click();
    const menu = page.locator("#mobile-nav");
    await expect(menu).toBeVisible();
    await menu.getByRole("link", { name: /Trust policies/ }).click();
    await expect(page).toHaveURL(/#trust$/);
    await expect(menu).toBeHidden();
    await expect(page.locator("#trust h2")).toBeInViewport();
  });
});

test("paths: phones pick a path from a native select", async ({ page }, info) => {
  test.skip(info.project.name !== "phone", "phone-only picker");
  await open(page);
  const paths = page.locator("#paths");
  await paths.getByLabel("Credential path").selectOption("github");
  await expect(paths.getByRole("heading", { name: "GitHub Actions OIDC" })).toBeVisible();
  await expect(paths.getByText(/^Step 1 \/ \d+$/)).toBeVisible();
});
