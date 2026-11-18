import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { settled, sitePath, skipGate, url, watchErrors } from "./helpers";

/**
 * The home page's frame: the one h1, the copy and the links in the page, the two modes (the stage
 * with WebGL, a plain readable page without), the scroll story's position, and the way to About.
 * The opening is skipped here (`skipGate`): the loader's own specs look at it.
 */

interface HomeState {
  S: number;
  raw: number;
  total: number;
  unit: number;
  open: boolean;
  active: string | null;
  stage: { passes: string[]; failed: boolean };
  sections: Array<{ id: string; mount: string; running: boolean; local: number }>;
  actors: Array<{ name: string; visible: boolean }>;
}

const state = (page: Page) =>
  page.evaluate(() =>
    (window as unknown as { __home: { state(): unknown } }).__home.state(),
  ) as Promise<HomeState>;

// A software WebGL for the browser the suite runs in, so the stage itself can be looked at.
test.use({
  launchOptions: {
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
  },
});

test.beforeEach(async ({ page }) => {
  await skipGate(page);
});

/** A browser that cannot make a WebGL context (a failure the page handles by laying itself out plain). */
async function withoutWebGL(page: Page) {
  await page.addInitScript(() => {
    // eslint-disable-next-line @typescript-eslint/unbound-method -- called with its own canvas below
    const original = HTMLCanvasElement.prototype.getContext as (...a: unknown[]) => unknown;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      type: string,
      ...rest: unknown[]
    ) {
      if (type === "webgl" || type === "webgl2" || type === "experimental-webgl") return null;
      return Reflect.apply(original, this, [type, ...rest]);
    } as HTMLCanvasElement["getContext"];
  });
}

async function mode(page: Page): Promise<"on" | "off"> {
  await expect(page.locator("[data-home]")).not.toHaveAttribute("data-gl", "pending");
  return (await page.locator("[data-home]").getAttribute("data-gl")) as "on" | "off";
}

async function overflow(page: Page): Promise<number> {
  return page.evaluate(() => {
    const el = document.scrollingElement ?? document.documentElement;
    return el.scrollWidth - window.innerWidth;
  });
}

const LINKS: Array<[string, RegExp]> = [
  ["About Aspirant", /\/about\/?$/],
  ["See All", /\/collection\/?$/],
  ["See Collections", /\/collection\/video\/films\/?$/],
  ["See All Animations", /\/collection\/animation\/?$/],
  ["See all voicelines", /\/collection\/voicelines\/?$/],
  ["See all music", /\/collection\/music\/?$/],
  ["Read The Story", /\/story\/?$/],
  ["See all comics", /\/collection\/comic\/?$/],
  ["See all fanart", /\/collection\/arts\/fanart\/?$/],
  ["See all artwork", /\/collection\/arts\/?$/],
];

test("has one visible h1 and the controls of the site are usable", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto(url("/"));
  await page.waitForLoadState("networkidle");
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 1, name: "The Aspirants" })).toBeVisible();
  await expect(page.locator("main#main")).toHaveCount(1);
  await expect(page.getByRole("banner").getByRole("button", { name: "Open menu" })).toBeVisible();
  await expect(page.getByRole("banner").getByRole("button", { name: "Sound" })).toBeVisible();

  // The skip link is first in the tab order and moves the focus to the main area.
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("main#main")).toBeFocused();

  // The menu opens at once (the bar is not empty when the opening is off).
  await page.getByRole("banner").getByRole("button", { name: "Open menu" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(errors).toEqual([]);
});

test("the copy and the links of every section are in the page", async ({ page }) => {
  await page.goto(url("/"));
  await page.waitForLoadState("networkidle");
  for (const [name, href] of LINKS) {
    await expect(page.getByRole("link", { name, exact: true }).first(), name).toHaveAttribute(
      "href",
      href,
    );
  }
  await expect(page.locator('[data-home-section="list"] a')).toHaveCount(10);
  await expect(page.locator('[data-home-section="bolt"] li')).toHaveCount(5);
  for (const text of [
    "original anime inspired skin series.",
    "Trailer video for the new Selena & Obsidia Aspirant skin.",
    "10 official animated films produced in the last 4 years.",
    "2022 - Present",
    "Try to hover",
    "Immersive Interaction",
    "What's going on?",
    "Understand all The Aspirants story for all characters in one novel",
    "Scroll more to see the about page",
  ]) {
    await expect(page.getByText(text, { exact: false }).first(), text).toBeAttached();
  }
  // The fan art on the page carries the takedown shortcut.
  await expect(page.getByRole("link", { name: /Copyright or takedown/ }).first()).toBeAttached();
});

test("the next page is one press, one key or one scroll away", async ({ page, baseURL }) => {
  await page.goto(url("/"));
  await page.waitForLoadState("networkidle");
  await page.locator("body").press("n");
  await settled(page);
  await expect.poll(() => sitePath(page, baseURL), { timeout: 15_000 }).toBe("/about/");

  await page.goto(url("/"));
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Continue to About" }).click();
  await settled(page);
  await expect.poll(() => sitePath(page, baseURL), { timeout: 15_000 }).toBe("/about/");

  await page.goto(url("/"));
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect.poll(() => sitePath(page, baseURL), { timeout: 15_000 }).toBe("/about/");
});

test("scrolling most of the way down does not open About", async ({ page, baseURL }) => {
  await page.goto(url("/"));
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => {
    const el = document.documentElement;
    window.scrollTo(0, el.scrollHeight - window.innerHeight * 1.3);
  });
  await page.waitForTimeout(1500);
  expect(sitePath(page, baseURL)).toBe("/");
});

