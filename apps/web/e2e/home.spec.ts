import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

import {
  ARCHIVE,
  ASPIRANTS,
  BEND,
  CHASE,
  FOOTER,
  FUNNY,
  HERO,
  LIST,
  MUSIC,
  SELENA,
  STRIP,
  VOICES,
} from "../src/features/home/content";
import { CHARACTER_NAMES } from "../src/lib/slugs";

import { homeOpen, settled, sitePath, skipGate, tapHome, url, watchErrors } from "./helpers";

/**
 * The home page as a whole: the document (one h1, headings in order, landmarks, the copy and the
 * links), the stage with WebGL (the scene follows the scroll, every section hides what is not its
 * own, the keyboard reaches every control and the page moves to it), the plain page (no scripts, or
 * no WebGL: readable, in order, no sideways scroll, every link goes somewhere), the ways in (the
 * opening with its tap gate, the page at once with `aspirants:intro` off, a reload part way down,
 * Back from About) and the ways out. Accessibility is checked with axe at a place in every part of
 * the scroll.
 *
 * The page has fourteen sections (`kernel/types.ts`). Scenes follow the scroll in zones, and a few
 * words and one growing window run on a clock (`docs/design/home/kernel-scrub.md`), so nothing here
 * pins a scroll position in numbers: a place is taken from `window.__home.sections()`. The copy and
 * the links are read from `features/home/content.ts`, the owner's own words.
 *
 * Most specs start with the opening switched off (`skipGate`): the opening has its own specs below
 * and in a11y.spec.ts. The page keeps downloading in the background (video, models, voice lines),
 * so nothing here waits for `networkidle`: it waits for what the home itself reports. Selena and the
 * pair take a while to build after a seek (the first time, with a software renderer, up to about
 * fifteen seconds), so a wait for a section to be the active one is generous.
 */

interface HomeState {
  S: number;
  raw: number;
  total: number;
  unit: number;
  open: boolean;
  active: string | null;
  playing: string | null;
  stage: { passes: string[]; failed: boolean; lost: boolean };
  sections: Array<{ id: string; mount: string; running: boolean; local: number }>;
  actors: Array<{ name: string; visible: boolean }>;
}

interface PlacedSection {
  id: string;
  start: number;
  screens: number;
}

interface PlayState {
  id: string;
  v: number;
  resting: number;
  active: boolean;
  fired: number;
  length: number;
  direction: -1 | 0 | 1;
  progress: number;
  waiting: boolean;
}

interface SnapState {
  armed: boolean;
  moving: boolean;
  blocked: string | null;
  thresholds: number[];
  joints: Array<{ from: number; to: number }>;
}

type HomeWindow = {
  __home: {
    state(): HomeState;
    seek(s: number): void;
    sections(): PlacedSection[];
    plays(): PlayState[];
    snap(): SnapState;
  };
};

const plays = (page: Page) =>
  page.evaluate<PlayState[]>(() => (window as unknown as HomeWindow).__home.plays());

const snap = (page: Page) =>
  page.evaluate<SnapState>(() => (window as unknown as HomeWindow).__home.snap());

const state = (page: Page) =>
  page.evaluate<HomeState>(() => (window as unknown as HomeWindow).__home.state());

const placed = (page: Page) =>
  page.evaluate<PlacedSection[]>(() => (window as unknown as HomeWindow).__home.sections());

const seek = (page: Page, screens: number) =>
  page.evaluate((s) => {
    (window as unknown as HomeWindow).__home.seek(s);
  }, screens);

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

/** Wait until the page has decided its mode, then say which one it is. */
async function mode(page: Page): Promise<"on" | "off"> {
  await expect(page.locator("[data-home]")).not.toHaveAttribute("data-gl", "pending");
  return (await page.locator("[data-home]").getAttribute("data-gl")) as "on" | "off";
}

/** Open `/` with the opening off and wait until the stage is running its first sections. */
async function openStage(page: Page): Promise<void> {
  await page.goto(url("/"));
  test.skip(
    (await mode(page)) !== "on",
    "this browser has no WebGL; the plain page is tested below",
  );
  await page.waitForFunction(() => !!(window as unknown as Partial<HomeWindow>).__home, null, {
    timeout: 60_000,
  });
  await expect.poll(async () => (await state(page)).open, { timeout: 30_000 }).toBe(true);
  await expect
    .poll(async () => (await state(page)).sections[0]?.mount, { timeout: 30_000 })
    .toBe("ready");
}

async function overflow(page: Page): Promise<number> {
  return page.evaluate(() => {
    const el = document.scrollingElement ?? document.documentElement;
    return el.scrollWidth - window.innerWidth;
  });
}

/** The fourteen sections, in scroll order (`SECTION_IDS` of `kernel/types.ts`). */
const SECTION_IDS = [
  "hero",
  "aspirants",
  "rows",
  "strip",
  "descent",
  "list",
  "selena",
  "voices",
  "music",
  "funny",
  "chase",
  "bend",
  "archive",
  "footer",
];

/** The h2 of every section, in the order of the page. The names the page gives to a reader. */
const HEADINGS = [
  ASPIRANTS.title,
  "Trailer",
  `${STRIP.expand.lead} ${STRIP.expand.title}`,
  LIST.title,
  SELENA.title,
  VOICES.title,
  MUSIC.title,
  FUNNY.title,
  CHASE.title,
  BEND.title,
  BEND.artworkTitle,
  ARCHIVE.title,
  FOOTER.title,
];

/** The address a link of the page leads to: the route, with or without its closing slash. */
const toHref = (route: string): RegExp => new RegExp(`${route}/?$`);

