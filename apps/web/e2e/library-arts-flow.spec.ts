import { expect, test, type Page } from "@playwright/test";

import { skipGate, url } from "./helpers";

/**
 * The wall rooms of Arts (Scene, Game, Others): every picture in rows that fill the page's width
 * and stand still, in groups under small headings (the Aspirants), with a search, a filter and the
 * zoom. The checks are about structure and state (rows, groups, that nothing moves with the
 * scroll, the address), not about pictures arriving: the files of the library may not be in the
 * bucket the run reads from.
 */

test.describe.configure({ timeout: 120_000 });

const rows = (page: Page) => page.locator("[data-flow-row]");
const tiles = (page: Page) => page.locator("[data-flow-tile]");
const parts = (page: Page) => page.locator("[data-flow-part]");
const count = (page: Page) => page.locator("[data-flow-count]");

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

async function open(page: Page, room: string, query = "") {
  await skipGate(page);
  const errors = watch(page);
  await page.goto(url(`/collection/arts/${room}/${query}`));
  await expect(rows(page).first()).toBeAttached({ timeout: 60_000 });
  return errors;
}

async function scrollTo(page: Page, y: number) {
  await page.evaluate((to) => {
    window.scrollTo(0, to);
  }, y);
  await page.waitForTimeout(300);
}

/** The ids of the pictures of the room, in order, read from its data file. */
async function ids(page: Page, room: string): Promise<string[]> {
  const res = await page.request.get(url(`data/library/arts-${room}.json`));
  const data = (await res.json()) as { items: Array<{ id: string }> };
  return data.items.map((i) => i.id);
}

