import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { ROUTES, skipGate, url } from "./helpers";

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
    // Her pages hold video connections open, so the network never goes quiet there.
    if (route.startsWith("/character/selena/")) {
      await page.waitForLoadState("load");
      await page.waitForTimeout(1500);
    } else await page.waitForLoadState("networkidle");
    const serious = await seriousViolations(page);
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
  });
}

test("no serious accessibility violations with the loader gate up", async ({ page }) => {
  await page.goto(url("/"));
  await page.waitForLoadState("networkidle");
  await expect(page.locator("#site-shell")).toHaveJSProperty("inert", true);
  const serious = await seriousViolations(page);
  expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
});
