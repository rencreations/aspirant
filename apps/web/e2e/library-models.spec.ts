import { expect, test, type Page } from "@playwright/test";

import { skipGate, url, watchErrors } from "./helpers";

/**
 * The 3D Models room (shelf slot 05), rebuilt on 25 Nov 2026: one model at a time on a stage that
 * fills the screen, a list of fifteen entries (each with its views), the animations of a view on the
 * right and a timeline at the foot. The model is drawn by WebGL, so the stage's `data-status` says
 * when it is ready. On a narrow screen the list and the animations are sheets.
 */

test.describe.configure({ timeout: 150_000 });

async function open(page: Page, query = "") {
  await skipGate(page);
  const errors = watchErrors(page);
  await page.goto(url(`/collection/models/${query}`));
  await expect(page.locator("h1")).toHaveText("3D Models", { timeout: 60_000 });
  return errors;
}

const stage = (page: Page) => page.getByTestId("model-stage");
const entries = (page: Page) => page.locator("[data-model-entry]");
const narrow = (page: Page) => (page.viewportSize()?.width ?? 1440) <= 991;

async function stageReady(page: Page) {
  await expect(stage(page)).toHaveAttribute("data-status", "ready", { timeout: 90_000 });
}

/** On a narrow screen the list is a sheet: open it. On a wide one it is always there. */
async function openList(page: Page) {
  if (!narrow(page)) return;
  await page.getByRole("button", { name: "Models", exact: true }).click();
  await expect(page.locator("[data-sheet-panel='models']")).not.toHaveAttribute("inert");
}

/** The same for the animations. */
async function openClips(page: Page) {
  if (!narrow(page)) return;
  await page.getByRole("button", { name: "Animation", exact: true }).click();
  await expect(page.locator("[data-sheet-panel='clips']")).not.toHaveAttribute("inert");
}

/** Make a page report that it has no WebGL (a context is never given). */
async function withoutWebGL(page: Page) {
  await page.addInitScript(() => {
    // The page's own call is kept and called with its `this`.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const method = HTMLCanvasElement.prototype.getContext;
    const original = method as unknown as (this: HTMLCanvasElement, ...args: unknown[]) => unknown;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      type: string,
      ...rest: unknown[]
    ) {
      if (type.includes("webgl")) return null;
      return original.call(this, type, ...rest);
    } as typeof HTMLCanvasElement.prototype.getContext;
  });
}

test("opens on Selena with her name and title only, the list of fifteen and the way out", async ({
  page,
}) => {
  const errors = await open(page);
  await stageReady(page);
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 2 })).toHaveText("Selena");
  await expect(page.locator("[data-models-title]")).toContainText("Silverbolt Raiko");
  await expect(entries(page)).toHaveCount(15);
  await expect(entries(page).first()).toHaveAttribute("aria-current", "true");
  await expect(stage(page).locator("canvas")).toHaveCount(1);
  await expect(page.locator("[data-room-back]")).toHaveAttribute("href", /\/collection\/?$/);
  await expect(page.locator("[data-models-foot] [data-report]")).toHaveText(
    "Copyright or takedown",
  );
  // Nothing technical, and no zoom buttons: the wheel and a pinch zoom.
  for (const word of [/triangles/i, /points/i, /format/i, /download/i]) {
    await expect(page.getByText(word)).toHaveCount(0);
  }
  await expect(page.getByRole("button", { name: /zoom/i })).toHaveCount(0);
  expect(errors.filter((e) => !e.includes("Failed to load resource"))).toEqual([]);
});

test("the room is one screen: the page never scrolls", async ({ page }) => {
  await open(page);
  await stageReady(page);
  const over = await page.evaluate(() => {
    const el = document.scrollingElement ?? document.documentElement;
    return { y: el.scrollHeight - el.clientHeight, x: el.scrollWidth - el.clientWidth };
  });
  expect(over.y).toBeLessThanOrEqual(1);
  expect(over.x).toBeLessThanOrEqual(1);
});

test("an entry and its views are picked from the list, in the address, with no history entry", async ({
  page,
}) => {
  await open(page);
  await stageReady(page);
  const before = await page.evaluate(() => history.length);
  await openList(page);
  await page.locator("[data-model-entry='models-fanny']").click();
  await expect(page).toHaveURL(/[?&]i=models-fanny/);
  await expect(page.getByRole("heading", { level: 2 })).toHaveText("Fanny");
  await expect(page.locator("[data-models-title]")).toContainText("Blade of Kibou");
  await stageReady(page);
  const blade = narrow(page)
    ? page.locator("[data-models-foot]").getByRole("button", { name: "Blade", exact: true })
    : page.locator("[data-model-view='fanny-blade']");
  await blade.click();
  await expect(page).toHaveURL(/[?&]v=fanny-blade/);
  await expect(page.getByRole("heading", { level: 2 })).toHaveText("Blade");
  await stageReady(page);
  expect(await page.evaluate(() => history.length)).toBe(before);
});

