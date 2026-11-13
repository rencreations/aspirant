import { expect, test, type Page } from "@playwright/test";

import { skipGate, url, watchErrors } from "./helpers";

/**
 * The comic room and its pages. The room is a shelf; every comic is a page of its own,
 * `/collection/comic/<slug>/`. The reader shows its top bar and control bar at the very top only,
 * and folds both into one button the moment the pages move.
 */

/** The pictures come from the library origin, which a local run may not serve: ignore those loads. */
function realErrors(errors: string[]): string[] {
  return errors.filter((e) => !/Failed to load resource|net::ERR|ERR_/i.test(e));
}

async function openRoom(page: Page, query = "") {
  await skipGate(page);
  await page.goto(url(`/collection/comic/${query}`));
  await expect(page.getByRole("heading", { level: 1, name: "Comic" })).toBeVisible();
}

async function openComic(page: Page, slug: string, query = "") {
  await skipGate(page);
  await page.goto(url(`/collection/comic/${slug}/${query}`));
  await expect(page.locator("[data-comic-bar]")).toBeAttached();
}

const scroller = (page: Page) => page.getByRole("region", { name: /, pages$/ });

/** Move the strip, as a reader's wheel would. */
async function scrollTo(page: Page, top: number) {
  await scroller(page).evaluate((el, y) => {
    el.scrollTop = y;
  }, top);
}

