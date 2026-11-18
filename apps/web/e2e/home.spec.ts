import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

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
 * Most specs start with the opening switched off (`skipGate`): the opening has its own specs below
 * and in a11y.spec.ts. The page keeps downloading in the background (video, models, voice lines),
 * so nothing here waits for `networkidle`: it waits for what the home itself reports.
 */

interface HomeState {
  S: number;
  raw: number;
  total: number;
  unit: number;
  open: boolean;
  active: string | null;
  stage: { passes: string[]; failed: boolean; lost: boolean };
  sections: Array<{ id: string; mount: string; running: boolean; local: number }>;
  actors: Array<{ name: string; visible: boolean }>;
}

interface PlacedSection {
  id: string;
  start: number;
  screens: number;
}

type HomeWindow = {
  __home: {
    state(): HomeState;
    seek(s: number): void;
    sections(): PlacedSection[];
  };
};

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

/** The h2 of every section, in the order of the page. The names the page gives to a reader. */
const HEADINGS = [
  "The Aspirants",
  "Trailer",
  "Official animations for The Aspirants",
  "The five pairs",
  "In numbers",
  "2022 - Present",
  "Characters",
  "Immersive Interaction",
  "Voicelines",
  "Music",
  "What's going on?",
  "COMIC",
  "Fan art",
  "Artwork",
  "The archive",
  "About",
];

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

/** The owner's copy, exact. */
const COPY = [
  "original anime inspired skin series.",
  "A part of",
  "as the first featured series.",
  "Trailer video for the new Selena & Obsidia Aspirant skin.",
  "10 official animated films produced in the last 4 years.",
  "Official animations for",
  "2022 - Present",
  "Many collections from these 4+ years",
  "Try to hover",
  "Immersive Interaction",
  "Each model and animations are made with love that's written through interactive media.",
  "What's going on?",
  "Understand all The Aspirants story for all characters in one novel",
  "Layla & Fanny",
  "Ruby & Angela",
  "Lesley & Chang'e",
  "Guinevere & Vexana",
  "Selena & Obsidia",
  "Phases",
  "Characters",
  "Scroll more to see the about page",
];

/** The ten Aspirants of the list, in the owner's order. */
const LIST_ORDER = [
  ["Obsidia", "obsidia"],
  ["Fanny", "fanny"],
  ["Guinevere", "guinevere"],
  ["Angela", "angela"],
  ["Lesley", "lesley"],
  ["Layla", "layla"],
  ["Ruby", "ruby"],
  ["Vexana", "vexana"],
  ["Chang'e", "change"],
  ["Selena", "selena"],
] as const;

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
  await expect(page.getByRole("heading", { level: 1, name: "The Aspirants" })).toBeVisible();
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
  for (const [name, href] of LINKS) {
    await expect(page.getByRole("link", { name, exact: true }).first(), name).toHaveAttribute(
      "href",
      href,
    );
  }
  // The ten Aspirants of the list link to their pages, in the owner's order.
  const list = page.locator('[data-home-section="list"] a');
  await expect(list).toHaveCount(10);
  for (const [i, [name, slug]] of LIST_ORDER.entries()) {
    await expect(list.nth(i), name).toHaveText(name);
    await expect(list.nth(i), name).toHaveAttribute("href", new RegExp(`/character/${slug}/?$`));
  }
  await expect(page.locator('[data-home-section="bolt"] li')).toHaveCount(5);
  for (const text of COPY) {
    await expect(page.getByText(text, { exact: false }).first(), text).toBeAttached();
  }
  // Both comics and the ten rooms of the archive.
  await expect(
    page.locator('[data-home-section="chase"] a[href*="/collection/comic/"]'),
  ).toHaveCount(3);
  await expect(page.locator('[data-home-section="archive"] a')).toHaveCount(11);
  // Fan art and the 3D models carry the takedown shortcut.
  await expect(page.getByRole("link", { name: /Copyright or takedown/ }).first()).toBeAttached();
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
  await page.getByRole("button", { name: "Continue to About" }).click();
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
  await expect(page.getByRole("heading", { level: 1, name: "The Aspirants" })).toBeVisible();
});

