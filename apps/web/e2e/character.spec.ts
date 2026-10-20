import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { settled, sitePath, skipGate, url, watchErrors } from "./helpers";

const QUEUE = [
  "fanny",
  "layla",
  "ruby",
  "angela",
  "lesley",
  "change",
  "guinevere",
  "vexana",
  "obsidia",
  "selena",
] as const;

/**
 * Layla (cut-out), Ruby (no cut-out), Vexana (forms). Selena and Obsidia have pages of their
 * own (see selena.spec.ts and obsidia.spec.ts).
 */
const PAGES = [
  { slug: "layla", name: "Layla" },
  { slug: "ruby", name: "Ruby" },
  { slug: "vexana", name: "Vexana" },
] as const;

async function serious(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"])
    .analyze();
  return results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => ({ id: v.id, help: v.help, nodes: v.nodes.map((n) => n.target.join(" ")) }));
}

async function noOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const el = document.scrollingElement ?? document.documentElement;
    return el.scrollWidth - window.innerWidth;
  });
  expect(overflow).toBeLessThanOrEqual(0);
}

test.beforeEach(async ({ page }) => {
  await skipGate(page);
});

test.describe("roster", () => {
  /** The row of panels: it scrolls sideways, and the page itself does not scroll. */
  const row = (page: Page) =>
    page.getByRole("region", { name: "The ten Aspirants, scrolls sideways" });
  const left = (page: Page) => row(page).evaluate((el) => el.scrollLeft);
  const lit = (page: Page) => page.locator("nav[aria-label='Jump to an Aspirant'] [aria-current]");

  test("loads with one h1, ten panels of splash art and no errors", async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(url("/character/"));
    await page.waitForLoadState("networkidle");
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1, name: "Meet the ten" })).toBeAttached();
    const cards = page.locator('main a[href*="/character/"]');
    await expect(cards).toHaveCount(10);
    // The only pictures on the wall are the splash art of the ten.
    const sources = await page
      .locator("main img")
      .evaluateAll((els) => els.map((el) => el.getAttribute("src") ?? ""));
    expect(sources.length).toBeGreaterThanOrEqual(10);
    for (const src of sources) expect(src).toMatch(/\/img\/char\/[a-z]+\/splash(-sm)?\.webp$/);
    await noOverflow(page);
    // It is a wall that scrolls sideways, not a page that scrolls down.
    expect(
      await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1),
    ).toBe(true);
    expect(await row(page).evaluate((el) => el.scrollWidth > el.clientWidth * 3)).toBe(true);
    expect(errors).toEqual([]);
  });

  test("scrolls sideways, settles on a panel and lights it", async ({ page }, info) => {
    await page.goto(url("/character/"));
    await page.waitForLoadState("networkidle");
    await expect(lit(page)).toHaveCount(0);
    if (info.project.name === "desktop") {
      await page.mouse.move(700, 500);
      await page.mouse.wheel(0, 900);
      await expect.poll(() => left(page), { timeout: 5000 }).toBeGreaterThan(200);
    } else {
      await row(page).evaluate((el) => el.scrollTo({ left: el.clientWidth * 1.4 }));
    }
    // It comes to rest on a panel (the magnet), and that panel is the lit one.
    await expect(lit(page)).toHaveCount(1, { timeout: 5000 });
    const panel = page.locator("main li[data-active='true']");
    await expect(panel).toHaveCount(1);
    await expect(panel.locator("a")).toHaveAttribute("href", /\/character\/[a-z]+\/?$/);
    await page.keyboard.press("Home");
    await expect.poll(() => left(page), { timeout: 5000 }).toBeLessThan(4);
    await page.keyboard.press("ArrowRight");
    await expect(lit(page)).toHaveCount(1, { timeout: 5000 });
    await page.keyboard.press("End");
    await expect
      .poll(() => row(page).evaluate((el) => el.scrollWidth - el.clientWidth - el.scrollLeft), {
        timeout: 6000,
      })
      .toBeLessThan(4);
  });

  test("the rail jumps to an Aspirant and the count of those met goes up", async ({ page }) => {
    await page.goto(url("/character/"));
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("Aspirants met:")).toContainText("0/10");
    const rail = page.getByRole("navigation", { name: "Jump to an Aspirant" });
    await rail.getByRole("button", { name: "Obsidia" }).click();
    await expect(rail.getByRole("button", { name: "Obsidia" })).toHaveAttribute(
      "aria-current",
      "true",
      { timeout: 6000 },
    );
    // Stopping on a panel for a moment meets it.
    await expect(page.getByText("Aspirants met:")).toContainText("1/10", { timeout: 6000 });
    const panel = page.locator("main li[data-active='true']");
    await expect(panel).toContainText("Obsidia");
    await expect(panel.getByText("Open file")).toBeAttached();
    expect(await page.evaluate(() => window.localStorage.getItem("aspirants:met"))).toContain(
      "obsidia",
    );
  });

  test("a click closes the other panels and opens the character page", async ({
    page,
    baseURL,
  }) => {
    await page.goto(url("/character/"));
    await page.waitForLoadState("networkidle");
    const rail = page.getByRole("navigation", { name: "Jump to an Aspirant" });
    await rail.getByRole("button", { name: "Ruby" }).click();
    await expect(page.locator("main li[data-active='true']")).toContainText("Ruby", {
      timeout: 6000,
    });
    await page.locator('main li[data-active="true"] a').click();
    await expect(page.locator("section[data-chosen='true']")).toBeAttached();
    await settled(page);
    await expect.poll(() => sitePath(page, baseURL)).toBe("/character/ruby/");
    await expect(page.getByRole("heading", { level: 1, name: "Ruby" })).toBeVisible();
  });

  test("panels open the character page from the keyboard", async ({ page, baseURL }) => {
    await page.goto(url("/character/"));
    await page.locator('main a[href*="/character/ruby"]').first().focus();
    await page.keyboard.press("Enter");
    await settled(page);
    await expect.poll(() => sitePath(page, baseURL)).toBe("/character/ruby/");
    await expect(page.getByRole("heading", { level: 1, name: "Ruby" })).toBeVisible();
  });

  test("goes on to the collection", async ({ page, baseURL }) => {
    await page.goto(url("/character/"));
    await page.getByRole("button", { name: /^Continue to The collection/ }).click();
    await settled(page);
    await expect.poll(() => sitePath(page, baseURL)).toBe("/collection/");
  });

  test("has no serious accessibility violations", async ({ page }) => {
    await page.goto(url("/character/"));
    await page.waitForLoadState("networkidle");
    const found = await serious(page);
    expect(found, JSON.stringify(found, null, 2)).toEqual([]);
  });
});