/** The owner's links: the name of the link, where it lives and where it goes. */
const LINKS: Array<{ name: string; section: string; href: RegExp }> = [
  { name: ASPIRANTS.button.label, section: "aspirants", href: toHref(ASPIRANTS.button.href) },
  { name: STRIP.button.label, section: "strip", href: toHref(STRIP.button.href) },
  { name: STRIP.expand.button.label, section: "strip", href: toHref(STRIP.expand.button.href) },
  { name: SELENA.button.label, section: "selena", href: toHref(SELENA.button.href) },
  { name: VOICES.button.label, section: "voices", href: toHref(VOICES.button.href) },
  { name: MUSIC.button.label, section: "music", href: toHref(MUSIC.button.href) },
  { name: FUNNY.button.label, section: "funny", href: toHref(FUNNY.button.href) },
  { name: CHASE.left.label, section: "chase", href: toHref(CHASE.left.href) },
  { name: CHASE.right.label, section: "chase", href: toHref(CHASE.right.href) },
  { name: CHASE.button.label, section: "chase", href: toHref(CHASE.button.href) },
  { name: BEND.fanart.label, section: "bend", href: toHref(BEND.fanart.href) },
  { name: BEND.artwork.label, section: "bend", href: toHref(BEND.artwork.href) },
  { name: ARCHIVE.button.label, section: "archive", href: toHref(ARCHIVE.button.href) },
];

/** A link of the page by its name, looked for inside its own section. */
const linkOf = (page: Page, section: string, name: string): Locator =>
  page.locator(`[data-home-section="${section}"]`).getByRole("link", { name, exact: true });

/** The owner's copy, exact (`features/home/content.ts`). */
const COPY = [
  HERO.cue,
  ASPIRANTS.line,
  ASPIRANTS.partOf,
  ASPIRANTS.partOfEnd,
  STRIP.topRight,
  STRIP.topRightTag,
  STRIP.middleLeft,
  STRIP.middleRight,
  ...STRIP.bottomLeft.rest,
  STRIP.expand.lead,
  STRIP.expand.title,
  STRIP.expand.body,
  STRIP.play.duration,
  SELENA.title,
  SELENA.body,
  FUNNY.title,
  FUNNY.body,
  FOOTER.eyebrow,
  FOOTER.line,
  FOOTER.hint,
  FOOTER.legal.madeBy,
];

/** The ten Aspirants of the list, in the owner's order. */
const LIST_ORDER = LIST.order.map((slug) => [CHARACTER_NAMES[slug], slug] as const);

/** Headings in the order of the page: one h1 first, and no level skipped on the way down. */
async function expectHeadingOutline(page: Page): Promise<void> {
  const outline = await page.evaluate(() =>
    Array.from(document.querySelectorAll("main h1, main h2, main h3, main h4")).map((h) => ({
      level: Number(h.tagName.slice(1)),
      name: (h.getAttribute("aria-label") ?? h.textContent ?? "").trim().slice(0, 40),
    })),
  );
  expect(outline[0]?.level, "the first heading is the h1").toBe(1);
  let previous = 0;
  for (const h of outline) {
    expect(h.level - previous, `"${h.name}" skips a heading level`).toBeLessThanOrEqual(1);
    previous = h.level;
  }
}

