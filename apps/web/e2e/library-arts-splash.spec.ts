import { expect, test, type Page } from "@playwright/test";

import { skipGate, url, watchErrors } from "./helpers";

/**
 * Splash art (`/collection/arts`), after east64films.com: one fixed screen, a stack of windows, a
 * title list across the middle, a caption, and the zoom. The checks are about structure and state
 * (the list in the HTML, the loop, the steps, the keys, the address, the zoom, the corners), read
 * through the probe `window.__splashStage` and the attributes of the stage. They need the pictures
 * of the first screen to have arrived, which they do when the library files are in the bucket the
 * run reads from (or in the local mirror, `NEXT_PUBLIC_LIBRARY_ORIGIN`).
 */

test.describe.configure({ timeout: 120_000 });

const STAGE = '[role="region"][aria-label="Splash art"]';
const DIALOG = "[role='dialog'][data-zoom-viewer]";
const ROUTE = "/collection/arts/";

async function open(page: Page, query = "") {
  await skipGate(page);
  const errors = watchErrors(page);
  await page.goto(url(`${ROUTE}${query}`));
  await expect(page.locator(STAGE)).toBeAttached({ timeout: 60_000 });
  await expect(page.locator(STAGE)).toHaveAttribute("data-stage", "rest", { timeout: 90_000 });
  return errors;
}

const snap = (page: Page) => page.evaluate(() => window.__splashStage?.snapshot());

/** Wait for the stage to come to rest (the frame loop has stopped). */
async function settle(page: Page) {
  await expect
    .poll(async () => (await snap(page))?.running, { timeout: 8000, intervals: [100] })
    .toBe(false);
}

async function rows(page: Page): Promise<number> {
  return page.locator("[data-row-link]").count();
}

test.describe("the page", () => {
  test("has the title list as real links in the HTML, before any script runs", async ({
    request,
    baseURL,
  }) => {
    const res = await request.get(new URL(url(ROUTE), baseURL).toString());
    expect(res.ok()).toBe(true);
    const html = await res.text();
    const links = html.match(/data-row-link="\d+"/gu) ?? [];
    expect(links.length).toBeGreaterThanOrEqual(5);
    expect(html).toContain("Fanny, Blade of Kibou");
    expect(html).toMatch(/href="[^"]*\/collection\/arts\/\?i=arts-splash-/u);
    expect(html).toContain('aria-label="All splash art"');
  });

  test("is one fixed screen with no scroll, and its own wheel", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "a wheel");
    await open(page);
    const size = await page.evaluate(() => ({
      h: document.documentElement.scrollHeight,
      v: window.innerHeight,
      y: window.scrollY,
    }));
    expect(size.h).toBeLessThanOrEqual(size.v + 1);
    await page.mouse.move(700, 400);
    await page.mouse.wheel(0, 120);
    await expect.poll(async () => (await snap(page))?.active).toBe(1);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });

  test("stands the stage: a labelled region, five windows at most, one picture in front", async ({
    page,
  }) => {
    const errors = await open(page);
    await expect(page.getByRole("heading", { level: 1, name: "Splash art" })).toBeAttached();
    const stage = page.locator(STAGE);
    await expect(stage).toHaveAttribute("aria-roledescription", "carousel");
    const state = await page.evaluate(() => ({
      mounted: document.querySelectorAll("[data-win]").length,
      lit: document.querySelectorAll("[data-win][data-on]").length,
      front: document.querySelectorAll('[data-win][data-zoom="in"]').length,
      hiddenFromReaders: document.querySelectorAll('[data-win][aria-hidden="true"]').length,
    }));
    expect(state.mounted).toBe(7);
    expect(state.lit).toBeLessThanOrEqual(5);
    expect(state.lit).toBeGreaterThanOrEqual(3);
    expect(state.front).toBe(1);
    expect(state.hiddenFromReaders).toBe(6);
    // The caption is a polite live region with the full text.
    await expect(page.locator(STAGE).locator("[aria-live='polite']")).toContainText(
      "Fanny, Blade of Kibou",
    );
    expect(errors.filter((e) => !e.includes("/library/v1/"))).toEqual([]);
  });

  test("draws only transforms and opacity on the windows and rows, and never writes to <html> or <body>", async ({
    page,
  }) => {
    await open(page);
    const html = await page.evaluate(() => ({
      root: document.documentElement.getAttribute("style") ?? "",
      body: document.body.getAttribute("style") ?? "",
    }));
    expect(html.root).not.toMatch(/--/u);
    expect(html.body).not.toMatch(/--/u);
    const touched = await page.evaluate(() => {
      const props = new Set<string>();
      document
        .querySelectorAll<HTMLElement>("[data-win], [data-win] > div, [data-row]")
        .forEach((el) => {
          for (const name of Array.from(el.style)) props.add(name);
        });
      return [...props];
    });
    for (const prop of touched) {
      expect(["transform", "opacity", "background-color"]).toContain(prop);
    }
  });
});

