import { expect, test, type Page } from "@playwright/test";

import { skipGate, url } from "./helpers";

/**
 * Design, the sheets room of Arts (`/collection/arts/design`): one sheet to a section on a quiet
 * plate, the name and notes beside it, a search, a filter by kind and by Aspirant, the zoom, an
 * index that follows the scroll, the sub-page buttons and the way back. The checks are about
 * structure and state (what stands in the page, the address, the sizes), not about the pictures
 * themselves: the files of the library may not be in the bucket the run reads from.
 */

test.describe.configure({ timeout: 120_000 });

const sections = (page: Page) => page.locator("[data-design-section]");
const sheets = (page: Page) => page.locator("[data-design-sheet]");
const count = (page: Page) => page.locator("[data-design-count]");
const chip = (page: Page, id: string) => page.locator(`[data-design-chip="${id}"]`);
const viewer = (page: Page) => page.locator("[data-zoom-viewer]");

interface Item {
  id: string;
  title: string;
  img: { w: number; h: number };
}

/** Console errors and uncaught exceptions. Files of the library origin belong to the pipeline. */
function watch(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const where = msg.location().url;
    if (where.includes("/library/v1/")) return;
    errors.push(`${msg.text()} ${where}`);
  });
  page.on("pageerror", (err) => errors.push(err.message));
  return errors;
}

async function open(page: Page, query = "") {
  await skipGate(page);
  const errors = watch(page);
  await page.goto(url(`/collection/arts/design/${query}`));
  await expect(sections(page).first()).toBeAttached({ timeout: 60_000 });
  return errors;
}

/** The sheets of the room, in order, read from its data file (next to the site's own address). */
async function data(page: Page): Promise<Item[]> {
  const base = test.info().project.use.baseURL ?? new URL(page.url()).origin + "/";
  const file = new URL("data/library/arts-design.json", base).toString();
  return page.evaluate(async (address) => {
    const res = await fetch(address);
    return ((await res.json()) as { items: Item[] }).items;
  }, file);
}

test("stands the 22 sheets, one to a section, with the chrome of the Arts rooms", async ({
  page,
}) => {
  const errors = await open(page);
  await expect(page.getByRole("heading", { level: 1, name: "Design" })).toBeVisible();
  await expect(sections(page)).toHaveCount(22);
  await expect(count(page)).toHaveText("22 sheets");
  // Every section has a name, its notes and one sheet.
  await expect(page.locator("[data-design-section] h2")).toHaveCount(22);
  await expect(sheets(page)).toHaveCount(22);
  // The first section names the first sheet and carries its number.
  await expect(sections(page).first().locator("h2")).toHaveText("Selena's mecha, design sheet");
  await expect(sections(page).first()).toContainText("No. 01");
  await expect(sections(page).first()).toContainText("of 22");
  // The sub-page buttons mark Design, the way back goes to the shelf's Arts cover, and the page
  // ends with the takedown line.
  await expect(page.locator("[data-arts-subnav] [aria-current='page']")).toHaveText("Design");
  await expect(page.locator("[data-room-back]")).toHaveAttribute(
    "href",
    /collection\/?\?open=arts/,
  );
  await expect(page.getByText("To ask for something to be taken down")).toBeAttached();
  expect(errors).toEqual([]);
});

test("never shows a sheet larger than its own pixels, and keeps its shape", async ({ page }) => {
  await open(page);
  const items = await data(page);
  const boxes = await sheets(page).evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect();
      return { w: r.width, h: r.height };
    }),
  );
  expect(boxes).toHaveLength(items.length);
  boxes.forEach((box, i) => {
    const item = items[i];
    if (!item) return;
    // Never above its own pixels (one pixel for rounding), never a sliver.
    expect(box.w, item.title).toBeLessThanOrEqual(item.img.w + 1);
    expect(box.w, item.title).toBeGreaterThan(120);
    // The shape of the picture, nothing stretched or cropped by the tile.
    expect(box.w / box.h, item.title).toBeCloseTo(item.img.w / item.img.h, 1);
  });
  // Nothing scrolls sideways.
  const over = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(over).toBeLessThanOrEqual(1);
});

test("the kind chips cut the sheets and follow the address", async ({ page }) => {
  await open(page);
  await chip(page, "kind:mecha").click();
  await expect(sections(page)).toHaveCount(6);
  await expect(count(page)).toHaveText("6 of 22 sheets");
  await expect(chip(page, "kind:mecha")).toHaveAttribute("aria-pressed", "true");
  await expect(chip(page, "all")).toHaveAttribute("aria-pressed", "false");
  expect(new URL(page.url()).searchParams.get("k")).toBe("mecha");
  // A press on the chip that is on turns it off.
  await chip(page, "kind:mecha").click();
  await expect(sections(page)).toHaveCount(22);
  expect(new URL(page.url()).searchParams.get("k")).toBeNull();
});

