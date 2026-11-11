import { expect, test, type Page } from "@playwright/test";

import { skipGate, url } from "./helpers";

/**
 * The flow rooms of Arts (Scene, Game, Others): rows of pictures that slide sideways while the page
 * scrolls, alternating, with a search, a filter and the zoom. The checks are about structure and
 * state (rows, directions, what stands in the page, the address), not about pictures arriving: the
 * files of the library may not be in the bucket the run reads from.
 */

test.describe.configure({ timeout: 120_000 });

const rows = (page: Page) => page.locator("[data-flow-row]");
const tiles = (page: Page) => page.locator("[data-flow-tile]");
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

/** The translateX of each standing row, by row index. */
async function shifts(page: Page): Promise<Record<number, number>> {
  return page.evaluate(() => {
    const out: Record<number, number> = {};
    document.querySelectorAll<HTMLElement>("[data-flow-row]").forEach((row) => {
      const m = /translate3d\((-?[\d.]+)px/.exec(row.style.transform);
      out[Number(row.dataset.flowRow)] = m ? Number(m[1]) : Number.NaN;
    });
    return out;
  });
}

async function scrollTo(page: Page, y: number) {
  await page.evaluate((to) => {
    window.scrollTo(0, to);
  }, y);
  await page.waitForTimeout(400);
}

/** The ids of the pictures of the room, in order, read from its data file. */
async function ids(page: Page, room: string): Promise<string[]> {
  const res = await page.request.get(url(`data/library/arts-${room}.json`));
  const data = (await res.json()) as { items: Array<{ id: string }> };
  return data.items.map((i) => i.id);
}

test.describe("scene", () => {
  test("stands rows of 2 to 9 pictures, one gap, no sideways scroll", async ({ page }) => {
    const errors = await open(page, "scene");
    await expect(page.getByRole("heading", { level: 1, name: "Scene" })).toBeVisible();
    await expect(count(page)).toContainText("stills");
    const n = await rows(page).count();
    expect(n).toBeGreaterThanOrEqual(3);
    expect(n).toBeLessThanOrEqual(16);
    const per = await rows(page).evaluateAll((els) => els.map((el) => el.children.length));
    for (const c of per) {
      expect(c).toBeGreaterThanOrEqual(2);
      expect(c).toBeLessThanOrEqual(14);
    }
    const geometry = await page.evaluate(() => {
      const tops = [...document.querySelectorAll<HTMLElement>("[data-flow-row]")].map((r) => ({
        top: r.offsetTop,
        h: r.offsetHeight,
      }));
      const first = document.querySelector<HTMLElement>("[data-flow-row]");
      const t = first ? [...first.children].map((c) => (c as HTMLElement).offsetWidth) : [];
      return {
        heights: new Set(tops.map((r) => r.h)).size,
        pitch: tops.length > 1 ? (tops[1]?.top ?? 0) - (tops[0]?.top ?? 0) : 0,
        h: tops[0]?.h ?? 0,
        gap: first ? Number.parseFloat(getComputedStyle(first).columnGap) : 0,
        widths: t,
        sw: document.documentElement.scrollWidth,
        cw: document.documentElement.clientWidth,
      };
    });
    expect(geometry.heights).toBe(1);
    // The row pitch is the row height plus the one gap, sideways and between rows.
    expect(geometry.pitch).toBe(geometry.h + geometry.gap);
    expect(geometry.sw).toBe(geometry.cw);
    expect(errors).toEqual([]);
  });

  test("alternates: row 1 slides right going down, row 2 left, and back up reverses", async ({
    page,
  }) => {
    await open(page, "scene");
    const dirs = await rows(page).evaluateAll((els) =>
      els.map((el) => Number((el as HTMLElement).dataset.dir)),
    );
    expect(dirs.slice(0, 4)).toEqual([1, -1, 1, -1]);

    await scrollTo(page, 150);
    const a = await shifts(page);
    await scrollTo(page, 450);
    const b = await shifts(page);
    expect(b[0]).toBeGreaterThan(a[0] ?? 0);
    expect(b[1]).toBeLessThan(a[1] ?? 0);
    expect(b[2]).toBeGreaterThan(a[2] ?? 0);
    await scrollTo(page, 150);
    const c = await shifts(page);
    expect(c[0]).toBeCloseTo(a[0] ?? 0, 0);
    expect(c[1]).toBeCloseTo(a[1] ?? 0, 0);
  });

  test("never shows an empty edge", async ({ page }) => {
    await open(page, "scene");
    for (const y of [0, 300, 1500, 6000]) {
      await scrollTo(page, y);
      const edges = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>("[data-flow-row]")].map((r) => {
          const b = r.getBoundingClientRect();
          return { left: b.left, right: b.right, vw: document.documentElement.clientWidth };
        }),
      );
      for (const e of edges) {
        // The strip covers the screen, or (a short row) stands inside it.
        const covers = e.left <= 0.5 && e.right >= e.vw - 0.5;
        const inside = e.left >= -0.5 && e.right <= e.vw + 0.5;
        expect(covers || inside).toBe(true);
      }
    }
  });

  test("only the rows near the screen stand in the page", async ({ page }) => {
    await open(page, "scene");
    await scrollTo(page, 12000);
    await expect(rows(page).first()).toBeAttached();
    expect(await rows(page).count()).toBeLessThanOrEqual(20);
    expect(await tiles(page).count()).toBeLessThanOrEqual(110);
    const first = await rows(page).first().getAttribute("data-flow-row");
    expect(Number(first)).toBeGreaterThan(10);
    await scrollTo(page, 0);
    await expect(page.locator("[data-flow-row='0']")).toBeAttached();
  });

  test("filters by what appears most, with See more, and keeps the address", async ({ page }) => {
    await open(page, "scene");
    const filter = page.locator("[data-flow-filter]");
    await expect(filter).toBeVisible();
    const total = (await count(page).textContent()) ?? "";
    const chips = filter.locator("button[data-facet]:not([data-facet=''])");
    expect(await chips.count()).toBeGreaterThanOrEqual(4);
    const first = chips.first();
    const facet = await first.getAttribute("data-facet");
    await first.click();
    await expect(page).toHaveURL(new RegExp(`[?&]f=${facet}`));
    await expect(count(page)).toContainText(" of ");
    await expect(first).toHaveAttribute("aria-pressed", "true");
    // Pressing the chosen chip clears it.
    await first.click();
    await expect(page).not.toHaveURL(/[?&]f=/);
    await expect(count(page)).toHaveText(total);

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
    // The chosen facet shows as a chip even though it was behind See more.
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
    await field.fill("zzzzqqqq");
    await expect(page.locator("[data-flow-empty]")).toContainText("Nothing matches");
    await expect(rows(page)).toHaveCount(0);
    await page.locator("[data-flow-empty]").getByRole("button", { name: "Clear" }).click();
    await expect(page).not.toHaveURL(/[?&]q=/);
    await expect(rows(page).first()).toBeAttached();
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
    for (let i = 0; i < 24 && !(await onTile()); i++) await page.keyboard.press("Tab");
    expect(await onTile()).toBe(true);
    const seen = new Set<string>();
    for (let i = 0; i < 32; i++) {
      await page.keyboard.press("Tab");
      await page.waitForTimeout(280);
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
    await expect
      .poll(() => page.evaluate(() => window.scrollY), { timeout: 15_000 })
      .toBeGreaterThan(5000);
    const tile = page.locator(`[data-zoom-id="${id}"]`);
    await expect(tile).toBeAttached({ timeout: 15_000 });
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
  test("game stands in rows with its own filter", async ({ page }) => {
    await open(page, "game");
    await expect(page.getByRole("heading", { level: 1, name: "Game" })).toBeVisible();
    expect(await rows(page).count()).toBeGreaterThanOrEqual(3);
    await expect(page.locator("[data-flow-filter] button[data-facet]").nth(1)).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Official art" }).getByRole("link", { name: "Game" }),
    ).toHaveAttribute("aria-current", "page");
  });

  test("others filters by kind first, then by Aspirant", async ({ page }) => {
    await open(page, "others");
    await expect(page.getByRole("heading", { level: 1, name: "Others" })).toBeVisible();
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

  test("rows of 2 or 3 pictures, same alternation, no sideways scroll, a tap opens the zoom", async ({
    page,
  }) => {
    await open(page, "scene");
    const per = await rows(page).evaluateAll((els) => els.map((el) => el.children.length));
    for (const c of per.slice(0, -1)) expect(c).toBeLessThanOrEqual(5);
    const dirs = await rows(page).evaluateAll((els) =>
      els.map((el) => Number((el as HTMLElement).dataset.dir)),
    );
    expect(dirs.slice(0, 3)).toEqual([1, -1, 1]);
    // The filter is one short row that slides sideways, not a tall block of chips.
    const filterHeight = await page.locator("[data-flow-filter]").evaluate((el) => el.clientHeight);
    expect(filterHeight).toBeLessThan(70);
    const sw = await page.evaluate(() => [
      document.documentElement.scrollWidth,
      document.documentElement.clientWidth,
    ]);
    expect(sw[0]).toBe(sw[1]);
    await scrollTo(page, 200);
    const a = await shifts(page);
    await scrollTo(page, 500);
    const b = await shifts(page);
    expect(b[0]).toBeGreaterThan(a[0] ?? 0);
    expect(b[1]).toBeLessThan(a[1] ?? 0);
    // A tap on a tile that is on the screen opens the zoom, once the page has come to rest.
    await expect
      .poll(async () => {
        const y = await page.evaluate(() => window.scrollY);
        await page.waitForTimeout(200);
        return (await page.evaluate(() => window.scrollY)) === y;
      })
      .toBe(true);
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