test.describe("collection / comic", () => {
  test("the shelf shows the two official comics first and the fan comics under a plain label", async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await openRoom(page);

    // Each comic is a link to its own page.
    const official = page.getByRole("link", {
      name: /^Read (The Aspirant|Guinevere and Vexana)\./,
    });
    await expect(official).toHaveCount(2);
    await expect(official.first()).toHaveAttribute("href", /\/collection\/comic\/the-aspirant\/$/);
    await expect(page.getByRole("heading", { name: "Fan comics (not canon)" })).toBeVisible();

    // Official comics carry no fan badge. Every fan comic has the badge and a credit.
    const fanCards = page.locator("article").filter({ hasText: "Fan work" });
    expect(await fanCards.count()).toBeGreaterThanOrEqual(20);
    await expect(fanCards.first()).toContainText("on Instagram");
    await expect(page.getByText("View the original").first()).toBeVisible();

    expect(realErrors(errors)).toEqual([]);
  });

  test("a comic opens at its own address, with the text off until it is asked for", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const errors = watchErrors(page);
    await openRoom(page);

    await page.getByRole("link", { name: /^Read The Aspirant\./ }).click();
    await expect(page).toHaveURL(/\/collection\/comic\/the-aspirant\/$/);
    const bar = page.locator("[data-comic-bar]");
    await expect(bar).toContainText("Page 1 of 42");
    await expect(page.getByRole("heading", { level: 1, name: "The Aspirant" })).toBeAttached();

    // The text is off by default; the switch turns it on.
    await expect(page.getByRole("complementary", { name: /Transcript/ })).toBeHidden();
    await bar.getByRole("switch", { name: "Text" }).click();
    await expect(page.getByRole("complementary", { name: /Transcript/ })).toContainText(
      "cyborgs appeared in our world",
    );

    await page.keyboard.press("ArrowRight");
    await expect(bar).toContainText("Page 2 of 42");
    expect(realErrors(errors)).toEqual([]);
  });

  test("the bars show at the very top only and fold into one button that opens a list", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openComic(page, "the-aspirant");
    const nav = page.locator("header[data-overlay='nav']");
    const bar = page.locator("[data-comic-bar]");
    const fold = page.getByRole("button", { name: "Reader controls" });

    // At the top: both bars are there, the top bar is dark like the page, and the button is not.
    await expect(nav).not.toHaveAttribute("data-away", "true");
    await expect(bar).not.toHaveAttribute("data-away", "true");
    await expect(nav).toHaveAttribute("data-theme", "storm");
    await expect(fold).not.toHaveAttribute("data-in", "true");
    // No fit, page or comic arrows, and no full size button in the bar.
    await expect(page.getByRole("button", { name: /Fit width|Fit height/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Previous page|Next page/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^(Previous|Next) comic/ })).toHaveCount(0);

    await scrollTo(page, 900);
    await expect(nav).toHaveAttribute("data-away", "true");
    await expect(bar).toHaveAttribute("data-away", "true");
    await expect(fold).toHaveAttribute("data-in", "true");

    // The list: the title, the way back, the page to go to and the text switch (off).
    await fold.click();
    const list = page.getByRole("dialog");
    await expect(list.getByText("The Aspirant", { exact: true })).toBeVisible();
    await expect(list.getByRole("link", { name: "Back to the shelf" })).toBeVisible();
    await expect(list.getByRole("switch", { name: "Text" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
    const field = list.getByRole("textbox", { name: /Go to page/ });
    await field.fill("12");
    await field.press("Enter");
    await expect(list).toHaveCount(0);
    await expect(async () => {
      expect(await page.evaluate(() => new URL(location.href).searchParams.get("p"))).toBe("12");
    }).toPass({ timeout: 5000 });

    // Back at the very top they unfold.
    await scrollTo(page, 0);
    await expect(nav).not.toHaveAttribute("data-away", "true");
    await expect(bar).not.toHaveAttribute("data-away", "true");
  });

  test("the end of a comic has the comics before and after it, and a zoom is in the corner", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openComic(page, "guinevere-and-vexana");
    await scrollTo(page, 999999);
    const prev = page.getByRole("link", { name: /^Previous comic, The Aspirant/ });
    const next = page.getByRole("link", { name: /^Next comic, / });
    await expect(prev).toBeVisible();
    await expect(prev).toHaveAttribute("href", /\/collection\/comic\/the-aspirant\/$/);
    await expect(next).toBeVisible();
    await expect(prev.locator("img")).toBeVisible();

    const group = page.getByRole("group", { name: "Zoom" });
    await expect(group).toContainText("100%");
    await group.getByRole("button", { name: "Zoom in" }).click();
    await expect(group).toContainText("120%");
    await group.getByRole("button", { name: "Zoom out" }).click();
    await group.getByRole("button", { name: "Zoom out" }).click();
    await expect(group).toContainText("80%");
  });

  test("a link opens the reader on the page it names, and a missing page shows a notice", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openComic(page, "guinevere-and-vexana", "?p=3");
    const main = page.getByRole("main", { name: "Reading Guinevere and Vexana" });
    await expect(main).toContainText("Pages 3, 23 and 40 are missing in the source");
    await expect(main.getByText("This page is missing in the source.").first()).toBeVisible();
    await expect(page.locator("[data-comic-bar]")).toContainText("Page 3 of 46");
  });

  test("an old ?i= link goes to the page of the comic", async ({ page }) => {
    await skipGate(page);
    await page.goto(url("/collection/comic/?i=comic-guinevere-vexana&p=3"));
    await expect(page).toHaveURL(/\/collection\/comic\/guinevere-and-vexana\/\?p=3$/);
    await expect(page.locator("[data-comic-bar]")).toContainText("Page 3 of 46");
  });

  test("a fan comic names its credit, has no text switch and a takedown link at its end", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openComic(page, "the-phone");
    const bar = page.locator("[data-comic-bar]");
    await expect(bar).toContainText("Fan work");
    await expect(bar.getByRole("switch", { name: "Text" })).toHaveCount(0);
    await scrollTo(page, 999999);
    await expect(page.getByRole("link", { name: /Copyright or takedown/ })).toBeVisible();
  });

  test("a comic that does not exist has no page", async ({ page }) => {
    await skipGate(page);
    const res = await page.goto(url("/collection/comic/not-a-comic/"));
    expect(res?.status()).toBe(404);
  });

  test("on a phone the text is a drawer and nothing scrolls sideways", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openComic(page, "the-aspirant");
    const aside = page.getByRole("complementary", { name: /Transcript/ });
    await expect(aside).toBeHidden();
    await page.locator("[data-comic-bar]").getByRole("switch", { name: "Text" }).click();
    await expect(aside).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