test("the Aspirant chips work with the kind chips", async ({ page }) => {
  await open(page);
  await chip(page, "who:change").click();
  await expect(sections(page)).toHaveCount(4);
  // The kind chips now count what they would show with Chang'e chosen.
  await expect(chip(page, "kind:weapon")).toContainText("2");
  await chip(page, "kind:weapon").click();
  await expect(sections(page)).toHaveCount(2);
  await expect(count(page)).toHaveText("2 of 22 sheets");
  // A chip that would show nothing is there but cannot be pressed.
  await expect(chip(page, "kind:droid")).toBeDisabled();
  await chip(page, "all").click();
  await expect(sections(page)).toHaveCount(22);
});

test("the search finds sheets and the empty answer can be cleared", async ({ page }) => {
  await open(page);
  const search = page.getByRole("searchbox", { name: "Search designs" });
  await search.fill("droid");
  await expect(sections(page)).toHaveCount(2);
  await expect(count(page)).toHaveText("2 of 22 sheets");
  await search.fill("zzzz nothing");
  await expect(sections(page)).toHaveCount(0);
  await expect(page.locator("[data-design-empty]")).toBeVisible();
  await page.locator("[data-design-empty]").getByRole("button", { name: "Clear" }).click();
  await expect(sections(page)).toHaveCount(22);
});

test("a press opens the whole sheet and Esc closes it", async ({ page }) => {
  await open(page);
  const items = await data(page);
  await sheets(page).first().scrollIntoViewIfNeeded();
  await sheets(page).first().click();
  await expect(viewer(page)).toBeVisible();
  expect(new URL(page.url()).searchParams.get("i")).toBe(items[0]?.id);
  await page.keyboard.press("Escape");
  await expect(viewer(page)).toHaveCount(0, { timeout: 10_000 });
  expect(new URL(page.url()).searchParams.get("i")).toBeNull();
});

test("a link with ?i= opens that sheet and the page stands on it", async ({ page }) => {
  await skipGate(page);
  await page.goto(url("/collection/arts/design/"));
  await expect(sections(page).first()).toBeAttached({ timeout: 60_000 });
  const items = await data(page);
  const target = items[15];
  expect(target).toBeDefined();
  await page.goto(url(`/collection/arts/design/?i=${target?.id ?? ""}`));
  await expect(viewer(page)).toBeVisible({ timeout: 60_000 });
  // A key pressed in the first milliseconds, before the viewer has put its listeners in, is lost.
  await expect(viewer(page)).toHaveAttribute("data-phase", "open", { timeout: 20_000 });
  await page.keyboard.press("Escape");
  await expect(viewer(page)).toHaveCount(0, { timeout: 10_000 });
  // The page behind has the sheet in view, so the viewer had a tile to land on.
  const tile = page.locator(`[data-zoom-id="${target?.id ?? ""}"]`);
  await expect(tile).toBeInViewport();
});

test("the index follows the scroll and a press glides to a sheet (laptops and wider)", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "the index is for wide screens");
  const viewport = page.viewportSize();
  test.skip((viewport?.width ?? 0) < 1100, "the index shows from 1100 px");
  await open(page);
  const rail = page.locator("[data-design-rail]");
  await expect(rail).toBeVisible();
  await expect(rail.getByRole("button")).toHaveCount(22);
  await expect(rail.locator("[aria-current='true']")).toHaveAttribute(
    "data-design-rail-id",
    /selena-mecha-sheet/,
  );
  const items = await data(page);
  const id = items[9]?.id ?? "";
  await rail.locator(`[data-design-rail-id="${id}"]`).click();
  // The sheet comes to the middle of the screen and the index marks it.
  await expect
    .poll(
      async () =>
        page.evaluate((target) => {
          const el = document.querySelector(`[data-design-section][data-id="${target}"]`);
          if (!el) return 9999;
          const r = el.getBoundingClientRect();
          return Math.abs(r.top + r.height / 2 - window.innerHeight / 2);
        }, id),
      { timeout: 8_000 },
    )
    .toBeLessThan(120);
  await expect(rail.locator("[aria-current='true']")).toHaveAttribute("data-design-rail-id", id);
});

test("the index is not on a phone", async ({ page, isMobile }) => {
  test.skip(!isMobile, "phone only");
  await open(page);
  await expect(page.locator("[data-design-rail]")).toBeHidden();
  // Nothing scrolls sideways and the filter rows slide instead of wrapping.
  const over = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(over).toBeLessThanOrEqual(1);
});
