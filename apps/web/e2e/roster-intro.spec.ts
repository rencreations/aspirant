import { expect, test, type Page } from "@playwright/test";

import { skipGate, url } from "./helpers";

/**
 * The opening of /character. The picture is drawn in one WebGL canvas that covers the page and is
 * removed when it ends. Reduced motion, `?intro=off` and a browser without WebGL show the finished
 * page at once. The frame checks use `?introT=<t>`, which freezes the intro at a time.
 */

const CANVAS = "canvas[data-roster-intro-canvas]";

async function hasWebGL2(page: Page): Promise<boolean> {
  return page.evaluate(() => !!document.createElement("canvas").getContext("webgl2"));
}

test.describe("roster intro", () => {
  test.beforeEach(async ({ page }) => {
    await skipGate(page, { intro: true });
  });

  test("?intro=off shows the page and draws no canvas", async ({ page }) => {
    await page.goto(url("/character/?intro=off"));
    await expect(
      page.getByRole("region", { name: "The ten Aspirants, scrolls sideways" }),
    ).toBeVisible();
    await page.waitForTimeout(600);
    await expect(page.locator(CANVAS)).toHaveCount(0);
    const state = await page.evaluate(() => window.__rosterIntro?.state ?? "none");
    expect(["none", "ended"]).toContain(state);
  });

  test("reduced motion skips the intro", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(url("/character/"));
    await expect(
      page.getByRole("region", { name: "The ten Aspirants, scrolls sideways" }),
    ).toBeVisible();
    await page.waitForTimeout(800);
    await expect(page.locator(CANVAS)).toHaveCount(0);
  });

  test("?introT freezes the picture: a canvas over the page, below the site bar", async ({
    page,
  }) => {
    await page.goto(url("/character/?introT=1.7"));
    test.skip(!(await hasWebGL2(page)), "no WebGL2 in this browser");
    const canvas = page.locator(CANVAS);
    await expect(canvas).toHaveCount(1, { timeout: 20_000 });
    await expect
      .poll(() => page.evaluate(() => window.__rosterIntro?.state), { timeout: 20_000 })
      .toBe("frozen");
    const box = await canvas.boundingBox();
    const view = page.viewportSize();
    expect(box?.width).toBeCloseTo(view?.width ?? 0, 0);
    expect(box?.height).toBeCloseTo(view?.height ?? 0, 0);
    const z = await canvas.evaluate((el) => Number(getComputedStyle(el).zIndex));
    const nav = await page.evaluate(() => {
      const raw = getComputedStyle(document.documentElement).getPropertyValue("--z-nav");
      return Number(raw);
    });
    expect(z).toBeLessThan(nav);
    // The API the comparison tool uses.
    const duration = await page.evaluate(() => window.__rosterIntro?.duration ?? 0);
    expect(duration).toBeGreaterThan(4.2);
    await page.evaluate(() => window.__rosterIntro?.seek(3.0));
    await expect(canvas).toHaveCount(1);
  });

  test("plays by itself, then removes the canvas and leaves no loop running", async ({ page }) => {
    await page.goto(url("/character/"));
    test.skip(!(await hasWebGL2(page)), "no WebGL2 in this browser");
    await expect(page.locator(CANVAS)).toHaveCount(1, { timeout: 20_000 });
    await expect
      .poll(() => page.evaluate(() => window.__rosterIntro?.state), { timeout: 20_000 })
      .toBe("playing");
    await expect(page.locator(CANVAS)).toHaveCount(0, { timeout: 15_000 });
    await expect
      .poll(() => page.evaluate(() => window.__rosterIntro?.state), { timeout: 5_000 })
      .toBe("ended");
    // Nothing of the intro is left: no canvas, no video element, and the page takes a click.
    await expect(page.locator("[data-roster-intro] canvas")).toHaveCount(0);
    expect(await page.evaluate(() => document.querySelectorAll("video").length)).toBe(0);
    await page.keyboard.press("ArrowRight");
    await expect(
      page.getByRole("region", { name: "The ten Aspirants, scrolls sideways" }),
    ).toBeVisible();
  });

  test("Esc skips to the finished page", async ({ page }) => {
    await page.goto(url("/character/"));
    test.skip(!(await hasWebGL2(page)), "no WebGL2 in this browser");
    await expect
      .poll(() => page.evaluate(() => window.__rosterIntro?.state), { timeout: 20_000 })
      .toBe("playing");
    await page.keyboard.press("Escape");
    await expect(page.locator(CANVAS)).toHaveCount(0, { timeout: 2_000 });
    await expect.poll(() => page.evaluate(() => window.__rosterIntro?.state)).toBe("ended");
  });

  test("a click on the canvas skips and does not open a panel under it", async ({ page }) => {
    await page.goto(url("/character/"));
    test.skip(!(await hasWebGL2(page)), "no WebGL2 in this browser");
    await expect
      .poll(() => page.evaluate(() => window.__rosterIntro?.state), { timeout: 20_000 })
      .toBe("playing");
    const view = page.viewportSize();
    await page.mouse.click((view?.width ?? 1000) * 0.6, (view?.height ?? 700) * 0.5);
    await expect(page.locator(CANVAS)).toHaveCount(0, { timeout: 2_000 });
    await page.waitForTimeout(500);
    expect(new URL(page.url()).pathname).toMatch(/\/character\/$/);
  });
});
