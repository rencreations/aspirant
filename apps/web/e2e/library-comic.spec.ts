import { expect, test, type Page } from "@playwright/test";

import { skipGate, url, watchErrors } from "./helpers";

/** The pictures come from the library origin, which a local run may not serve: ignore those loads. */
function realErrors(errors: string[]): string[] {
  return errors.filter((e) => !/Failed to load resource|net::ERR|ERR_/i.test(e));
}

async function open(page: Page, query = "") {
  await skipGate(page);
  await page.goto(url(`/collection/comic/${query}`));
  await expect(page.getByRole("heading", { level: 1, name: "Comic" })).toBeVisible();
}

test.describe("collection / comic", () => {
  test("the shelf shows the two official comics first and the fan comics under a plain label", async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await open(page);

    const official = page.getByRole("button", {
      name: /^Read (The Aspirant|Guinevere and Vexana)\./,
    });
    await expect(official).toHaveCount(2);
    await expect(page.getByRole("heading", { name: "Fan comics (not canon)" })).toBeVisible();

    // Official comics carry no fan badge. Every fan comic has the badge and a credit.
    const fanCards = page.locator("article").filter({ hasText: "Fan work" });
    const count = await fanCards.count();
    expect(count).toBeGreaterThanOrEqual(20);
    await expect(fanCards.first()).toContainText("on Instagram");
    await expect(page.getByText("View the original").first()).toBeVisible();

    expect(realErrors(errors)).toEqual([]);
  });

  test("opens a comic, shows its text beside the page, and closes with Escape", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const errors = watchErrors(page);
    await open(page);

    await page.getByRole("button", { name: /^Read The Aspirant\./ }).click();
    const reader = page.getByRole("dialog", { name: "Reading The Aspirant" });
    await expect(reader).toBeVisible();
    await expect(reader).toContainText("Page 1 of 42");
    await expect(page.getByRole("complementary", { name: /Transcript/ })).toContainText(
      "cyborgs appeared in our world",
    );
    await expect(page).toHaveURL(/[?&]i=comic-the-aspirant/);

    await page.keyboard.press("ArrowRight");
    await expect(reader).toContainText("Page 2 of 42");

    await page.keyboard.press("Escape");
    await expect(reader).toHaveCount(0);
    await expect(page).not.toHaveURL(/[?&]i=/);

    expect(realErrors(errors)).toEqual([]);
  });

  test("a link opens the reader on the page it names, and a missing page shows a notice", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, "?i=comic-guinevere-vexana&p=3");

    const reader = page.getByRole("dialog", { name: "Reading Guinevere and Vexana" });
    await expect(reader).toBeVisible();
    await expect(reader).toContainText("Pages 3, 23 and 40 are missing in the source");
    await expect(reader.getByText("This page is missing in the source.").first()).toBeVisible();
    await expect(reader).toContainText("Page 3 of 46");
  });

  test("a fan comic names its artist in the reader and keeps its credit on the shelf", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, "?i=comic-fan-czekpj-lqme");
    const reader = page.getByRole("dialog", { name: "Reading The phone" });
    await expect(reader).toBeVisible();
    await expect(reader).toContainText("Fan work");
    // A fan comic has no transcript, so there is no Text button.
    await expect(reader.getByRole("button", { name: "Text", exact: true })).toHaveCount(0);
  });

  test("on a phone the text is a drawer and nothing scrolls sideways", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page, "?i=comic-the-aspirant&p=1");
    const reader = page.getByRole("dialog", { name: "Reading The Aspirant" });
    await expect(reader).toBeVisible();

    const aside = page.getByRole("complementary", { name: /Transcript/ });
    await expect(aside).toBeHidden();
    await reader.getByRole("button", { name: "Text", exact: true }).click();
    await expect(aside).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
