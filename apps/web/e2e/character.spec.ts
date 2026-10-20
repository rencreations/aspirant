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
  test("loads with one h1, ten cards, filters and no errors", async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(url("/character/"));
    await page.waitForLoadState("networkidle");
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Meet the ten");
    const cards = page.locator('main a[href*="/character/"]:visible');
    await expect(cards).toHaveCount(10);
    await noOverflow(page);

    const filters = page.getByRole("group", { name: "Filter the roster" });
    await filters.getByRole("button", { name: "Fanny and Layla" }).click();
    await expect(filters.getByRole("button", { name: "Fanny and Layla" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(cards).toHaveCount(2);
    await filters.getByRole("button", { name: "Storm" }).click();
    await expect(cards).toHaveCount(1);
    await expect(cards.first()).toContainText("Obsidia");
    await filters.getByRole("button", { name: "All ten" }).click();
    await expect(cards).toHaveCount(10);
    expect(errors).toEqual([]);
  });

  test("cards open the character page from the keyboard", async ({ page, baseURL }) => {
    await page.goto(url("/character/"));
    // The cards breathe (idle float), so drive them like a keyboard user would.
    await page.locator('main a[href*="/character/ruby"]').first().focus();
    await page.keyboard.press("Enter");
    await settled(page);
    await expect.poll(() => sitePath(page, baseURL)).toBe("/character/ruby/");
    await expect(page.getByRole("heading", { level: 1, name: "Ruby" })).toBeVisible();
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