test("has one visible h1, a main area and a bar whose controls are usable", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto(url("/"));
  await mode(page);
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 1, name: HERO.name })).toBeVisible();
  await expect(page.locator("main#main")).toHaveCount(1);
  await expect(page.getByRole("banner").getByRole("button", { name: "Open menu" })).toBeVisible();
  await expect(page.getByRole("banner").getByRole("button", { name: "Sound" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Legal" })).toBeAttached();

  // The skip link is first in the tab order and moves the focus to the main area.
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("main#main")).toBeFocused();

  // The menu opens at once (the bar is not empty when the opening is off).
  await page.getByRole("banner").getByRole("button", { name: "Open menu" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(errors.filter((e) => !e.includes("Failed to load resource"))).toEqual([]);
});

test("the headings run in the order of the page and none is skipped", async ({ page }) => {
  await page.goto(url("/"));
  await mode(page);
  const h2 = await page.getByRole("heading", { level: 2 }).allTextContents();
  // The accessible names, not the decorative copies: each heading's own name starts the list entry.
  const asked = await Promise.all(
    HEADINGS.map(async (name) =>
      page.getByRole("heading", { level: 2, name, exact: true }).count(),
    ),
  );
  expect(asked, `headings found: ${JSON.stringify(h2)}`).toEqual(HEADINGS.map(() => 1));
  // And they are in this order in the document.
  const order = await page.evaluate((wanted) => {
    const all = Array.from(document.querySelectorAll("main h2, h2"));
    const text = (el: Element) => {
      const clone = el.cloneNode(true) as Element;
      clone.querySelectorAll("[aria-hidden='true']").forEach((n) => {
        n.remove();
      });
      return (clone.textContent ?? "").replace(/\s+/g, " ").trim();
    };
    const squash = (t: string) => t.replace(/\s+/g, "");
    return wanted.map((w) => all.findIndex((el) => squash(text(el)) === squash(w)));
  }, HEADINGS);
  expect(
    order.every((i) => i >= 0),
    `positions ${JSON.stringify(order)}`,
  ).toBe(true);
  expect([...order].sort((a, b) => a - b)).toEqual(order);
  await expectHeadingOutline(page);
});

test("the copy and the links of every section are in the page", async ({ page }) => {
  await page.goto(url("/"));
  await mode(page);
  for (const { name, section, href } of LINKS) {
    await expect(linkOf(page, section, name).first(), `${section}: ${name}`).toHaveAttribute(
      "href",
      href,
    );
  }
  // The ten Aspirants of the list link to their pages, in the owner's order.
  const list = page.locator('[data-home-section="list"] [data-list-names] a');
  await expect(list).toHaveCount(10);
  for (const [i, [name, slug]] of LIST_ORDER.entries()) {
    await expect(list.nth(i), name).toHaveText(name);
    await expect(list.nth(i), name).toHaveAttribute("href", new RegExp(`/character/${slug}/?$`));
  }
  // The ten films of the strip and the ten rooms of the archive.
  await expect(
    page.locator(`[data-home-section="strip"] ul[aria-label="${STRIP.controls.previews}"] a`),
  ).toHaveCount(10);
  await expect(
    page.locator(`[data-home-section="archive"] ul[aria-label="${ARCHIVE.rooms}"] a`),
  ).toHaveCount(10);
  // The two comics and the button of the comic section (each is a link to the collection's comics).
  await expect(
    page.locator('[data-home-section="chase"] a[href*="/collection/comic/"]'),
  ).toHaveCount(3);
  // The way on to About is a real button with its own name.
  await expect(
    page.locator('[data-home-section="footer"]').getByRole("button", { name: FOOTER.buttonName }),
  ).toBeAttached();
  for (const text of COPY) {
    await expect(page.getByText(text, { exact: false }).first(), text).toBeAttached();
  }
  // The foot every page carries: Terms, Privacy and the cookie settings, and who made the site.
  const foot = page.locator('[data-home-section="footer"]');
  await expect(
    foot.getByRole("link", { name: FOOTER.legal.terms, exact: true }),
    FOOTER.legal.terms,
  ).toHaveAttribute("href", /\/terms\/?$/);
  await expect(
    foot.getByRole("link", { name: FOOTER.legal.privacy, exact: true }),
    FOOTER.legal.privacy,
  ).toHaveAttribute("href", /\/privacy\/?$/);
  await expect(foot.getByRole("button", { name: FOOTER.legal.cookies })).toBeAttached();
  // Fan art and the 3D models carry the takedown shortcut.
  await expect(
    page.locator('[data-home-section="bend"]').getByRole("link", { name: /Copyright or takedown/ }),
  ).not.toHaveCount(0);
  await expect(
    page
      .locator('[data-home-section="footer"]')
      .getByRole("link", { name: /Copyright or takedown/ }),
  ).toBeAttached();
});

test("every control and link of the page has a name and every picture is decorative or named", async ({
  page,
}) => {
  await page.goto(url("/"));
  await mode(page);
  const unnamed = await page.evaluate(() => {
    const bad: string[] = [];
    const nameOf = (el: Element): string => {
      const label = el.getAttribute("aria-label");
      if (label?.trim()) return label.trim();
      const by = el.getAttribute("aria-labelledby");
      if (by) {
        const text = by
          .split(/\s+/)
          .map((id) => document.getElementById(id)?.textContent ?? "")
          .join(" ")
          .trim();
        if (text) return text;
      }
      const clone = el.cloneNode(true) as Element;
      clone.querySelectorAll("[aria-hidden='true']").forEach((n) => {
        n.remove();
      });
      const text = (clone.textContent ?? "").trim();
      if (text) return text;
      return Array.from(el.querySelectorAll("img[alt]"))
        .map((i) => i.getAttribute("alt") ?? "")
        .join(" ")
        .trim();
    };
    document.querySelectorAll("main a[href], main button, main [role='button']").forEach((el) => {
      if (!nameOf(el)) bad.push(`${el.tagName} ${String(el.className).slice(0, 40)}`);
    });
    document.querySelectorAll("main img").forEach((img) => {
      if (!img.hasAttribute("alt")) bad.push(`img without alt ${img.getAttribute("src")}`);
    });
    return bad;
  });
  expect(unnamed).toEqual([]);
});

test("the next page is one press, one key or one scroll away", async ({ page, baseURL }) => {
  await page.goto(url("/"));
  await homeOpen(page);
  await page.locator("body").press("n");
  await settled(page);
  await expect.poll(() => sitePath(page, baseURL), { timeout: 20_000 }).toBe("/about/");

  await page.goto(url("/"));
  await homeOpen(page);
  await page.getByRole("button", { name: FOOTER.buttonName }).click();
  await settled(page);
  await expect.poll(() => sitePath(page, baseURL), { timeout: 20_000 }).toBe("/about/");

  await page.goto(url("/"));
  await homeOpen(page);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect.poll(() => sitePath(page, baseURL), { timeout: 20_000 }).toBe("/about/");
});

test("scrolling most of the way down does not open About", async ({ page, baseURL }) => {
  await page.goto(url("/"));
  await homeOpen(page);
  await page.evaluate(() => {
    const el = document.documentElement;
    window.scrollTo(0, el.scrollHeight - window.innerHeight * 1.3);
  });
  await page.waitForTimeout(1500);
  expect(sitePath(page, baseURL)).toBe("/");
});

test("a reload part way down opens at the top", async ({ page }) => {
  await page.goto(url("/"));
  await homeOpen(page);
  await page.evaluate(() => window.scrollTo(0, window.innerHeight * 20));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100);
  await page.reload();
  await homeOpen(page);
  await expect.poll(() => page.evaluate(() => window.scrollY), { timeout: 10_000 }).toBe(0);
  await expect(page.getByRole("heading", { level: 1, name: HERO.name })).toBeVisible();
});

test.describe("on the stage (WebGL)", () => {
  test("keeps the stage, backdrop and music canvases hidden from readers", async ({ page }) => {
    const errors = watchErrors(page);
    await openStage(page);
    const first = await state(page);
    expect(first.stage.failed).toBe(false);
    expect(first.stage.lost).toBe(false);
    const sections = await placed(page);
    expect(sections.map((s) => s.id)).toEqual(SECTION_IDS);
    // The story is a long scroll: its length is the sum of the sections' own lengths (about sixty
    // screens), which no test pins to a number.
    const last = sections[sections.length - 1];
    expect(first.total).toBeCloseTo((last?.start ?? 0) + (last?.screens ?? 0), 6);
    expect(first.total).toBeGreaterThan(40);
    // The stage's canvas, on the home's own layer, and the reader's tree never sees it. The live
    // backdrops have a small canvas of their own beside it, and nothing else draws in the home.
    await expect(page.locator("canvas[data-home-canvas]")).toHaveCount(1);
    await expect(page.locator("canvas[data-home-canvas]")).toHaveAttribute("aria-hidden", "true");
    await expect(page.locator("canvas[data-home-backdrop]")).toHaveCount(1);
    await expect(page.locator("canvas[data-home-backdrop]")).toHaveAttribute("aria-hidden", "true");
    await expect(page.locator("canvas[data-music-field]")).toHaveAttribute("aria-hidden", "true");
    expect(
      await page.evaluate(
        () =>
          document.querySelectorAll(
            "[data-home] canvas:not([data-home-canvas]):not([data-home-backdrop]):not([data-music-field])",
          ).length,
      ),
    ).toBe(0);
    // The decorative layer is hidden from a reader as a whole, the text layer is not.
    expect(
      await page
        .locator("[data-home-below]")
        .first()
        .evaluate((el) => !!el.closest("[aria-hidden='true']")),
    ).toBe(true);
    expect(
      await page
        .locator("[data-home-text]")
        .first()
        .evaluate((el) => !!el.closest("[aria-hidden='true']")),
    ).toBe(false);
    expect(await overflow(page)).toBeLessThanOrEqual(0);
    expect(errors.filter((e) => !e.includes("Failed to load resource"))).toEqual([]);
  });

  test("the scene follows the scroll and every section hides what is not its own", async ({
    page,
  }) => {
    test.setTimeout(150_000);
    await openStage(page);
    const sections = await placed(page);
    expect(sections.map((s) => s.id)).toEqual(SECTION_IDS);
    // The middle of each fixed section: it is the active one, its words are on and the words of
    // every other section are off (a hidden control never catches a press). A section whose scene
    // is heavy (Selena, the pair) is the active one only when it has been built, so this waits.
    for (const s of sections.filter((x) => x.id !== "footer")) {
      await seek(page, s.start + s.screens * 0.5);
      await expect.poll(async () => (await state(page)).active, { timeout: 40_000 }).toBe(s.id);
      const on = await page.evaluate(() =>
        Array.from(document.querySelectorAll<HTMLElement>("[data-home-text][data-on='1']")).map(
          (el) => el.dataset.homeText,
        ),
      );
      expect(on, `the sections that are on in the middle of ${s.id}`).toContain(s.id);
      expect(
        on.length,
        `too many sections on in the middle of ${s.id}: ${on.join(",")}`,
      ).toBeLessThanOrEqual(2);
    }
    expect(await overflow(page)).toBeLessThanOrEqual(0);
  });

  test("a seek puts every scene at rest: no play is half done and nothing holds the page", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await openStage(page);
    const sections = await placed(page);
    for (const s of sections.filter((x) => x.id !== "footer")) {
      await seek(page, s.start + s.screens * 0.5);
      const now = await plays(page);
      expect(
        now.filter((p) => p.active),
        `a play is still running after a seek into ${s.id}`,
      ).toEqual([]);
      for (const p of now) {
        expect(p.length, `${p.id}: the table has at least one play`).toBeGreaterThan(0);
        expect(p.direction, `${p.id} has no direction at rest`).toBe(0);
      }
      expect(
        await page.evaluate(() => document.documentElement.classList.contains("lenis-stopped")),
      ).toBe(false);
    }
  });

  test("the thresholds and the joints are inside the page, in order", async ({ page }) => {
    await openStage(page);
    const { thresholds, joints } = await snap(page);
    const { total } = await state(page);
    expect(thresholds.length).toBeGreaterThan(0);
    for (const t of thresholds) {
      expect(t).toBeGreaterThanOrEqual(0);
      expect(t).toBeLessThan(total);
    }
    expect([...thresholds].sort((a, b) => a - b)).toEqual(thresholds);
    expect(joints.length).toBeGreaterThan(0);
    for (const [i, j] of joints.entries()) {
      expect(j.to).toBeGreaterThan(j.from);
      if (i > 0) expect(j.from).toBeGreaterThanOrEqual(joints[i - 1]!.to);
    }
  });

  test("the wheel moves the page both ways, the scene follows it and nothing holds the scroll", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await openStage(page);
    await page.mouse.move(400, 300);
    const locked = () =>
      page.evaluate(() => document.documentElement.classList.contains("lenis-stopped"));
    // Down: a steady wheel carries the page and the scene's scroll after it (the scenes are scroll
    // zones: no scene starts by itself and holds the visitor).
    for (let i = 0; i < 24; i++) {
      await page.mouse.wheel(0, 100);
      await page.waitForTimeout(30);
      expect(await locked(), "the scroll is held while the visitor wheels").toBe(false);
    }
    await expect.poll(async () => (await state(page)).raw, { timeout: 15_000 }).toBeGreaterThan(1);
    await expect
      .poll(
        async () => {
          const now = await state(page);
          return Math.abs(now.S - now.raw);
        },
        { timeout: 20_000, message: "the scene's scroll catches up with the page" },
      )
      .toBeLessThan(0.05);
    expect((await state(page)).playing).toBeNull();
    // Up: a longer wheel than the way down brings the page back to the top, and the hero is the
    // section on again.
    for (let i = 0; i < 60; i++) {
      await page.mouse.wheel(0, -100);
      await page.waitForTimeout(30);
    }
    await expect.poll(async () => (await state(page)).raw, { timeout: 15_000 }).toBeLessThan(0.5);
    await expect.poll(async () => (await state(page)).active, { timeout: 15_000 }).toBe("hero");
    expect(await locked()).toBe(false);
  });

  test("the strip's small frame grows into its window on a clock and holds the scroll until it has", async ({
    page,
  }) => {
    test.setTimeout(150_000);
    await openStage(page);
    await page.mouse.move(400, 300);
    const strip = (await placed(page)).find((s) => s.id === "strip");
    expect(strip).toBeDefined();
    if (!strip) return;
    // The strip is the one scene the owner kept on a clock: its words are a scroll zone, the
    // growing window is a play. Stand a little into the strip (a seek rests every scene), then
    // wheel on until the window starts.
    await seek(page, strip.start + 0.2);
    await expect.poll(async () => (await state(page)).active, { timeout: 40_000 }).toBe("strip");
    // A play that is due while its scene is still being built waits for it, so wait for the scene.
    await expect
      .poll(async () => (await state(page)).sections.find((s) => s.id === "strip")?.mount, {
        timeout: 60_000,
      })
      .toBe("ready");
    let seen = "";
    for (let i = 0; i < 90 && !seen; i++) {
      await page.mouse.wheel(0, 100);
      await page.waitForTimeout(60);
      const play = (await plays(page)).find((p) => p.id === "strip");
      seen = play?.active ? "active" : play?.waiting ? "waiting" : "";
    }
    expect(seen, "the strip's window never started").not.toBe("");
    if (seen === "waiting") {
      await page.waitForFunction(
        () =>
          (window as unknown as HomeWindow).__home
            .plays()
            .some((p) => p.id === "strip" && p.active),
        null,
        { timeout: 30_000, polling: 50 },
      );
    }
    // While it runs the site's scroll lock is on and the strip is the scene that plays.
    expect(
      await page.evaluate(() => document.documentElement.classList.contains("lenis-stopped")),
    ).toBe(true);
    expect((await state(page)).playing).toBe("strip");
    // It ends by itself and gives the scroll back.
    await page.waitForFunction(
      () => !(window as unknown as HomeWindow).__home.plays().some((p) => p.active),
      null,
      { timeout: 30_000 },
    );
    expect(
      await page.evaluate(() => document.documentElement.classList.contains("lenis-stopped")),
    ).toBe(false);
    expect((await state(page)).playing).toBeNull();
  });

  test("has no serious accessibility violation at a place in every part of the scroll", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await openStage(page);
    const sections = await placed(page);
    for (const s of sections) {
      const at = s.id === "footer" ? s.start + 0.3 : s.start + s.screens * 0.5;
      await seek(page, at);
      await page.waitForTimeout(500);
      const serious = await seriousViolations(page);
      expect(serious, `in the middle of ${s.id}: ${JSON.stringify(serious)}`).toEqual([]);
    }
  });

  test("a control of a section that is not on never catches a press", async ({ page }) => {
    await openStage(page);
    await expect.poll(async () => (await state(page)).active, { timeout: 15_000 }).toBe("hero");
    // At the top the strip's button is invisible and takes no press (a hidden link must never
    // catch the visitor's click on whatever is in front of it).
    const link = linkOf(page, "strip", STRIP.expand.button.label);
    expect(await link.evaluate((el) => getComputedStyle(el).pointerEvents)).toBe("none");
    // And the one of the section that is on does.
    const near = linkOf(page, "aspirants", ASPIRANTS.button.label);
    // The middle of the aspirants, wherever the registry puts them.
    const aspirants = (await placed(page)).find((s) => s.id === "aspirants")!;
    await seek(page, aspirants.start + aspirants.screens * 0.5);
    await expect
      .poll(async () => near.evaluate((el) => getComputedStyle(el).pointerEvents), {
        timeout: 10_000,
      })
      .toBe("auto");
  });

  test("a control of a section the page is not at moves the page there", async ({ page }) => {
    await openStage(page);
    const aspirants = (await placed(page)).find((s) => s.id === "aspirants")!;
    await linkOf(page, "aspirants", ASPIRANTS.button.label).focus();
    await expect
      .poll(async () => (await state(page)).raw, { timeout: 10_000 })
      .toBeGreaterThan(aspirants.start);
    await expect.poll(async () => (await state(page)).active).toBe("aspirants");
  });

  test("a control names the place where it shows, and the page goes there", async ({ page }) => {
    await openStage(page);
    const sections = await placed(page);
    const strip = sections.find((s) => s.id === "strip");
    expect(strip).toBeDefined();
    if (!strip) return;
    // "See All" shows only at the start of its section (the strip), not in the middle: a focus on it
    // moves the page into the strip, to the rest that carries the button, and the button shows.
    const link = linkOf(page, "strip", STRIP.button.label);
    await link.focus();
    await expect
      .poll(async () => (await state(page)).raw, { timeout: 10_000 })
      .toBeGreaterThanOrEqual(strip.start);
    // At the place the control names (the start of the strip), not the middle of the section, which
    // is where a control that said nothing would take the page.
    expect((await state(page)).raw - strip.start).toBeLessThan(strip.screens * 0.4);
    await expect.poll(async () => (await state(page)).active, { timeout: 20_000 }).toBe("strip");
    await expect
      .poll(async () => shown(link), {
        timeout: 10_000,
        message: "See All shows when it has the focus",
      })
      .toBe(true);
  });

  test("every section's first and last control shows when the keyboard reaches it", async ({
    page,
  }) => {
    test.setTimeout(300_000);
    await openStage(page);
    const ids = [
      "aspirants",
      "strip",
      "list",
      "selena",
      "voices",
      "music",
      "funny",
      "chase",
      "bend",
      "archive",
    ];
    for (const id of ids) {
      const controls = page
        .locator(`[data-home-text="${id}"]`)
        .locator("a[href], button:not([disabled])")
        // A control that takes no space (the music's "Continue" before a record is picked) is not a stop.
        .filter({ visible: true });
      const count = await controls.count();
      expect(count, `${id} has controls`).toBeGreaterThan(0);
      for (const pick of [controls.first(), controls.last()]) {
        // The very element, held by a handle: a locator would look again at every poll, and the
        // scene may add controls of its own (the music's records) that change what "last" means.
        const control = await pick.elementHandle();
        expect(control, `${id} has a control to focus`).not.toBeNull();
        if (!control) return;
        const name = (
          (await control.getAttribute("aria-label")) ??
          (await control.textContent()) ??
          ""
        )
          .trim()
          .slice(0, 40);
        // From the top, so the control comes from far away and its section is off. The focus that
        // the last control left is let go first (a focus on an element that has it fires nothing).
        await page.evaluate(() => {
          (document.activeElement as HTMLElement | null)?.blur();
        });
        await seek(page, 0);
        await expect.poll(async () => (await state(page)).active, { timeout: 40_000 }).toBe("hero");
        await control.focus();
        await expect
          .poll(async () => control.evaluate(isShown), {
            timeout: 40_000,
            message: `${id}: "${name}" shows when focused`,
          })
          .toBe(true);
      }
    }
  });

  test("the tab order follows the page, every stop has a name and a visible focus mark", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await openStage(page);
    const stops: Array<{ section: number; name: string; ring: boolean; main: boolean }> = [];
    for (let i = 0; i < 260; i++) {
      await page.keyboard.press("Tab");
      const stop = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return null;
        const slots = Array.from(document.querySelectorAll("[data-home-text]"));
        const slot = el.closest("[data-home-text]");
        const cs = getComputedStyle(el);
        const ring =
          (cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0) ||
          (cs.boxShadow !== "" && cs.boxShadow !== "none");
        // The development server's own overlay is not the page's.
        if (el.tagName.startsWith("NEXTJS")) return { skip: true as const };
        return {
          skip: false as const,
          section: slot ? slots.indexOf(slot) : -1,
          main: !!el.closest("main"),
          name: (el.getAttribute("aria-label") ?? el.textContent ?? "").trim().replace(/\s+/g, " "),
          ring,
        };
      });
      if (!stop) break;
      if (stop.skip) continue;
      stops.push(stop);
      // The last section is the footer: once the keyboard has left it for the page's foot, stop.
      if (stops.length > 8 && !stop.main && stops.some((s) => s.section === SECTION_IDS.length - 1))
        break;
    }
    const inPage = stops.filter((s) => s.section >= 0);
    expect(inPage.length).toBeGreaterThan(60);
    // The first stops are the skip link and the bar, then the sections in order.
    expect(stops[0]?.name).toBe("Skip to content");
    expect(stops.slice(0, 4).some((s) => s.name.includes("Open menu"))).toBe(true);
    let previous = -1;
    for (const s of inPage) {
      expect(s.section, `"${s.name}" is out of order`).toBeGreaterThanOrEqual(previous);
      previous = s.section;
    }
    expect(
      stops.filter((s) => s.name === ""),
      "a stop with no name",
    ).toEqual([]);
    expect(
      stops.filter((s) => !s.ring).map((s) => s.name),
      "stops with no focus mark",
    ).toEqual([]);
  });

  test("a touch on the page works the same: the strip's play button is a real button", async ({
    page,
  }) => {
    await openStage(page);
    const play = page.getByRole("button", { name: STRIP.play.open });
    await expect(play).toBeAttached();
    expect(await play.evaluate((el) => el.tagName)).toBe("BUTTON");
  });
});