test("a link to a view opens it, and the links of the first room still work", async ({ page }) => {
  await open(page, "?v=change-moon");
  await expect(page.getByRole("heading", { level: 2 })).toHaveText("Crescent Moon");
  await stageReady(page);
  await page.goto(url("/collection/models/?i=models-vexana-eternal-guard"));
  await expect(page.getByRole("heading", { level: 2 })).toHaveText("Eternal Guard");
  await page.goto(url("/collection/models/?i=models-aspirant-drone"));
  await expect(page.getByRole("heading", { level: 2 })).toHaveText("Aspirant Drone");
});

test("Selena In Game: her clips, the timeline, Space, and the change to her abyssal form", async ({
  page,
}) => {
  await open(page);
  await stageReady(page);
  await openClips(page);
  const clips = page.locator("[data-models-clips]");
  await expect(clips.locator("[data-model-form]")).toHaveCount(2);
  await expect(clips.locator("[data-model-clip='normal/idle']")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(clips.locator("[data-model-clip]")).toHaveCount(14);
  const timeline = page.locator("[data-models-timeline]");
  await expect(timeline.getByRole("slider", { name: "Timeline" })).toBeVisible();
  const play = timeline.locator("[data-model-play]");
  await expect(play).toHaveAttribute("data-model-play", "playing");
  await clips.locator("[data-model-clip='normal/run']").click();
  await expect(clips.locator("[data-model-clip='normal/run']")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  if (narrow(page)) await page.keyboard.press("Escape");
  // Space on a button presses the button; anywhere else it plays and pauses.
  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur();
  });
  await page.keyboard.press("Space");
  await expect(play).toHaveAttribute("data-model-play", "paused");
  await page.keyboard.press("Space");
  await expect(play).toHaveAttribute("data-model-play", "playing");
  // The change: the switch waits while it runs, then the abyssal clips are listed.
  await openClips(page);
  await clips.locator("[data-model-form='abyssal']").click();
  await expect(clips.locator("[data-model-form='abyssal']")).toHaveAttribute(
    "aria-pressed",
    "true",
    {
      timeout: 30_000,
    },
  );
  await expect(clips.locator("[data-model-form='normal']")).toBeEnabled({ timeout: 30_000 });
  await expect(clips.locator("[data-model-clip]")).toHaveCount(9);
  await expect(clips.locator("[data-model-clip='abyssal/idle']")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("Selena Entrance: In, Loop and Out are one dropdown, and the camera has its way back", async ({
  page,
}) => {
  await open(page, "?v=selena-entrance");
  await stageReady(page);
  await openClips(page);
  const clips = page.locator("[data-models-clips]");
  await expect(clips.locator("[data-model-clip='idle']")).toHaveAttribute("aria-pressed", "true");
  const phone = clips.locator("[data-model-group='phone']");
  await expect(phone).toHaveAttribute("aria-expanded", "false");
  await phone.click();
  await expect(phone).toHaveAttribute("aria-expanded", "true");
  await expect(clips.locator("#clips-phone [data-model-clip]")).toHaveCount(3);
  await clips.locator("[data-model-clip='phone-loop']").click();
  await expect(clips.locator("[data-model-clip='phone-loop']")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  if (narrow(page)) await page.keyboard.press("Escape");
  await expect(page.locator("[data-model-reset]")).toHaveText("Default camera");
});

test("without WebGL the stage shows the picture of the model, and the list still works", async ({
  page,
}) => {
  await withoutWebGL(page);
  await open(page);
  await expect(stage(page)).toHaveAttribute("data-status", "nogl", { timeout: 60_000 });
  await expect(page.getByText("This browser cannot draw 3D")).toBeVisible();
  await expect(page.getByRole("img", { name: "Selena, the 3D model" })).toBeVisible();
  await openList(page);
  await page.locator("[data-model-entry='models-layla']").click();
  await expect(page.getByRole("img", { name: "Layla, the 3D model" })).toBeVisible();
});

test("a model that is gone shows its picture and Try again brings it back", async ({ page }) => {
  await page.route("**/models/v1/selena-in-game.glb", (route) =>
    route.fulfill({ status: 404, body: "" }),
  );
  await open(page);
  await expect(stage(page)).toHaveAttribute("data-status", "failed", { timeout: 60_000 });
  await expect(page.getByText("The model could not be shown.")).toBeVisible();
  await page.unroute("**/models/v1/selena-in-game.glb");
  await page.getByRole("button", { name: "Try again" }).click();
  await stageReady(page);
});

test("on a narrow screen the list is a sheet that opens, closes with Escape and is out of reach when shut", async ({
  page,
}) => {
  test.skip(!narrow(page), "The list is a sheet only on a narrow screen.");
  await open(page);
  await stageReady(page);
  const sheet = page.locator("[data-sheet-panel='models']");
  await expect(sheet).toHaveAttribute("inert");
  await openList(page);
  await page.keyboard.press("Escape");
  await expect(sheet).toHaveAttribute("inert");
});