test.describe("the loop and the steps", () => {
  test("steps with the arrows, Page keys and Space, and wraps both ways", async ({ page }) => {
    await open(page);
    const n = await rows(page);
    await page.keyboard.press("ArrowDown");
    await expect.poll(async () => (await snap(page))?.active).toBe(1);
    await settle(page);
    await page.keyboard.press("PageDown");
    await expect.poll(async () => (await snap(page))?.active).toBe(2);
    await settle(page);
    await page.keyboard.press("Space");
    await expect.poll(async () => (await snap(page))?.active).toBe(3);
    await settle(page);
    await page.keyboard.press("PageUp");
    await expect.poll(async () => (await snap(page))?.active).toBe(2);
    await settle(page);
    await page.keyboard.press("Home");
    await expect.poll(async () => (await snap(page))?.active).toBe(0);
    await settle(page);
    // Back from the first picture is the last: the loop has no end.
    await page.keyboard.press("ArrowUp");
    await expect.poll(async () => (await snap(page))?.active).toBe(n - 1);
    await settle(page);
    await page.keyboard.press("ArrowDown");
    await expect.poll(async () => (await snap(page))?.active).toBe(0);
    await settle(page);
    await page.keyboard.press("End");
    await expect.poll(async () => (await snap(page))?.active).toBe(n - 1);
  });

  test("the picture in front, the list and the caption agree", async ({ page }) => {
    await open(page);
    const n = await rows(page);
    for (const key of ["ArrowDown", "ArrowDown", "ArrowUp"]) {
      await page.keyboard.press(key);
      await settle(page);
    }
    const at = (await snap(page))?.active ?? -1;
    expect(at).toBe(1);
    await expect(page.locator("a[data-row-link][aria-current='true']")).toHaveAttribute(
      "data-row-link",
      String(at),
    );
    await expect(page.locator('[data-win][data-zoom="in"]')).toHaveAttribute(
      "data-win",
      String(at),
    );
    const title = await page
      .locator("a[data-row-link][aria-current='true'] [data-cell='title']")
      .textContent();
    await expect(page.locator(STAGE).locator("[aria-live='polite']")).toContainText(title ?? "");
    expect(n).toBeGreaterThan(at);
  });

  test("a trackpad swipe, a long tail of shrinking turns, is one step", async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "a wheel");
    await open(page);
    // The turns are sent from the page, 16 ms apart, as a trackpad sends them.
    await page.evaluate(async () => {
      for (const d of [8, 20, 60, 100, 90, 70, 50, 30, 18, 10, 6]) {
        window.dispatchEvent(
          new WheelEvent("wheel", { deltaY: d, bubbles: true, cancelable: true }),
        );
        await new Promise((resolve) => setTimeout(resolve, 16));
      }
    });
    await settle(page);
    expect((await snap(page))?.active).toBe(1);
  });

  test("a press on another row goes to it, a press on the front row opens the zoom", async ({
    page,
  }, info) => {
    test.skip(info.project.name !== "desktop", "the list shows from 1024 px");
    await open(page);
    // The row's link runs under the window; a press lands on its words, at the side.
    const words = page.locator("a[data-row-link='3'] [data-cell='title']");
    await words.click();
    await expect.poll(async () => (await snap(page))?.active, { timeout: 8000 }).toBe(3);
    await settle(page);
    await expect(page.locator(DIALOG)).toHaveCount(0);
    await words.click();
    await expect(page.locator(DIALOG)).toBeVisible({ timeout: 15_000 });
  });

  test("stops its loop at rest and when the room is left", async ({ page }) => {
    await open(page);
    await settle(page);
    // At rest the stage asks for no frames: its loop has stopped and the place stays where it is.
    const before = await snap(page);
    await page.waitForTimeout(600);
    const after = await snap(page);
    expect(before?.running).toBe(false);
    expect(after?.running).toBe(false);
    expect(after?.pos).toBe(before?.pos);
    await page.locator("[data-room-back]").click();
    await expect(page).toHaveURL(/\/collection\/(\?open=arts)?$/u, { timeout: 60_000 });
    await expect
      .poll(() => page.evaluate(() => window.__splashStage === undefined), { timeout: 15_000 })
      .toBe(true);
  });
});