test.describe("without WebGL (the plain page)", () => {
  test("lays the sections out as a readable document", async ({ page }) => {
    await withoutWebGL(page);
    const errors = watchErrors(page);
    await page.goto(url("/"));
    expect(await mode(page)).toBe("off");

    await expect(page.locator("canvas[data-home-canvas]")).toHaveCount(0);
    await expect(page.locator("[data-home-below]").first()).toBeHidden();
    // Every section that has words shows them, in order, on the page itself. (The strip's own h2,
    // "Trailer", is for a reader and takes no room.)
    for (const heading of HEADINGS.filter((h) => h !== "Trailer")) {
      await expect(
        page.getByRole("heading", { level: 2, name: heading, exact: true }),
        heading,
      ).toBeVisible();
    }
    await expect(linkOf(page, "aspirants", ASPIRANTS.button.label)).toBeVisible();
    await expect(page.getByRole("button", { name: FOOTER.buttonName })).toBeVisible();
    // The strip draws its words letter by letter for the stage: on the plain page each shows once.
    await expect(page.locator("[data-strip-chars]:visible")).toHaveCount(0);
    await expectListReadable(page);
    expect(await overflow(page)).toBeLessThanOrEqual(0);
    await expectHeadingOutline(page);
    expect(errors.filter((e) => !e.includes("Failed to load resource"))).toEqual([]);
  });

  test("reads from the top to the bottom, in the order of the headings", async ({ page }) => {
    await withoutWebGL(page);
    await page.goto(url("/"));
    expect(await mode(page)).toBe("off");
    const tops = await page.evaluate(() => {
      const h2s = Array.from(document.querySelectorAll("main h2"));
      return h2s.map((h) => h.getBoundingClientRect().top + window.scrollY);
    });
    expect(tops.length).toBeGreaterThanOrEqual(HEADINGS.length);
    // The order of the document is the order on the page: no heading sits above the one before it.
    for (let i = 1; i < tops.length; i++) {
      expect(tops[i] ?? 0, `heading ${i}`).toBeGreaterThanOrEqual((tops[i - 1] ?? 0) - 1);
    }
  });

  test("has no serious accessibility violation", async ({ page }) => {
    await withoutWebGL(page);
    await page.goto(url("/"));
    expect(await mode(page)).toBe("off");
    const serious = await seriousViolations(page);
    expect(serious, JSON.stringify(serious)).toEqual([]);
  });

  test("keeps the one h1 and the way to About", async ({ page, baseURL }) => {
    await withoutWebGL(page);
    await page.goto(url("/"));
    await homeOpen(page);
    await expect(page.locator("h1")).toHaveCount(1);
    await page.locator("body").press("n");
    await settled(page);
    await expect.poll(() => sitePath(page, baseURL), { timeout: 20_000 }).toBe("/about/");
  });

  test("the keyboard reaches every control and each one shows", async ({ page }) => {
    test.setTimeout(120_000);
    await withoutWebGL(page);
    await page.goto(url("/"));
    expect(await mode(page)).toBe("off");
    let stops = 0;
    let unseen: string[] = [];
    for (let i = 0; i < 260; i++) {
      await page.keyboard.press("Tab");
      const stop = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return null;
        if (!el.closest("main")) return { name: "outside", main: false, shown: true };
        const r = el.getBoundingClientRect();
        let opacity = 1;
        let hidden = false;
        for (let e: Element | null = el; e; e = e.parentElement) {
          const cs = getComputedStyle(e);
          opacity *= parseFloat(cs.opacity);
          if (cs.visibility === "hidden" || cs.display === "none") hidden = true;
        }
        return {
          name: (el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 40),
          main: true,
          shown: !hidden && opacity > 0.9 && r.width > 0 && r.height > 0,
        };
      });
      if (!stop) break;
      if (!stop.main) continue;
      stops++;
      if (!stop.shown) unseen = [...unseen, stop.name];
    }
    expect(stops).toBeGreaterThan(60);
    expect(unseen, "controls that took the focus and could not be seen").toEqual([]);
  });

  test("every link of the page goes somewhere", async ({ page, request, baseURL }) => {
    test.setTimeout(180_000);
    await withoutWebGL(page);
    await page.goto(url("/"));
    expect(await mode(page)).toBe("off");
    const hrefs = await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLAnchorElement>("main a[href]")).map((a) => ({
        href: a.getAttribute("href") ?? "",
        target: a.target,
        rel: a.rel,
      })),
    );
    expect(hrefs.length).toBeGreaterThan(80);
    const internal = new Set<string>();
    for (const l of hrefs) {
      expect(l.href, "an empty link").not.toBe("");
      expect(l.href, "a dead link").not.toBe("#");
      if (/^https?:/.test(l.href)) {
        // An outside link opens in a new tab and keeps the opener to itself.
        expect(l.rel, `${l.href} leaks its opener`).toMatch(/noopener/);
        continue;
      }
      internal.add(l.href.split("#")[0]?.split("?")[0] ?? "");
    }
    const base = new URL(baseURL ?? page.url());
    for (const path of internal) {
      const res = await request.get(new URL(path, base).toString());
      expect(res.status(), `${path} answers`).toBeLessThan(400);
    }
  });
});

