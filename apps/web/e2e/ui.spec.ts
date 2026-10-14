import { expect, test } from "@playwright/test";

test.describe("ui kit", () => {
  test("opens and closes the dialog with the keyboard", async ({ page }) => {
    await page.goto("/ui/");
    await page.getByRole("button", { name: "Open dialog" }).click();
    const dialog = page.getByRole("dialog", { name: "Accessible dialog" });
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("validates the contact form and submits it", async ({ page }) => {
    await page.goto("/ui/");
    const email = page.getByLabel("Email");
    await email.fill("not-an-email");
    await email.blur();
    await expect(page.getByRole("alert").first()).toContainText(/valid email/i);

    await page.getByLabel("Name").fill("Ada Lovelace");
    await email.fill("ada@example.com");
    await page.getByLabel("Message").fill("Hello from the end-to-end test.");
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByText(/Thanks Ada Lovelace/)).toBeVisible();
  });

  test("theme toggle switches to dark mode", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Toggle theme" }).click();
    await page.getByRole("menuitem", { name: "Dark" }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);
  });
});
