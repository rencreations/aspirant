import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { ROUTES, skipGate, streamsVideo, url } from "./helpers";

async function seriousViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"])
    .analyze();
  return results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => ({ id: v.id, help: v.help, nodes: v.nodes.map((n) => n.target.join(" ")) }));
}

for (const route of ROUTES) {
  test(`no serious accessibility violations on ${route}`, async ({ page }) => {
    await skipGate(page);
    await page.goto(url(route));
    // Pages that stream video hold connections open, so the network never goes quiet there.
    if (streamsVideo(route)) {
      await page.waitForLoadState("load");
      await page.waitForTimeout(1500);
    } else await page.waitForLoadState("networkidle");
    if (route === "/collection/") {
      // The shelf fades its controls in once the covers have landed: scan the finished page.
      await page.waitForSelector("[data-entered='true']", { timeout: 60_000 });
      await page.waitForTimeout(1500);
    }
    const serious = await seriousViolations(page);
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
  });
}

// A document load of the home page runs its own opening: the plain cover, then the loading screen
// with the real bar, then the tap gate, then the intro. A fresh browser has not entered and has not
// switched the intros off (no `skipGate`), so these two tests look at it. The page behind it is
// inert the whole time.

test("no serious accessibility violations with the home loading screen up", async ({ page }) => {
  // The opening goes on by itself as soon as every file has arrived, so hold the pictures, the
  // models, the clips and the data back to look at the loading screen while it is up. If the home's
  // first list holds nothing from those folders the gate comes at once: the checks below hold in both.
  let release: () => void = () => undefined;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route(/\/(img|models|video|data)\//, async (route) => {
    await held;
    await route.continue().catch(() => undefined);
  });
  await page.goto(url("/"), { waitUntil: "commit" });
  // The plain cover goes once the loading screen has drawn its first frame.
  await expect(page.locator("html")).not.toHaveAttribute("data-gate", "on", { timeout: 30_000 });
  const bar = page.getByRole("progressbar", { name: "Loading the site" });
  await expect(bar).toBeVisible();
  await expect(bar).toHaveAttribute("aria-valuenow", /^\d+$/);
  await expect(page.locator("#site-shell")).toHaveJSProperty("inert", true);
  const serious = await seriousViolations(page);
  release();
  expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
});

test("no serious accessibility violations at the tap gate, and a press opens the page", async ({
  page,
}) => {
  await page.goto(url("/"), { waitUntil: "commit" });
  const gate = page.getByRole("button", { name: "Touch anywhere to continue" });
  await expect(gate).toBeVisible({ timeout: 60_000 });
  await expect(page.locator("#site-shell")).toHaveJSProperty("inert", true);
  const serious = await seriousViolations(page);
  expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
  // The gate stays up until the visitor presses: nothing lets it go by itself.
  await page.waitForTimeout(1500);
  await expect(gate).toBeVisible();
  await gate.click();
  await expect(page.locator("#site-shell")).toHaveJSProperty("inert", false, { timeout: 60_000 });
});