test.describe("without scripts (the server's page)", () => {
  test.use({ javaScriptEnabled: false });

  test("is a readable document: one h1, every section's words and links, no sideways scroll", async ({
    page,
  }) => {
    await page.goto(url("/"));
    await expect(page.locator("h1")).toHaveCount(1);
    // The plain text of the page is shown: the cover of the boot script is for visitors with scripts.
    await expect(page.locator(".gate-cover")).toBeHidden();
    for (const heading of HEADINGS) {
      await expect(
        page.getByRole("heading", { level: 2, name: heading, exact: true }),
        heading,
      ).toBeAttached();
    }
    for (const { name, section, href } of LINKS) {
      await expect(linkOf(page, section, name).first(), `${section}: ${name}`).toHaveAttribute(
        "href",
        href,
      );
    }
    for (const text of COPY) {
      await expect(page.getByText(text, { exact: false }).first(), text).toBeAttached();
    }
    await expect(page.getByRole("heading", { level: 2, name: SELENA.title })).toBeVisible();
    await expect(linkOf(page, "funny", FUNNY.button.label)).toBeVisible();
    await expect(linkOf(page, "chase", CHASE.button.label)).toBeVisible();
    // The strip's letter by letter copies are for the stage: without scripts each word shows once.
    await expect(page.locator("[data-strip-chars]:visible")).toHaveCount(0);
    await expectListReadable(page);
    expect(await overflow(page)).toBeLessThanOrEqual(0);
    await expectHeadingOutline(page);
  });
});

