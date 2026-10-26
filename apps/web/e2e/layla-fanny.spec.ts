import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { skipGate, url, watchErrors } from "./helpers";

/**
 * Layla's page and Fanny's page share one design (the line that carries the beam). The test browser
 * may not decode H.264, so these specs check what does not depend on playback: the layout, the
 * first screen's shots, the notes, the voice wall, the gallery and the link between the two.
 */
test.describe.configure({ timeout: 90_000 });

const PAGES = [
  { who: "layla", name: "Layla", partner: "Fanny", cursor: "FIRE" },
  { who: "fanny", name: "Fanny", partner: "Layla", cursor: "HOOK" },
] as const;

test.beforeEach(async ({ page }) => {
  await skipGate(page);
});

for (const { who, name, partner } of PAGES) {
  test.describe(`${who}'s page`, () => {
    test("loads with one h1, every section, no errors and no overflow", async ({ page }) => {
      const errors = watchErrors(page);
      const response = await page.goto(url(`/character/${who}/`));
      expect(response?.status()).toBe(200);
      await page.waitForLoadState("networkidle");
      await expect(page.locator("h1")).toHaveCount(1);
      await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
      for (const id of ["profile", "notes", "voice", "films", "gallery", "music", "together"])
        await expect(page.locator(`section#${id}`)).toHaveCount(1);
      const overflow = await page.evaluate(
        () => (document.scrollingElement ?? document.documentElement).scrollWidth - innerWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
      await expect(page.getByRole("button", { name: /^Continue to/ })).toHaveCount(1);
      expect(errors).toEqual([]);
    });

    test("a press on the first screen draws a shot, and it goes away again", async ({
      page,
    }, info) => {
      test.skip(info.project.name !== "desktop", "A press needs a pointer here");
      await page.goto(url(`/character/${who}/`));
      await page.waitForLoadState("networkidle");
      const layer = page.locator("#top div[aria-hidden='true'] > span");
      const before = await layer.count();
      await page.mouse.click(700, 420);
      await expect.poll(() => layer.count(), { timeout: 2000 }).toBeGreaterThan(before);
      await expect.poll(() => layer.count(), { timeout: 4000 }).toBeLessThanOrEqual(before);
    });

    test("the notes are tabs: one at a time, with the arrow keys", async ({ page }) => {
      await page.goto(url(`/character/${who}/`));
      const tabs = page.getByRole("tab");
      await expect(tabs).toHaveCount(6);
      await expect(tabs.first()).toHaveAttribute("aria-selected", "true");
      const panel = page.getByRole("tabpanel");
      const first = await panel.innerText();
      await tabs.first().focus();
      await page.keyboard.press("ArrowRight");
      await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
      await expect(tabs.nth(1)).toBeFocused();
      expect(await panel.innerText()).not.toBe(first);
      await page.keyboard.press("ArrowLeft");
      await page.keyboard.press("ArrowLeft");
      await expect(tabs.nth(5)).toHaveAttribute("aria-selected", "true");
    });

    test("the voice wall lists her lines and the gallery opens the viewer", async ({ page }) => {
      await page.goto(url(`/character/${who}/`));
      const lines = page.locator("section#voice ul button");
      expect(await lines.count()).toBeGreaterThan(20);
      await expect(lines.first()).toHaveAttribute("aria-pressed", "false");
      const tile = page.locator("section#gallery ul button").first();
      await tile.scrollIntoViewIfNeeded();
      await tile.click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
    });

    test("leads to her partner's page", async ({ page }) => {
      await page.goto(url(`/character/${who}/`));
      const link = page.getByRole("link", { name: new RegExp(`^Meet ${partner}`) });
      await expect(link).toHaveAttribute(
        "href",
        new RegExp(`/character/${partner.toLowerCase()}/`),
      );
    });

    test("has no serious accessibility violations", async ({ page }) => {
      await page.goto(url(`/character/${who}/`));
      await page.waitForLoadState("networkidle");
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"])
        .analyze();
      const found = results.violations
        .filter((v) => v.impact === "serious" || v.impact === "critical")
        .map((v) => ({ id: v.id, help: v.help, nodes: v.nodes.map((n) => n.target.join(" ")) }));
      expect(found, JSON.stringify(found, null, 2)).toEqual([]);
    });
  });
}