test.describe("scene", () => {
  test("stands every picture once, in rows that fill the width, with no sideways scroll", async ({
    page,
  }) => {
    const errors = await open(page, "scene");
    await expect(page.getByRole("heading", { level: 1, name: "Scene" })).toBeVisible();
    await expect(count(page)).toContainText("stills");

    const all = await ids(page, "scene");
    expect(await tiles(page).count()).toBe(all.length);
    const standing = await tiles(page).evaluateAll((els) =>
      els.map((el) => (el as HTMLElement).dataset.id ?? ""),
    );
    expect(new Set(standing).size).toBe(all.length);

    const geometry = await page.evaluate(() => {
      const out: Array<{ w: number; box: number; n: number; last: boolean; h: number }> = [];
      for (const section of document.querySelectorAll<HTMLElement>("[data-flow-part]")) {
        const list = [...section.querySelectorAll<HTMLElement>("[data-flow-row]")];
        list.forEach((row, i) => {
          const gap = Number.parseFloat(getComputedStyle(row).columnGap);
          const used =
            [...row.children].reduce((n, c) => n + (c as HTMLElement).offsetWidth, 0) +
            gap * (row.children.length - 1);
          out.push({
            w: used,
            box: row.parentElement?.clientWidth ?? 0,
            n: row.children.length,
            last: i === list.length - 1,
            h: row.offsetHeight,
          });
        });
      }
      return {
        rows: out,
        sw: document.documentElement.scrollWidth,
        cw: document.documentElement.clientWidth,
      };
    });
    expect(geometry.rows.length).toBeGreaterThan(40);
    // Every row but the last of a group fills the width to the pixel.
    for (const row of geometry.rows.filter((r) => !r.last)) {
      expect(Math.abs(row.w - row.box), `a row of ${row.n}`).toBeLessThanOrEqual(1);
    }
    for (const row of geometry.rows) {
      expect(row.w).toBeLessThanOrEqual(row.box + 1);
      expect(row.n).toBeGreaterThanOrEqual(1);
      expect(row.h).toBeGreaterThan(40);
    }
    expect(geometry.sw).toBe(geometry.cw);
    expect(errors).toEqual([]);
  });

  test("groups the pictures by Aspirant, a pair after its two, under small headings", async ({
    page,
  }) => {
    await open(page, "scene");
    const names = await parts(page).evaluateAll((els) =>
      els.map((el) => el.querySelector("h2")?.textContent ?? ""),
    );
    expect(names.slice(0, 6)).toEqual([
      "Fanny",
      "Layla",
      "Fanny and Layla",
      "Ruby",
      "Angela",
      "Ruby and Angela",
    ]);
    expect(names.at(-1)).toBe("The world");
    // A heading names its group and nothing else: no count, no caption.
    const first = parts(page).first();
    await expect(first.locator("h2")).toHaveText("Fanny");
    expect((await first.locator("header").innerText()).trim()).toBe("Fanny");
    // Under a heading stand its own pictures: the first group's tiles are all inside its section.
    expect(await first.locator("[data-flow-tile]").count()).toBeGreaterThan(3);
  });

  test("stands still: nothing moves with the scroll", async ({ page }) => {
    await open(page, "scene");
    const still = await page.evaluate(() => {
      const moving = [
        ...document.querySelectorAll<HTMLElement>("[data-flow-row], [data-flow-tile]"),
      ].filter(
        (el) => el.style.transform !== "" || getComputedStyle(el).transform !== "none",
      ).length;
      return moving;
    });
    expect(still).toBe(0);

    // A tile keeps its place on the page while the page scrolls.
    const place = () =>
      page.evaluate(() => {
        const tile = document.querySelectorAll<HTMLElement>("[data-flow-tile]")[12];
        const r = tile?.getBoundingClientRect();
        return r ? { x: Math.round(r.left), y: Math.round(r.top + window.scrollY) } : null;
      });
    const before = await place();
    await scrollTo(page, 700);
    await scrollTo(page, 2400);
    await scrollTo(page, 0);
    expect(await place()).toEqual(before);
  });

  test("filters by Aspirant first, then by place, with See more, and keeps the address", async ({
    page,
  }) => {
    await open(page, "scene");
    const filter = page.locator("[data-flow-filter]");
    await expect(filter).toBeVisible();
    const total = (await count(page).textContent()) ?? "";
    const chips = filter.locator("button[data-facet]:not([data-facet=''])");
    // The ten Aspirants lead, in the order of the pairs, so a visitor finds hers in the same place in every room.
    const lead = await chips.evaluateAll((els) =>
      els.slice(0, 10).map((el) => (el as HTMLElement).dataset.facet),
    );
    expect(lead).toEqual([
      "fanny",
      "layla",
      "ruby",
      "angela",
      "lesley",
      "change",
      "guinevere",
      "vexana",
      "selena",
      "obsidia",
    ]);

    const ruby = filter.locator("button[data-facet='ruby']");
    await ruby.click();
    await expect(page).toHaveURL(/[?&]f=ruby/);
    await expect(count(page)).toContainText(" of ");
    await expect(ruby).toHaveAttribute("aria-pressed", "true");
    // A filtered result is one wall, with no headings, and holds every picture she is in.
    await expect(parts(page)).toHaveCount(0);
    await expect(rows(page).first()).toBeAttached();
    // Pressing the chosen chip clears it, and the groups come back.
    await ruby.click();
    await expect(page).not.toHaveURL(/[?&]f=/);
    await expect(count(page)).toHaveText(total);
    await expect(parts(page).first()).toBeAttached();

    // See more opens the rest of the filter in a sheet, and a pick closes it.
    const more = page.locator("[data-flow-more]");
    await more.click();
    const sheet = page.locator("[data-flow-sheet]");
    await expect(sheet).toBeVisible();
    const inSheet = sheet.locator("button[data-facet]").first();
    const picked = await inSheet.getAttribute("data-facet");
    await inSheet.click();
    await expect(sheet).toBeHidden();
    await expect(page).toHaveURL(new RegExp(`[?&]f=${encodeURIComponent(picked ?? "")}`));
    await expect(filter.locator(`button[data-facet="${picked}"]`)).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  test("searches, says so plainly when nothing matches, and clears", async ({ page }) => {
    await open(page, "scene");
    const field = page.getByRole("searchbox");
    await field.fill("angela");
    await expect(page).toHaveURL(/[?&]q=angela/);
    await expect(count(page)).toContainText(" of ");
    // A search is one wall of what it found, with no headings.
    await expect(parts(page)).toHaveCount(0);
    await field.fill("zzzzqqqq");
    await expect(page.locator("[data-flow-empty]")).toContainText("Nothing matches");
    await expect(rows(page)).toHaveCount(0);
    await page.locator("[data-flow-empty]").getByRole("button", { name: "Clear" }).click();
    await expect(page).not.toHaveURL(/[?&]q=/);
    await expect(rows(page).first()).toBeAttached();
    await expect(parts(page).first()).toBeAttached();
  });

  test("a filter in the address is what the page shows", async ({ page }) => {
    await skipGate(page);
    await page.goto(url("/collection/arts/scene/"));
    await expect(rows(page).first()).toBeAttached({ timeout: 60_000 });
    const res = await page.request.get(url("data/library/arts-scene.json"));
    const data = (await res.json()) as { facets?: Array<{ id: string }> };
    const facet = data.facets?.[0]?.id;
    if (!facet) throw new Error("the data file lists no facet");
    await page.goto(url(`/collection/arts/scene/?f=${facet}`));
    await expect(count(page)).toContainText(" of ", { timeout: 30_000 });
    await expect(page.locator(`button[data-facet="${facet}"]`)).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  test("the keyboard moves through the pictures and the focus stays on them", async ({ page }) => {
    await open(page, "scene");
    await page.getByRole("searchbox").focus();
    const onTile = () => page.evaluate(() => !!document.activeElement?.closest("[data-flow-tile]"));
    for (let i = 0; i < 30 && !(await onTile()); i++) await page.keyboard.press("Tab");
    expect(await onTile()).toBe(true);
    const seen = new Set<string>();
    for (let i = 0; i < 32; i++) {
      await page.keyboard.press("Tab");
      await page.waitForTimeout(120);
      const s = await page.evaluate(() => {
        const el = document.activeElement;
        const tile = el?.closest<HTMLElement>("[data-flow-tile]");
        if (!tile) return { tile: false, what: `${el?.tagName ?? "none"} ${el?.className ?? ""}` };
        const r = tile.getBoundingClientRect();
        const w = Math.max(0, Math.min(r.right, innerWidth) - Math.max(r.left, 0));
        const h = Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0));
        return {
          tile: true,
          id: tile.dataset.id ?? "",
          share: (w * h) / (r.width * r.height),
          outline: getComputedStyle(tile).outlineColor,
        };
      });
      expect(s.tile, `Tab ${i}: the focus left the pictures for ${"what" in s ? s.what : ""}`).toBe(
        true,
      );
      if (!("id" in s)) continue;
      // It is on the screen (at least partly), and the zoom's focus outline shows.
      expect(s.share).toBeGreaterThan(0.3);
      expect(s.outline).not.toBe("rgba(0, 0, 0, 0)");
      seen.add(s.id ?? "");
    }
    expect(seen.size).toBeGreaterThanOrEqual(30);
  });

  test("a deep link scrolls to the picture and a press on a tile opens the zoom", async ({
    page,
  }) => {
    await skipGate(page);
    await page.goto(url("/collection/arts/scene/"));
    await expect(rows(page).first()).toBeAttached({ timeout: 60_000 });
    const all = await ids(page, "scene");
    const id = all[Math.floor(all.length * 0.55)];
    if (!id) throw new Error("no pictures");

    await page.goto(url(`/collection/arts/scene/?i=${id}`));
    await expect(rows(page).first()).toBeAttached({ timeout: 60_000 });
    const tile = page.locator(`[data-zoom-id="${id}"]`);
    await expect(tile).toBeAttached({ timeout: 15_000 });
    // The page came down to it: the picture is on the screen.
    await expect
      .poll(
        () =>
          tile.evaluate((el) => {
            const r = el.getBoundingClientRect();
            return r.bottom > 0 && r.top < window.innerHeight;
          }),
        { timeout: 15_000 },
      )
      .toBe(true);
    await expect(page).toHaveURL(new RegExp(`[?&]i=${id}`));

    // A press on a tile adds the picture to the address, and Esc takes it away.
    await page.goto(url("/collection/arts/scene/"));
    await expect(tiles(page).first()).toBeAttached({ timeout: 60_000 });
    await page.waitForTimeout(600);
    const target = tiles(page).nth(1);
    const open = await target.getAttribute("data-id");
    await target.click({ force: true });
    await expect(page).toHaveURL(new RegExp(`[?&]i=${open}`));
    await page.keyboard.press("Escape");
    await expect(page).not.toHaveURL(/[?&]i=/, { timeout: 10_000 });
  });

  test("has the sub-page buttons, the way back and the takedown line", async ({ page }) => {
    await open(page, "scene");
    const nav = page.getByRole("navigation", { name: "Official art" });
    await expect(nav.getByRole("link")).toHaveCount(6);
    await expect(nav.getByRole("link", { name: "Scene" })).toHaveAttribute("aria-current", "page");
    await expect(page.locator("[data-room-back]")).toHaveAttribute(
      "href",
      /collection\/?\?open=arts/,
    );
    await scrollTo(page, 1_000_000);
    await expect(page.getByText("To ask for something to be taken down")).toBeVisible();
  });
});

test.describe("game and others", () => {
  test("game stands in groups with its own filter", async ({ page }) => {
    await open(page, "game");
    await expect(page.getByRole("heading", { level: 1, name: "Game" })).toBeVisible();
    expect(await rows(page).count()).toBeGreaterThanOrEqual(3);
    await expect(parts(page).first().locator("h2")).toHaveText("Fanny");
    await expect(page.locator("[data-flow-filter] button[data-facet]").nth(1)).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Official art" }).getByRole("link", { name: "Game" }),
    ).toHaveAttribute("aria-current", "page");
  });

  test("others is grouped by Aspirant and filters by kind first, then by Aspirant", async ({
    page,
  }) => {
    await open(page, "others");
    await expect(page.getByRole("heading", { level: 1, name: "Others" })).toBeVisible();
    await expect(parts(page).first().locator("h2")).toHaveText("Fanny");
    const chips = page.locator("[data-flow-filter] button[data-facet]:not([data-facet=''])");
    const first = await chips.first().getAttribute("data-facet");
    expect(first).toMatch(/^kind:/);
    await chips.first().click();
    await expect(page).toHaveURL(/[?&]f=kind/);
    await expect(count(page)).toContainText(" of ");
  });
});

test.describe("on a phone", () => {
  test.skip(({ viewport }) => (viewport?.width ?? 1000) > 600, "Phone project only.");

  test("rows of 2 or 3 pictures, no sideways scroll, a tap opens the zoom", async ({ page }) => {
    await open(page, "scene");
    const per = await rows(page).evaluateAll((els) => els.map((el) => el.children.length));
    // Two wide pictures or three squares to a row: more than a picture a row, never a crowd.
    const crowded = per.filter((c) => c > 4).length;
    expect(crowded).toBe(0);
    expect(per.filter((c) => c >= 2).length).toBeGreaterThan(per.length / 2);
    // The filter is one short row that slides sideways, not a tall block of chips.
    const filterHeight = await page.locator("[data-flow-filter]").evaluate((el) => el.clientHeight);
    expect(filterHeight).toBeLessThan(70);
    const sw = await page.evaluate(() => [
      document.documentElement.scrollWidth,
      document.documentElement.clientWidth,
    ]);
    expect(sw[0]).toBe(sw[1]);
    // A tap on a tile that is on the screen opens the zoom.
    await scrollTo(page, 600);
    const point = await page.evaluate(() => {
      for (const t of document.querySelectorAll<HTMLElement>("[data-flow-tile]")) {
        const r = t.getBoundingClientRect();
        const x = r.left + r.width / 2;
        const y = r.top + r.height / 2;
        if (x > 20 && x < innerWidth - 20 && y > 160 && y < innerHeight - 120) {
          return { id: t.dataset.id ?? "", x, y };
        }
      }
      return null;
    });
    if (!point) throw new Error("no tile on the screen");
    await page.touchscreen.tap(point.x, point.y);
    await expect(page).toHaveURL(new RegExp(`[?&]i=${point.id}`));
  });
});
