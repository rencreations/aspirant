import { expect, test } from "@playwright/test";

import { ROUTES, skipGate, url, watchErrors } from "./helpers";

for (const route of ROUTES) {
  test(`smoke ${route}: one h1, no console errors, no horizontal overflow`, async ({ page }) => {
    await skipGate(page);
    const errors = watchErrors(page);
    const response = await page.goto(url(route));
    expect(response?.status()).toBe(200);
    await page.waitForLoadState("networkidle");

    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.locator("main#main")).toHaveCount(1);

    const overflow = await page.evaluate(() => {
      const el = document.scrollingElement ?? document.documentElement;
      return el.scrollWidth - window.innerWidth;
    });
    expect(overflow).toBeLessThanOrEqual(0);

    // Every image URL resolves (checks asset() and the base path on real routes).
    const sources = await page.$$eval("img[src]", (imgs) =>
      Array.from(new Set(imgs.map((img) => (img as HTMLImageElement).src))),
    );
    for (const src of sources) {
      expect((await page.request.get(src)).ok(), src).toBe(true);
    }
    expect(errors).toEqual([]);
  });
}

test("unknown routes get the 404 page", async ({ page }) => {
  await skipGate(page);
  const response = await page.goto(url("/does-not-exist/"));
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1, name: "Signal lost" })).toBeVisible();
});

test("serves robots.txt, sitemap.xml and the web manifest", async ({ request }) => {
  expect((await request.get(url("/robots.txt"))).ok()).toBe(true);
  const sitemap = await request.get(url("/sitemap.xml"));
  expect(sitemap.ok()).toBe(true);
  const xml = await sitemap.text();
  expect(xml.match(/<loc>/g)?.length).toBe(15);
  expect((await request.get(url("/manifest.webmanifest"))).ok()).toBe(true);
});