test.describe("on the stage (WebGL)", () => {
  test("has one canvas, hidden from a reader, and the stage is running", async ({ page }) => {
    const errors = watchErrors(page);
    await openStage(page);
    const first = await state(page);
    expect(first.stage.failed).toBe(false);
    expect(first.sections).toHaveLength(16);
    expect(first.total).toBeGreaterThan(55);
    expect(first.total).toBeLessThan(70);
    // One canvas, on the home's own layer, and the reader's tree never sees it.
    await expect(page.locator("canvas[data-home-canvas]")).toHaveCount(1);
    await expect(page.locator("canvas[data-home-canvas]")).toHaveAttribute("aria-hidden", "true");
    expect(
      await page.evaluate(
        () => document.querySelectorAll("[data-home] canvas:not([data-home-canvas])").length,
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
    await openStage(page);
    const sections = await placed(page);
    expect(sections.map((s) => s.id)).toEqual([
      "hero",
      "aspirants",
      "rows",
      "strip",
      "bolt",
      "fall",
      "hand",
      "list",
      "selena",
      "voices",
      "music",
      "funny",
      "chase",
      "bend",
      "archive",
      "footer",
    ]);
    // The fixed sections, in the middle of each: it is the active one, its words are on and the
    // words of every other section are off (a hidden control never catches a press).
    for (const s of sections.filter((x) => x.id !== "footer")) {
      await seek(page, s.start + s.screens * 0.5);
      await expect.poll(async () => (await state(page)).active, { timeout: 20_000 }).toBe(s.id);
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
    const link = page.getByRole("link", { name: "See Collections", exact: true }).first();
    expect(await link.evaluate((el) => getComputedStyle(el).pointerEvents)).toBe("none");
    // And the one of the section that is on does.
    const near = page.getByRole("link", { name: "About Aspirant", exact: true });
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
    await page.getByRole("link", { name: "About Aspirant", exact: true }).focus();
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
    // "See All" shows only at the start of its section (the strip), not in the middle.
    const link = page.getByRole("link", { name: "See All", exact: true });
    await link.focus();
    await expect
      .poll(async () => (await state(page)).raw - strip.start, { timeout: 10_000 })
      .toBeLessThan(0.8);
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
    test.setTimeout(180_000);
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
      for (const control of [controls.first(), controls.last()]) {
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
        await expect.poll(async () => (await state(page)).active, { timeout: 20_000 }).toBe("hero");
        await control.focus();
        await expect
          .poll(async () => shown(control), {
            timeout: 20_000,
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
      if (stops.length > 8 && !stop.main && stops.some((s) => s.section === 15)) break;
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
    const play = page.getByRole("button", { name: "Play the trailer with sound" });
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
    expect(tops.length).toBeGreaterThanOrEqual(HEADINGS.length - 1);
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
    for (const [name, href] of LINKS) {
      await expect(page.getByRole("link", { name, exact: true }).first(), name).toHaveAttribute(
        "href",
        href,
      );
    }
    for (const text of COPY) {
      await expect(page.getByText(text, { exact: false }).first(), text).toBeAttached();
    }
    await expect(page.getByRole("heading", { name: "Immersive Interaction" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Read The Story", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "See all comics", exact: true })).toBeVisible();
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
      await gate.click();
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

    test("Enter and Space answer the gate as a press does", async ({ page }) => {
      test.setTimeout(150_000);
      await page.goto(url("/"));
      const gate = page.getByRole("button", { name: "Touch anywhere to continue" });
      await expect(gate).toBeVisible({ timeout: 90_000 });
      await page.keyboard.press("Enter");
      await expect(page.locator("#site-shell")).toHaveJSProperty("inert", false, {
        timeout: 90_000,
      });
    });

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
      await expect(page.getByRole("heading", { level: 1, name: "The Aspirants" })).toBeVisible();
    });
  });
});

/** Serious and critical axe violations of the page as it stands (once more if the page was reloaded under it). */
async function seriousViolations(page: Page): Promise<Array<{ id: string; nodes: string[] }>> {
  for (let attempt = 0; ; attempt++) {
    try {
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
async function shown(target: Locator): Promise<boolean> {
  return target.evaluate((el) => {
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
  });
}