test.describe("the ways in", () => {
  test("with the opening off the page is open at once, with no gate and no cover", async ({
    page,
  }) => {
    await page.goto(url("/"));
    await mode(page);
    await expect(page.locator("[data-home]")).toHaveAttribute("data-open", "1");
    await expect(page.getByRole("button", { name: /touch anywhere to continue/i })).toHaveCount(0);
    await expect(page.locator("#site-shell")).toHaveJSProperty("inert", false);
    await expect(page.locator(".gate-cover")).toBeHidden();
    await expect(page.getByRole("banner").getByRole("button", { name: "Open menu" })).toBeVisible();
  });

  test.describe("the opening", () => {
    test.beforeEach(async ({ page }) => {
      await skipGate(page, { intro: true });
      // The file's own hook switched the opening off before this one ran: take that back.
      await page.addInitScript(() => {
        try {
          window.sessionStorage.removeItem("aspirants:intro");
        } catch {
          /* ignore */
        }
      });
    });

    test("a document load shows the tap gate, holds the page, and a press opens it", async ({
      page,
    }) => {
      test.setTimeout(150_000);
      await page.goto(url("/"));
      const gate = page.getByRole("button", { name: "Touch anywhere to continue" });
      await expect(gate).toBeVisible({ timeout: 90_000 });
      // The page behind the loading screen is inert and the bar's words are real.
      await expect(page.locator("#site-shell")).toHaveJSProperty("inert", true);
      await expect(page.locator("[data-home]")).not.toHaveAttribute("data-open", "1");
      await page.waitForTimeout(1200);
      await expect(gate).toBeVisible();
      // The opening cannot be skipped: no Skip button at the gate or while the intro plays.
      const skip = page.getByRole("button", { name: /skip/i });
      await expect(skip).toHaveCount(0);
      await gate.click();
      await expect(skip).toHaveCount(0);
      await expect(page.locator("#site-shell")).toHaveJSProperty("inert", false, {
        timeout: 90_000,
      });
      await expect(page.locator("[data-home]")).toHaveAttribute("data-open", "1");
      await expect(
        page.getByRole("banner").getByRole("button", { name: "Open menu" }),
      ).toBeVisible();
      // The page is the visitor's now.
      await page.evaluate(() => window.scrollTo(0, window.innerHeight * 2));
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100);
    });

    for (const key of ["Enter", "Space"]) {
      test(`${key} answers the gate as a press does`, async ({ page }) => {
        test.setTimeout(150_000);
        await page.goto(url("/"));
        const gate = page.getByRole("button", { name: "Touch anywhere to continue" });
        await expect(gate).toBeVisible({ timeout: 90_000 });
        await page.keyboard.press(key);
        await expect(page.locator("#site-shell")).toHaveJSProperty("inert", false, {
          timeout: 90_000,
        });
        await expect(page.locator("[data-home]")).toHaveAttribute("data-open", "1");
      });
    }

    test("Back from About opens the home at rest, with no second opening", async ({
      page,
      baseURL,
    }) => {
      test.setTimeout(240_000);
      await page.goto(url("/"));
      expect(await tapHome(page, 120_000)).toBe(true);
      await mode(page);
      // Leave by the menu (the logo curtain), as a visitor does.
      await page.getByRole("banner").getByRole("button", { name: "Open menu" }).click();
      const menu = page.getByRole("dialog");
      await menu.getByRole("link", { name: /About/ }).first().click();
      await expect.poll(() => sitePath(page, baseURL), { timeout: 60_000 }).toBe("/about/");
      await settled(page);
      await page.goBack();
      await expect.poll(() => sitePath(page, baseURL), { timeout: 60_000 }).toBe("/");
      await settled(page);
      await expect(page.locator("[data-home]")).toHaveAttribute("data-open", "1", {
        timeout: 60_000,
      });
      await expect(page.getByRole("button", { name: /touch anywhere to continue/i })).toHaveCount(
        0,
      );
      await expect(page.getByRole("heading", { level: 1, name: HERO.name })).toBeVisible();
    });
  });
});

