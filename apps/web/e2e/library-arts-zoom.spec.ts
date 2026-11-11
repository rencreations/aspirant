import { expect, test, type ElementHandle, type Page } from "@playwright/test";

import { skipGate, url, watchErrors } from "./helpers";

/**
 * The zoom of the Arts rooms (`features/library/arts/core/zoom/`): the cursor, the viewer that
 * grows a picture out of its tile, the address, the keys and the touch. The spec is written against
 * the contract only (`[data-zoom="in"]` on a tile, `[data-zoom="out"]` on the open picture,
 * `role="dialog"` and the probe `window.__artsZoom`), so it runs on every room that uses the zoom.
 * Set `ZOOM_SPEC_ROUTES` (comma separated, with the trailing slash) to point it at other pages.
 */
const ROUTES = (process.env.ZOOM_SPEC_ROUTES ?? "/collection/arts/,/collection/arts/scene/")
  .split(",")
  .map((r) => r.trim())
  .filter(Boolean);

const DIALOG = "[role='dialog'][data-zoom-viewer]";

async function openRoom(page: Page, route: string) {
  await skipGate(page);
  const errors = watchErrors(page);
  await page.goto(url(route));
  await expect(page.locator('[data-zoom="in"]').first()).toBeAttached({ timeout: 90_000 });
  return errors;
}

/** The first tile whose middle is on the screen, as a handle. */
async function onScreenTile(page: Page): Promise<ElementHandle<HTMLElement>> {
  const handle = await page.evaluateHandle(() => {
    const tiles = [...document.querySelectorAll<HTMLElement>('[data-zoom="in"]')];
    return (
      tiles.find((el) => {
        const r = el.getBoundingClientRect();
        const x = r.left + r.width / 2;
        const y = r.top + r.height / 2;
        return (
          r.width > 40 &&
          r.height > 40 &&
          x > 0 &&
          y > 0 &&
          x < window.innerWidth &&
          y < window.innerHeight &&
          getComputedStyle(el).visibility !== "hidden"
        );
      }) ?? null
    );
  });
  const el = handle.asElement();
  expect(el, "a tile on the screen").not.toBeNull();
  return el!;
}

async function phase(page: Page): Promise<string | undefined> {
  return page.evaluate(() => window.__artsZoom?.phase);
}

async function opened(page: Page) {
  await expect(page.locator(DIALOG)).toBeVisible({ timeout: 15_000 });
  await expect.poll(() => phase(page), { timeout: 15_000 }).toBe("open");
}

async function closed(page: Page) {
  await expect(page.locator(DIALOG)).toHaveCount(0, { timeout: 15_000 });
}

/** The box that holds the picture on the screen: the union of its layers. */
async function pictureBox(page: Page) {
  return page.evaluate(() => {
    const imgs = [...document.querySelectorAll<HTMLImageElement>("[data-zoom-viewer] img")];
    const boxes = imgs
      .map((i) => i.getBoundingClientRect())
      .filter((r) => r.width > 0 && r.height > 0);
    const first = boxes[0]!;
    const full = imgs.find((i) => i.naturalWidth > 0);
    return {
      x: first.left,
      y: first.top,
      w: first.width,
      h: first.height,
      natural: full ? full.naturalWidth / full.naturalHeight : null,
      vw: document.documentElement.clientWidth,
      vh: document.documentElement.clientHeight,
    };
  });
}

