import { expect, test } from "@playwright/test";

import { skipGate, url } from "./helpers";

test.describe("menu art", () => {
  test.beforeEach(async ({ page }) => {
    await skipGate(page);
    await page.goto(url("/"));
    await page.getByRole("button", { name: /open menu/i }).click();
  });

  test("the pair of the current page stands in the menu, level and facing each other", async ({
    page,
  }) => {
    const shown = page.locator('[data-shown="true"] img');
    await expect(shown).toHaveCount(2);
    await expect(shown.first()).toBeVisible();
    await expect
      .poll(async () => shown.first().evaluate((el) => (el as HTMLImageElement).complete))
      .toBe(true);
    const [left, right] = await shown.evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        return { top: r.top, height: r.height, left: r.left, right: r.right };
      }),
    );
    // Both canvases have one top and one height: the eyes are on one line.
    expect(Math.abs((left?.top ?? 0) - (right?.top ?? 1))).toBeLessThan(1);
    expect(Math.abs((left?.height ?? 0) - (right?.height ?? 1))).toBeLessThan(1);
    // The left figure is on the left of the screen's middle, the right one on the right.
    const middle = page.viewportSize()?.width ?? 0;
    expect((left?.left ?? 0) + (left?.right ?? 0)).toBeLessThan(middle * 1.2);
    expect((right?.left ?? 0) + (right?.right ?? 0)).toBeGreaterThan(middle * 0.8);
  });

  test("hovering another page swaps the pair and it stays where it is", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "nothing hovers on a touch screen");
    const imgs = page.locator('[data-shown="true"] img');
    const before = await imgs.first().getAttribute("src");
    const box = await imgs.first().boundingBox();
    const link = page.getByRole("navigation", { name: "Menu" }).getByRole("link").nth(3);
    await link.hover();
    await expect(imgs.first()).not.toHaveAttribute("src", before ?? "");
    await expect(imgs).toHaveCount(2);
    const after = await imgs.first().boundingBox();
    // The same place: the art does not follow the title that is hovered.
    expect(Math.abs((after?.y ?? 0) - (box?.y ?? 0))).toBeLessThan(2);
    expect(Math.abs((after?.height ?? 0) - (box?.height ?? 0))).toBeLessThan(2);
  });
});