/** Serious and critical axe violations of the page as it stands (once more if the page was reloaded under it). */
async function seriousViolations(page: Page): Promise<Array<{ id: string; nodes: string[] }>> {
  for (let attempt = 0; ; attempt++) {
    try {
      // A colour that is half way through a fade (the sound button's words) is not a colour to judge.
      await page
        .waitForFunction(
          () => !document.getAnimations().some((a) => a instanceof CSSTransition),
          null,
          { timeout: 5000 },
        )
        .catch(() => undefined);
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"])
        .analyze();
      return results.violations
        .filter((v) => v.impact === "serious" || v.impact === "critical")
        .map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target.join(" ")) }));
    } catch (error) {
      if (attempt >= 2 || !String(error).includes("Execution context was destroyed")) throw error;
      await page.waitForTimeout(1500);
    }
  }
}

/** True when the element can be seen now: on, in the viewport, and not faded out by its parents. */
function isShown(el: Element): boolean {
  let opacity = 1;
  for (let e: Element | null = el; e; e = e.parentElement) {
    const cs = getComputedStyle(e);
    opacity *= parseFloat(cs.opacity);
    if (cs.visibility === "hidden" || cs.display === "none") return false;
  }
  const r = el.getBoundingClientRect();
  const slot = el.closest<HTMLElement>("[data-home-text]");
  const on =
    !slot || slot.dataset.on === "1" || slot.matches("section[data-home-text]:not([data-on])");
  return (
    on &&
    opacity > 0.6 &&
    r.width > 0 &&
    r.height > 0 &&
    r.bottom > 0 &&
    r.top < window.innerHeight &&
    r.right > 0 &&
    r.left < window.innerWidth
  );
}

async function shown(target: Locator): Promise<boolean> {
  return target.evaluate(isShown);
}

/** True when the element is part of the page as a reader sees it: it has a box, and nothing hid or faded it. */
function isReadable(el: Element): boolean {
  let opacity = 1;
  for (let e: Element | null = el; e; e = e.parentElement) {
    const cs = getComputedStyle(e);
    opacity *= parseFloat(cs.opacity);
    if (cs.visibility === "hidden" || cs.display === "none") return false;
  }
  const r = el.getBoundingClientRect();
  return opacity > 0.9 && r.width > 0 && r.height > 0;
}

/** The ten Aspirants of the list are plain, readable links on a page that has no stage. */
async function expectListReadable(page: Page): Promise<void> {
  const names = page.locator('[data-home-section="list"] [data-list-names] a');
  await expect(names).toHaveCount(10);
  for (const [i, [name]] of LIST_ORDER.entries()) {
    expect(await names.nth(i).evaluate(isReadable), `${name} of the list can be read`).toBe(true);
  }
}