for (const { slug, name } of PAGES) {
  test.describe(`character ${slug}`, () => {
    test("loads with one h1, no errors and no overflow", async ({ page }) => {
      const errors = watchErrors(page);
      const response = await page.goto(url(`/character/${slug}/`));
      expect(response?.status()).toBe(200);
      await page.waitForLoadState("networkidle");
      await expect(page.locator("h1")).toHaveCount(1);
      await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
      await noOverflow(page);
      for (const id of [
        "profile-title",
        "links-title",
        "voice-title",
        "media-title",
        "story-title",
      ])
        await expect(page.locator(`#${id}`)).toHaveCount(1);
      await expect(page.getByRole("button", { name: /^Continue to/ })).toHaveCount(1);
      expect(errors).toEqual([]);
    });

    test("has no serious accessibility violations", async ({ page }) => {
      await page.goto(url(`/character/${slug}/`));
      await page.waitForLoadState("networkidle");
      const found = await serious(page);
      expect(found, JSON.stringify(found, null, 2)).toEqual([]);
    });
  });
}

test("voice wall: arrow keys move, search filters, random plays", async ({ page }) => {
  await page.goto(url("/character/layla/"));
  const wall = page.locator("section[aria-labelledby='voice-title']");
  const lines = wall.getByRole("list").first().getByRole("button");
  await expect(lines).toHaveCount(28);
  await lines.first().focus();
  await page.keyboard.press("ArrowRight");
  await expect(lines.nth(1)).toBeFocused();
  await page.keyboard.press("End");
  await expect(lines.nth(27)).toBeFocused();
  await wall.getByRole("searchbox", { name: "Search lines" }).fill("magic gun");
  await expect(lines).toHaveCount(1);
  await expect(lines.first()).toContainText("magic gun");
  await wall.getByRole("button", { name: "Play random" }).click();
});

test("spoilers stay sealed until opened", async ({ page }) => {
  await page.goto(url("/character/vexana/"));
  const button = page.getByRole("button", { name: "Show spoilers" });
  await expect(button).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByText("In the void, the Will remakes her")).toHaveCount(0);
  await button.click();
  await expect(page.getByRole("button", { name: "Seal the record" })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await expect(page.getByText(/In the void, the Will remakes her/)).toBeVisible();
});

test("the form toggle switches between the two forms", async ({ page }) => {
  await page.goto(url("/character/vexana/"));
  const group = page.getByRole("group", { name: "Vexana's form" });
  await group.getByRole("button", { name: "Ender form" }).click();
  await expect(group.getByRole("button", { name: "Ender form" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(
    page.getByText("Official mobile wallpaper. Her splash art shows this form too."),
  ).toBeVisible();
});

test("the next footer chain visits all ten and loops", async ({ page, baseURL }, info) => {
  test.skip(info.project.name !== "desktop", "One walk through the queue is enough");
  test.setTimeout(90_000);
  await page.goto(url("/character/fanny/"));
  const overlay = page.locator('[data-overlay="transition"]');
  for (let i = 1; i <= QUEUE.length; i++) {
    const next = QUEUE[i % QUEUE.length];
    await page.getByRole("button", { name: /^Continue to/ }).click();
    await expect
      .poll(() => sitePath(page, baseURL), { timeout: 15_000 })
      .toBe(`/character/${next}/`);
    await expect(overlay).toHaveAttribute("data-active", "false", { timeout: 15_000 });
  }
});

test("an unknown character gets the 404 page", async ({ page }) => {
  const response = await page.goto(url("/character/nobody/"));
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1, name: "Signal lost" })).toBeVisible();
});