for (const route of ROUTES) {
  test.describe(`zoom on ${route}`, () => {
    test("a press grows the picture to the screen without cutting it, and Esc brings it home", async ({
      page,
    }, info) => {
      const errors = await openRoom(page, route);
      const tile = await onScreenTile(page);
      const id = await tile.getAttribute("data-zoom-id");
      if (info.project.name === "phone") await tile.tap();
      else await tile.click();
      await opened(page);

      const dialog = page.locator(DIALOG);
      await expect(dialog).toHaveAttribute("aria-modal", "true");
      expect(await dialog.getAttribute("aria-label")).toBeTruthy();
      // The address holds the picture, and the page behind is out of reach.
      expect(new URL(page.url()).searchParams.get("i")).toBe(id);
      expect(await page.evaluate(() => document.getElementById("site-shell")?.inert)).toBe(true);
      // The tile is hidden while its picture is open (no double picture).
      expect(await tile.evaluate((el) => getComputedStyle(el).visibility)).toBe("hidden");
      // Nothing is stretched or cut: the picture is inside the screen, keeps its shape, and fills
      // it on the width or the height.
      const b = await pictureBox(page);
      const tol = 1.5;
      expect(b.x).toBeGreaterThanOrEqual(-tol);
      expect(b.y).toBeGreaterThanOrEqual(-tol);
      expect(b.x + b.w).toBeLessThanOrEqual(b.vw + tol);
      const scrolls = (await page.locator(`${DIALOG} [data-scroll='true']`).count()) > 0;
      if (!scrolls) {
        expect(b.y + b.h).toBeLessThanOrEqual(b.vh + tol);
        expect(Math.max(b.w / b.vw, b.h / b.vh)).toBeGreaterThan(0.995);
      } else {
        // A tall strip fits the width and is read by scrolling.
        expect(b.w).toBeGreaterThan(b.vw - tol);
      }
      if (b.natural) expect(Math.abs(b.w / b.h / b.natural - 1)).toBeLessThan(0.01);

      await page.keyboard.press("Escape");
      await closed(page);
      expect(new URL(page.url()).searchParams.get("i")).toBeNull();
      expect(await page.evaluate(() => document.getElementById("site-shell")?.inert)).toBe(false);
      expect(await tile.evaluate((el) => getComputedStyle(el).visibility)).toBe("visible");
      if (info.project.name !== "phone") {
        expect(await tile.evaluate((el) => el === document.activeElement)).toBe(true);
      }
      expect(errors.filter((e) => !/Failed to load resource|net::ERR/u.test(e))).toEqual([]);
    });

    test("the browser's Back closes the viewer, and the page still scrolls and clicks", async ({
      page,
    }, info) => {
      await openRoom(page, route);
      const tile = await onScreenTile(page);
      if (info.project.name === "phone") await tile.tap();
      else await tile.click();
      await opened(page);
      await page.goBack();
      await closed(page);
      expect(new URL(page.url()).searchParams.get("i")).toBeNull();
      expect(await page.evaluate(() => document.getElementById("site-shell")?.inert)).toBe(false);
      // Opening again works: nothing was left behind.
      const again = await onScreenTile(page);
      if (info.project.name === "phone") await again.tap();
      else await again.click();
      await opened(page);
      await page.keyboard.press("Escape");
      await closed(page);
    });

    test("a picture named in the address opens at once, and an unknown id is ignored", async ({
      page,
    }) => {
      await openRoom(page, route);
      const id = await (await onScreenTile(page)).getAttribute("data-zoom-id");
      expect(id).toBeTruthy();
      await page.goto(url(`${route}?i=${encodeURIComponent(id!)}`));
      await opened(page);
      await expect(page.locator(DIALOG)).toHaveAttribute("aria-label", /.+/u);
      await page.keyboard.press("Escape");
      await closed(page);
      await page.goto(url(`${route}?i=this-picture-does-not-exist`));
      await expect(page.locator('[data-zoom="in"]').first()).toBeAttached({ timeout: 90_000 });
      await page.waitForTimeout(800);
      await expect(page.locator(DIALOG)).toHaveCount(0);
    });

    test("the arrow keys move to the neighbour and the close button closes", async ({
      page,
    }, info) => {
      test.skip(info.project.name === "phone", "A phone swipes, it has no arrow keys");
      await openRoom(page, route);
      const tile = await onScreenTile(page);
      await tile.click();
      await opened(page);
      const first = new URL(page.url()).searchParams.get("i");
      const count = await page.locator(`${DIALOG} [data-side='next']`).count();
      if (count > 0 && (await page.locator(`${DIALOG} [data-side='next']`).isEnabled())) {
        await page.keyboard.press("ArrowRight");
        await expect.poll(() => new URL(page.url()).searchParams.get("i")).not.toBe(first);
        await page.keyboard.press("ArrowLeft");
        await expect.poll(() => new URL(page.url()).searchParams.get("i")).toBe(first);
      }
      await page.getByRole("button", { name: "Close the picture" }).click();
      await closed(page);
    });

    test("the page behind is held still while the picture is open, with no style on <html>", async ({
      page,
    }, info) => {
      test.skip(info.project.name === "phone", "A phone has no wheel");
      await openRoom(page, route);
      await page.evaluate(() => {
        const w = window as unknown as { __rootStyleWrites: number };
        w.__rootStyleWrites = 0;
        new MutationObserver((records) => {
          w.__rootStyleWrites += records.length;
        }).observe(document.documentElement, { attributes: true, attributeFilter: ["style"] });
      });
      const tile = await onScreenTile(page);
      await tile.click();
      await opened(page);
      const before = await page.evaluate(() => window.scrollY);
      const strip = (await page.locator(`${DIALOG} [data-scroll='true']`).count()) > 0;
      await page.mouse.move(400, 400);
      for (let i = 0; i < 6; i += 1) await page.mouse.wheel(0, 300);
      await page.keyboard.press("PageDown");
      await page.waitForTimeout(500);
      expect(await page.evaluate(() => window.scrollY)).toBe(before);
      // A strip scrolled inside the viewer, and nowhere else.
      if (strip) {
        expect(
          await page.evaluate(
            () =>
              document.querySelector<HTMLElement>("[data-zoom-viewer] [data-scroll]")!.scrollTop,
          ),
        ).toBeGreaterThan(0);
      }
      await page.keyboard.press("Escape");
      await closed(page);
      for (let i = 0; i < 20; i += 1) await page.mouse.move(100 + i * 30, 200 + (i % 5) * 60);
      expect(
        await page.evaluate(
          () => (window as unknown as { __rootStyleWrites: number }).__rootStyleWrites,
        ),
      ).toBe(0);
      expect(
        await page.evaluate(() => document.documentElement.classList.contains("lenis-stopped")),
      ).toBe(false);
    });

    test("the cursor says Zoom In over a tile and Zoom Out over the open picture", async ({
      page,
    }, info) => {
      test.skip(info.project.name !== "desktop", "Only a pointer has a cursor");
      await openRoom(page, route);
      const tile = await onScreenTile(page);
      const box = (await tile.boundingBox())!;
      const cursor = page.locator("[data-overlay='zoom-cursor']");
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 8 });
      await expect(cursor).toHaveAttribute("data-mode", "in");
      // The lantern gives way, and the native cursor is hidden on the tile only while the mark shows.
      expect(
        await page.evaluate(
          () =>
            document.querySelector<HTMLElement>("[data-overlay='cursor']")?.style.opacity ?? "0",
        ),
      ).toBe("0");
      expect(await tile.evaluate((el) => el.style.cursor)).toBe("none");
      await page.mouse.down();
      await expect(cursor).toHaveAttribute("data-pressed", "true");
      await page.mouse.up();
      await opened(page);
      await expect(cursor).toHaveAttribute("data-mode", "out");
      await page.keyboard.press("Escape");
      await closed(page);
      await page.mouse.move(3, 3, { steps: 4 });
      await expect(cursor).toHaveAttribute("data-mode", "none");
      expect(await tile.evaluate((el) => el.style.cursor)).not.toBe("none");
    });

    test("a tap on the open picture closes it, and so does a swipe down", async ({
      page,
      context,
    }, info) => {
      test.skip(info.project.name !== "phone", "Touch only");
      await openRoom(page, route);
      expect(await page.locator("[data-overlay='zoom-cursor']").count()).toBe(0);
      const tile = await onScreenTile(page);
      await tile.tap();
      await opened(page);
      await page.touchscreen.tap(195, 420);
      await closed(page);
      await page.waitForTimeout(400);
      const again = await onScreenTile(page);
      await again.tap();
      await opened(page);
      await page.waitForTimeout(400);
      const cdp = await context.newCDPSession(page);
      const touch = (type: "touchStart" | "touchMove" | "touchEnd", y: number) =>
        cdp.send("Input.dispatchTouchEvent", {
          type,
          touchPoints: type === "touchEnd" ? [] : [{ x: 195, y }],
        });
      await touch("touchStart", 300);
      for (let y = 300; y <= 560; y += 20) await touch("touchMove", y);
      await touch("touchEnd", 560);
      await closed(page);
    });
  });
}