test.describe("on the stage (WebGL)", () => {
  test("the scene follows the scroll and every section hides what is not its own", async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await page.goto(url("/"));
    await page.waitForLoadState("networkidle");
    test.skip(
      (await mode(page)) !== "on",
      "this browser has no WebGL; the plain page is tested below",
    );

    await expect
      .poll(async () => (await state(page)).sections[0]?.mount, { timeout: 30_000 })
      .toBe("ready");
    const first = await state(page);
    expect(first.sections).toHaveLength(16);
    expect(first.total).toBeCloseTo(60.3, 3);
    expect(first.open).toBe(true);
    expect(first.stage.failed).toBe(false);
    await expect
      .poll(async () => (await state(page)).actors.find((a) => a.name === "test-ortho")?.visible)
      .toBe(true);
    expect(first.stage.passes).toContain("ortho");

    // Down to the middle of the second section: the perspective box shows, the flat card does not.
    await page.evaluate(() => {
      const home = (window as unknown as { __home: { state(): { unit: number } } }).__home;
      window.scrollTo(0, 5 * home.state().unit);
    });
    await expect
      .poll(async () => (await state(page)).active, { timeout: 15_000 })
      .toBe("aspirants");
    await expect
      .poll(
        async () => {
          const s = await state(page);
          return [
            s.actors.find((a) => a.name === "test-perspective")?.visible,
            s.actors.find((a) => a.name === "test-ortho")?.visible,
          ];
        },
        { timeout: 15_000 },
      )
      .toEqual([true, false]);
    const s = await state(page);
    expect(s.S).toBeGreaterThan(4.5);
    expect(s.S).toBeLessThanOrEqual(5.05);
    expect(await overflow(page)).toBeLessThanOrEqual(0);
    expect(errors).toEqual([]);
  });

  test("has no serious accessibility violation at several places of the scroll", async ({
    page,
  }) => {
    await page.goto(url("/"));
    await page.waitForLoadState("networkidle");
    test.skip((await mode(page)) !== "on", "this browser has no WebGL");
    await expect
      .poll(async () => (await state(page)).sections[0]?.mount, { timeout: 30_000 })
      .toBe("ready");
    for (const at of [0.5, 5, 9.5, 18.5, 31, 34.5, 40, 59.5]) {
      await page.evaluate((screens) => {
        const home = (window as unknown as { __home: { seek(s: number): void } }).__home;
        home.seek(screens);
      }, at);
      await page.waitForTimeout(400);
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"])
        .analyze();
      const serious = results.violations
        .filter((v) => v.impact === "serious" || v.impact === "critical")
        .map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target.join(" ")) }));
      expect(serious, `at ${at} screens: ${JSON.stringify(serious)}`).toEqual([]);
    }
  });

  test("a control of a section that is not on never catches a press", async ({ page }) => {
    await page.goto(url("/"));
    await page.waitForLoadState("networkidle");
    test.skip((await mode(page)) !== "on", "this browser has no WebGL");
    await expect.poll(async () => (await state(page)).active, { timeout: 15_000 }).toBe("hero");
    // At the top the strip's button is invisible and takes no press (a hidden link must never
    // catch the visitor's click on whatever is in front of it).
    const link = page.getByRole("link", { name: "See Collections", exact: true }).first();
    expect(await link.evaluate((el) => getComputedStyle(el).pointerEvents)).toBe("none");
    // And the one of the section that is on does.
    const near = page.getByRole("link", { name: "About Aspirant", exact: true });
    await page.evaluate(() => {
      (window as unknown as { __home: { seek(s: number): void } }).__home.seek(5);
    });
    await expect
      .poll(async () => near.evaluate((el) => getComputedStyle(el).pointerEvents), {
        timeout: 10_000,
      })
      .toBe("auto");
  });

  test("a control of a section the page is not at moves the page there", async ({ page }) => {
    await page.goto(url("/"));
    await page.waitForLoadState("networkidle");
    test.skip((await mode(page)) !== "on", "this browser has no WebGL");
    await page.getByRole("link", { name: "About Aspirant", exact: true }).focus();
    await expect
      .poll(async () => (await state(page)).raw, { timeout: 10_000 })
      .toBeGreaterThan(4.2);
    await expect.poll(async () => (await state(page)).active).toBe("aspirants");
  });
});

test.describe("without WebGL (the plain page)", () => {
  test("lays the sections out as a readable document", async ({ page }) => {
    await withoutWebGL(page);
    const errors = watchErrors(page);
    await page.goto(url("/"));
    await page.waitForLoadState("networkidle");
    expect(await mode(page)).toBe("off");

    await expect(page.locator("canvas[data-home-canvas]")).toHaveCount(0);
    await expect(page.locator("[data-home-below]").first()).toBeHidden();
    // Every section that has words shows them, in order, on the page itself.
    for (const heading of [
      "Immersive Interaction",
      "2022 - Present",
      "What's going on?",
      "The archive",
    ]) {
      await expect(page.getByRole("heading", { name: heading }), heading).toBeVisible();
    }
    await expect(page.getByRole("link", { name: "About Aspirant", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue to About" })).toBeAttached();
    expect(await overflow(page)).toBeLessThanOrEqual(0);
    expect(errors).toEqual([]);
  });

  test("keeps the one h1 and the way to About", async ({ page, baseURL }) => {
    await withoutWebGL(page);
    await page.goto(url("/"));
    await page.waitForLoadState("networkidle");
    await expect(page.locator("h1")).toHaveCount(1);
    await page.locator("body").press("n");
    await settled(page);
    await expect.poll(() => sitePath(page, baseURL), { timeout: 15_000 }).toBe("/about/");
  });
});
