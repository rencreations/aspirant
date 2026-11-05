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

test("no serious accessibility violations with the loader gate up", async ({ page }) => {
  // The gate opens by itself as soon as every file has arrived, so hold one picture of the first
  // screen back to look at the gate while it is up.
  let release: () => void = () => undefined;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route("**/img/portal/vexana/depth.webp", async (route) => {
    await held;
    await route.continue().catch(() => undefined);
  });
  await page.goto(url("/"), { waitUntil: "commit" });
  await expect(page.locator("#site-shell")).toHaveJSProperty("inert", true);
  const serious = await seriousViolations(page);
  release();
  expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
});