test.describe("the zoom", () => {
  test("opens from the front window with Enter and closes with Esc, and the address follows", async ({
    page,
  }, info) => {
    test.skip(info.project.name !== "desktop", "keys");
    await open(page);
    await page.keyboard.press("ArrowDown");
    await settle(page);
    await page.keyboard.press("Enter");
    await expect(page.locator(DIALOG)).toBeVisible({ timeout: 15_000 });
    await expect(page).toHaveURL(/[?&]i=arts-splash-/u);
    await expect.poll(() => page.evaluate(() => window.__artsZoom?.phase)).toBe("open");
    // The stage holds still: a key does not move it.
    await page.keyboard.press("ArrowDown");
    expect((await snap(page))?.active).toBe(1);
    await page.keyboard.press("Escape");
    await expect(page.locator(DIALOG)).toHaveCount(0, { timeout: 15_000 });
    await expect(page).not.toHaveURL(/[?&]i=/u);
    // It closes into the front window: it is in front and shows (the zoom hid it while open).
    await expect(page.locator('[data-win][data-zoom="in"]')).toHaveCSS("visibility", "visible");
  });

  test("a deep link opens the picture, with the stage standing on it", async ({ page }) => {
    await skipGate(page);
    const ids = await (async () => {
      await page.goto(url(ROUTE));
      return page.evaluate(() =>
        [...document.querySelectorAll<HTMLAnchorElement>("a[data-row-link]")].map(
          (a) => new URL(a.href).searchParams.get("i") ?? "",
        ),
      );
    })();
    expect(ids.length).toBeGreaterThan(3);
    await page.goto(url(`${ROUTE}?i=${ids[3]}`));
    await expect(page.locator(DIALOG)).toBeVisible({ timeout: 90_000 });
    await expect.poll(() => page.evaluate(() => window.__artsZoom?.phase)).toBe("open");
    await page.keyboard.press("Escape");
    await expect(page.locator(DIALOG)).toHaveCount(0, { timeout: 15_000 });
    await expect(page.locator(STAGE)).toHaveAttribute("data-stage", "rest");
    expect((await snap(page))?.active).toBe(3);
  });

  test("a picture made for this site carries the mark in the list and in the caption", async ({
    page,
    request,
    baseURL,
  }) => {
    await skipGate(page);
    const res = await request.get(new URL("data/library/arts-splash.json", baseURL).toString());
    const data = (await res.json()) as { items: Array<{ id: string; canon: string }> };
    const made = data.items.find((i) => i.canon !== "official")?.id ?? null;
    test.skip(!made, "the data has no picture made for this site yet");
    await page.goto(url(`${ROUTE}?i=${made}`));
    await expect(page.locator(DIALOG)).toBeVisible({ timeout: 90_000 });
    // The viewer names it.
    await expect(page.locator(DIALOG)).toContainText("Not official art");
    await page.keyboard.press("Escape");
    await expect(page.locator(DIALOG)).toHaveCount(0, { timeout: 15_000 });
    await expect(page.locator(STAGE)).toContainText("Not official art");
    // Its row never says Official.
    const row = page.locator(`a[data-row-link][href*="${made}"]`);
    await expect(row.locator("[data-cell='who']")).toHaveText(/not official/iu);
  });
});

