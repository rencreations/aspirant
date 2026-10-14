import { expect, test } from "@playwright/test";

test.describe("data lab", () => {
  test("loads rows, filters by search and paginates", async ({ page }) => {
    await page.goto("/data/");
    const table = page.getByRole("table");
    await expect(table.getByRole("row")).toHaveCount(9); // header + 8 rows per page

    await page.getByLabel("Search by name").fill("zzzz-no-match");
    await expect(page.getByText("No results.")).toBeVisible();

    await page.getByLabel("Search by name").fill("");
    await expect(table.getByRole("row")).toHaveCount(9);

    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByText(/Page 2 of/)).toBeVisible();
  });

  test("sorting a column updates aria-sort", async ({ page }) => {
    await page.goto("/data/");
    const header = page.getByRole("columnheader", { name: /Name/ });
    await expect(page.getByRole("table")).toBeVisible();
    await header.getByRole("button").click();
    await expect(header).toHaveAttribute("aria-sort", "ascending");
    await header.getByRole("button").click();
    await expect(header).toHaveAttribute("aria-sort", "descending");
  });

  test("role filter toggles and the hotkey focuses search", async ({ page }) => {
    await page.goto("/data/");
    await expect(page.getByRole("table")).toBeVisible();

    const engineer = page.getByRole("button", { name: "Engineer" });
    await expect(engineer).toHaveAttribute("aria-pressed", "true");
    await engineer.click();
    await expect(engineer).toHaveAttribute("aria-pressed", "false");

    await page.keyboard.press("ControlOrMeta+k");
    await expect(page.getByLabel("Search by name")).toBeFocused();
  });

  test("virtualized list renders only a window of rows", async ({ page }) => {
    await page.goto("/data/");
    const list = page.getByRole("list", { name: "Virtualized people list" });
    await expect(list).toBeVisible();
    // Rows arrive after the simulated network request resolves.
    await expect(list.getByRole("listitem").first()).toBeVisible();
    const rendered = await list.getByRole("listitem").count();
    expect(rendered).toBeGreaterThan(0);
    expect(rendered).toBeLessThan(60);
  });
});
