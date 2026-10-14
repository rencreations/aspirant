import { expect, test } from "@playwright/test";

test.describe("home", () => {
  test("renders the hero and primary navigation", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Aspirant/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const nav = page.getByRole("navigation", { name: "Main" });
    await expect(nav.getByRole("link", { name: "UI kit" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Data lab" })).toBeVisible();
  });

  test("navigates to the UI kit and Data lab", async ({ page }) => {
    await page.goto("/");
    await page
      .getByRole("navigation", { name: "Main" })
      .getByRole("link", { name: "UI kit" })
      .click();
    await expect(page).toHaveURL(/\/ui\/?$/);
    await expect(page.getByRole("heading", { level: 1, name: "UI kit" })).toBeVisible();

    await page
      .getByRole("navigation", { name: "Main" })
      .getByRole("link", { name: "Data lab" })
      .click();
    await expect(page).toHaveURL(/\/data\/?$/);
    await expect(page.getByRole("heading", { level: 1, name: "Data lab" })).toBeVisible();
  });

  test("shows the 404 page for unknown routes", async ({ page }) => {
    const response = await page.goto("/does-not-exist/");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  });

  test("skip link targets the main landmark", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
  });

  test("serves robots.txt, sitemap.xml and the web manifest", async ({ request }) => {
    expect((await request.get("/robots.txt")).ok()).toBe(true);
    expect((await request.get("/sitemap.xml")).ok()).toBe(true);
    expect((await request.get("/manifest.webmanifest")).ok()).toBe(true);
  });
});