test.describe("the corners", () => {
  test("has the six sub-pages with this one marked, a way back and the takedown", async ({
    page,
  }) => {
    await open(page);
    const nav = page.getByRole("navigation", { name: "Official art" });
    await expect(nav.getByRole("link")).toHaveCount(6);
    await expect(nav.getByRole("link", { name: "Splash art" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    for (const [name, path] of [
      ["Scene", "/collection/arts/scene"],
      ["Comic", "/collection/arts/comic"],
      ["Game", "/collection/arts/game"],
      ["Design", "/collection/arts/design"],
      ["Others", "/collection/arts/others"],
    ] as const) {
      await expect(nav.getByRole("link", { name })).toHaveAttribute(
        "href",
        new RegExp(`${path}/?$`, "u"),
      );
    }
    await expect(page.locator("[data-room-back]")).toHaveAttribute(
      "href",
      /\/collection\/\?open=arts/u,
    );
    await expect(page.locator("[data-takedown]")).toHaveAttribute("href", /\/takedown\/?$/u);
    await expect(page.locator("[data-takedown]")).toContainText("taken down");
  });

  test("the sub-page links are in view and the stage has no sideways overflow", async ({
    page,
  }) => {
    await open(page);
    const box = await page.locator("[data-arts-subnav]").boundingBox();
    const vp = page.viewportSize();
    expect(box).not.toBeNull();
    expect(box!.y).toBeGreaterThan((vp?.height ?? 0) * 0.8);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test.describe("a phone", () => {
  test("has no list on the screen, a Zoom in button, and a finger that moves one place", async ({
    page,
  }, info) => {
    test.skip(info.project.name !== "phone", "touch");
    await open(page);
    // The list is for a screen reader and a crawler only: one pixel on the screen.
    const list = await page.locator("nav[aria-label='All splash art']").boundingBox();
    expect(list === null || list.width <= 2).toBe(true);
    const button = page.getByRole("button", { name: "Zoom in" });
    await expect(button).toBeVisible();
    // Three windows on the screen: the one in front and a part of its neighbours.
    const seen = await page.evaluate(
      () =>
        [...document.querySelectorAll<HTMLElement>("[data-win][data-on]")].filter((el) => {
          const r = el.getBoundingClientRect();
          return r.bottom > 0 && r.top < window.innerHeight;
        }).length,
    );
    expect(seen).toBeGreaterThanOrEqual(3);
    // A swipe up is one step.
    const client = await page.context().newCDPSession(page);
    const swipe = async (from: number, to: number) => {
      await client.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x: 195, y: from }],
      });
      for (let i = 1; i <= 8; i += 1) {
        await client.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [{ x: 195, y: from + ((to - from) * i) / 8 }],
        });
        await page.waitForTimeout(16);
      }
      await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    };
    await swipe(500, 380);
    await expect.poll(async () => (await snap(page))?.active, { timeout: 8000 }).toBe(1);
    await settle(page);
    // A drag the other way, past the commit distance, goes back.
    await swipe(380, 500);
    await expect.poll(async () => (await snap(page))?.active, { timeout: 8000 }).toBe(0);
    await settle(page);
    // The button opens the zoom.
    await button.click();
    await expect(page.locator(DIALOG)).toBeVisible({ timeout: 15_000 });
  });

  test("keeps the way back under the bar with a plate and the corner row at the foot", async ({
    page,
  }, info) => {
    test.skip(info.project.name !== "phone", "a phone");
    await open(page);
    const back = page.locator("[data-room-back]");
    await expect(back).toBeVisible();
    const bg = await back.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bg).not.toBe("rgba(0, 0, 0, 0)");
    const foot = await page.locator("[data-foot]").boundingBox();
    expect(foot!.y + foot!.height).toBeGreaterThan(800);
  });
});
