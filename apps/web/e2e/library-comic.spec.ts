import { expect, test, type Page } from "@playwright/test";

import { skipGate, url, watchErrors } from "./helpers";

/**
 * The comic room and its pages. The room is a first screen, a screen for each official comic and a
 * wall of fan comics; every comic is a page of its own,
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
  test("opens on the big COMIC with one line of facts, one way back and a cue", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const errors = watchErrors(page);
    await openRoom(page);
    const hero = page.locator("#comic-top");
    await expect(hero.getByRole("img", { name: "COMIC" })).toBeVisible();
    await expect(hero.getByText("2 official comics")).toBeVisible();
    await expect(hero.getByText("21 made by fans")).toBeVisible();
    // One button back to the shelf, and no way to another room above the wall.
    await expect(page.getByRole("link", { name: "Collection" }).first()).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Rooms of the collection" })).toHaveCount(0);
    await expect(page.locator("header[data-overlay='nav']")).toHaveAttribute("data-bare", "true");

    // The cue scrolls to the first comic, one whole screen. The button breathes all the time, so it
    // is never still: press it without waiting for that, and again if the page was not ready yet.
    const cue = hero.getByRole("button", { name: "Scroll to read" });
    const top = () =>
      page.evaluate(() =>
        Math.round(document.getElementById("the-aspirant")?.getBoundingClientRect().top ?? 999),
      );
    await expect(async () => {
      await cue.click({ force: true });
      await expect.poll(top, { timeout: 2500 }).toBeLessThan(20);
    }).toPass({ timeout: 15_000 });
    expect(realErrors(errors)).toEqual([]);
  });

  test("each official comic has a whole screen and a button to its own page", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openRoom(page);
    const first = page.locator("#the-aspirant");
    const second = page.locator("#guinevere-and-vexana");
    await expect(first.getByRole("group", { name: "The Aspirant, the comic" })).toBeAttached();
    await expect(
      second.getByRole("group", { name: "Guinevere and Vexana, the comic" }),
    ).toBeAttached();
    // The Aspirant comes first, then Guinevere and Vexana, each a screen tall.
    const tops = await page.evaluate(() => [
      document.getElementById("the-aspirant")!.getBoundingClientRect().top,
      document.getElementById("guinevere-and-vexana")!.getBoundingClientRect().top,
    ]);
    expect(tops[0]).toBeLessThan(tops[1] ?? 0);
    const heights = await page.evaluate(() => [
      document.getElementById("the-aspirant")!.getBoundingClientRect().height,
      document.getElementById("guinevere-and-vexana")!.getBoundingClientRect().height,
    ]);
    for (const h of heights) expect(h).toBeGreaterThanOrEqual(880);
    await expect(first.getByRole("link", { name: /Read the comic/ })).toHaveAttribute(
      "href",
      /\/collection\/comic\/the-aspirant\/$/,
    );
    await expect(second.getByRole("link", { name: /Read the comic/ })).toHaveAttribute(
      "href",
      /\/collection\/comic\/guinevere-and-vexana\/$/,
    );
    // The middle panel of each is the first panel of its comic.
    await expect(first.locator("[data-part='first']")).toBeAttached();
    await expect(second.locator("[data-part='first']")).toBeAttached();
  });

  test("a part of a stage pops when it is pressed, and the button opens the comic", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openRoom(page);
    const stage = page.locator("#guinevere-and-vexana");
    await stage.scrollIntoViewIfNeeded();
    const part = stage.locator("[data-part='vexana'] > div > div");
    // A part drifts all the time, so it is never still: press it without waiting for that.
    await part.click({ force: true });
    await expect(part).toHaveAttribute("data-pop", "true");
    await stage.getByRole("link", { name: /Read the comic/ }).click({ force: true });
    await expect(page).toHaveURL(/\/collection\/comic\/guinevere-and-vexana\/$/);
  });

  test("the fan comics are a wall of links, and the foot has one button back", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const errors = watchErrors(page);
    await openRoom(page);
    const wall = page.locator("#fan-comics");
    await expect(wall.getByRole("heading", { name: "Fan comics" })).toBeAttached();
    const cards = wall.getByRole("link", { name: /^Read .*, a fan comic/ });
    expect(await cards.count()).toBe(21);
    await expect(cards.first()).toHaveAttribute("href", /\/collection\/comic\/[a-z0-9-]+\/$/);
    // Every fan comic names its credit and carries the fan badge.
    expect(await wall.getByText("Fan work").count()).toBeGreaterThanOrEqual(20);
    await expect(wall.getByText("View the original").first()).toBeAttached();
    // A choice narrows the wall.
    await wall.getByRole("button", { name: /^Obsidia/ }).click();
    await expect(wall.getByRole("status")).toContainText("1 of 21");

    // The top bar has its plate once the wall reaches it.
    await wall.scrollIntoViewIfNeeded();
    await page.evaluate(() => {
      const el = document.getElementById("fan-comics");
      if (el) window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY + 40);
    });
    await expect(page.locator("header[data-overlay='nav']")).not.toHaveAttribute(
      "data-bare",
      "true",
    );

    // The foot: a button back to the collection, and no next room.
    const foot = page.locator("footer");
    await expect(foot.getByRole("link", { name: /Back to the collection/ })).toBeVisible();
    await expect(foot.getByText(/Next room/)).toHaveCount(0);
    expect(realErrors(errors)).toEqual([]);
  });

  test("a comic opens at its own address, with the text off until it is asked for", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const errors = watchErrors(page);
    await openRoom(page);

    await page
      .locator("#the-aspirant")
      .getByRole("link", { name: /Read the comic/ })
      .click();
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
