import { expect, test, type Page } from "@playwright/test";

import { skipGate, url, watchErrors } from "./helpers";

/**
 * The 3D Models room (shelf slot 05): nine game client models on a turntable that fills the screen.
 * The model is drawn by WebGL, so the stage's `data-status` says when it is ready. On a narrow
 * screen the facts, layers and faces are a sheet that the Details button opens.
 */

test.describe.configure({ timeout: 120_000 });

async function open(page: Page, query = "") {
  await skipGate(page);
  const errors = watchErrors(page);
  await page.goto(url(`/collection/models/${query}`));
  await expect(page.locator("h1")).toHaveText("3D Models", { timeout: 60_000 });
  return errors;
}

const stage = (page: Page) => page.getByTestId("model-stage");
const plates = (page: Page) => page.getByTestId("model-picker").getByRole("button");

async function stageReady(page: Page) {
  await expect(stage(page)).toHaveAttribute("data-status", "ready", { timeout: 60_000 });
}

/** The layers and faces are in a sheet on a narrow screen: open it. On a wide one they are always there. */
async function details(page: Page) {
  const button = page.getByRole("button", { name: "Details" });
  if (await button.isVisible()) {
    await button.click();
    await expect(page.locator("#model-details")).toHaveAttribute("data-open", "true");
  }
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

test("draws the first model with its name, one h1, nine plates and the way out", async ({
  page,
}) => {
  const errors = await open(page);
  await stageReady(page);
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 2 })).toHaveText("Fanny");
  await expect(plates(page)).toHaveCount(9);
  await expect(plates(page).first()).toHaveAttribute("aria-pressed", "true");
  await expect(stage(page).locator("canvas")).toHaveCount(1);
  await expect(page.getByText("01 / 09")).toBeVisible();
  await expect(page.locator("[data-room-back]")).toHaveAttribute("href", /\/collection\/?$/);
  await expect(page.getByRole("link", { name: "takedown page" })).toHaveAttribute(
    "href",
    /\/takedown\/?$/,
  );
  expect(errors.filter((e) => !e.includes("Failed to load resource"))).toEqual([]);
});

test("the room is one screen: the page never scrolls", async ({ page }) => {
  await open(page);
  await stageReady(page);
  const over = await page.evaluate(() => {
    const el = document.scrollingElement ?? document.documentElement;
    return { y: el.scrollHeight - el.clientHeight, x: el.scrollWidth - el.clientWidth };
  });
  expect(over.y).toBeLessThanOrEqual(0);
  expect(over.x).toBeLessThanOrEqual(0);
});

test("switches layers, changes the robot's face and changes model", async ({ page }) => {
  await open(page);
  await stageReady(page);
  await details(page);

  const weapon = page.getByRole("switch", { name: "Weapon" });
  await expect(weapon).toHaveAttribute("aria-checked", "true");
  await weapon.click();
  await expect(weapon).toHaveAttribute("aria-checked", "false");

  // The numbers on the sheets are 1 (the one the model came with) to 9.
  const sheet4 = page.getByRole("button", { name: "Robot face, sheet 4" });
  await expect(sheet4).toBeEnabled();
  await sheet4.click();
  await expect(sheet4).toHaveAttribute("aria-pressed", "true");

  // A model that is picked starts with its layers on again.
  await page.keyboard.press("Escape");
  await plates(page).nth(1).click();
  await expect(page).toHaveURL(/i=models-layla/);
  await stageReady(page);
  await expect(page.getByRole("heading", { level: 2 })).toHaveText("Layla");
  await expect(plates(page).nth(1)).toHaveAttribute("aria-pressed", "true");
  await details(page);
  await expect(page.getByRole("switch", { name: "Weapon" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  // The room says what these are: game client models, used as a visual reference.
  await expect(page.getByText("taken from the game client")).toBeVisible();
});

test("each model has only the switches it really has, and loads when it is picked", async ({
  page,
}) => {
  await open(page);
  await stageReady(page);
  await details(page);

  // Fanny and Layla have a robot with a face screen: three switches and nine face sheets.
  await expect(page.getByRole("switch")).toHaveCount(3);
  await expect(page.getByRole("group", { name: "Robot face" })).toBeVisible();
  await page.keyboard.press("Escape");

  // Ruby is a plain OBJ with a weapon and no robot.
  await plates(page).nth(2).click();
  await expect(page).toHaveURL(/i=models-ruby/);
  await stageReady(page);
  await details(page);
  await expect(page.getByRole("switch")).toHaveCount(2);
  await expect(page.getByRole("switch", { name: "Weapon" })).toBeVisible();
  await expect(page.getByRole("group", { name: "Robot face" })).toHaveCount(0);
  await page.keyboard.press("Escape");

  // Angela is an FBX with a robot but no weapon.
  await plates(page).nth(3).click();
  await stageReady(page);
  await details(page);
  await expect(page.getByRole("switch", { name: "Robot" })).toBeVisible();
  await expect(page.getByRole("switch", { name: "Weapon" })).toHaveCount(0);
  await page.keyboard.press("Escape");

  // The second Vexana model is the Eternal Guard.
  await plates(page).nth(8).click();
  await expect(page).toHaveURL(/i=models-vexana-eternal-guard/);
  await stageReady(page);
  await expect(page.getByText("Eternal Guard").first()).toBeVisible();
});

test("a link to a model opens the stage on it", async ({ page }) => {
  await open(page, "?i=models-guinevere");
  await stageReady(page);
  await expect(page.getByRole("heading", { level: 2 })).toHaveText("Guinevere");
  await expect(plates(page).nth(6)).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("07 / 09")).toBeVisible();
});

test("a link from before the models moved still finds them", async ({ page }) => {
  await skipGate(page);
  await page.goto(url("/collection/others/?i=others-3d-layla"));
  await expect(page).toHaveURL(/\/collection\/models\/\?i=models-layla/, { timeout: 60_000 });
  await expect(page.locator("h1")).toHaveText("3D Models", { timeout: 60_000 });
});

test("N and P change model round the ends, and the keys turn, zoom and reset", async ({ page }) => {
  await open(page);
  await stageReady(page);
  await page.keyboard.press("n");
  await expect(page.getByRole("heading", { level: 2 })).toHaveText("Layla");
  await stageReady(page);
  await page.keyboard.press("p");
  await page.keyboard.press("p");
  await expect(page.getByRole("heading", { level: 2 })).toHaveText("Vexana");
  await expect(page.getByText("09 / 09")).toBeVisible();
  await stageReady(page);

  const read = page.locator("p", { hasText: /Zoom \d\.\dx/ });
  await page.keyboard.press("+");
  await expect(read).toContainText(/Zoom 1\.[1-9]x/i);
  await page.keyboard.press("0");
  await expect(read).toContainText(/Zoom 1\.0x/i);
  const before = await read.textContent();
  await page.keyboard.press("ArrowRight");
  await expect(read).not.toHaveText(before ?? "");
});

test("the buttons zoom, stop the turn and frame every part", async ({ page }) => {
  await open(page);
  await stageReady(page);
  const read = page.locator("p", { hasText: /Zoom \d\.\dx/ });
  await page.getByRole("button", { name: "Zoom in" }).click();
  await expect(read).toContainText(/Zoom 1\.[1-9]x/i);
  await page.getByRole("button", { name: "Reset view" }).click();
  const turn = page.getByRole("button", { name: "Auto turn: on" });
  await expect(turn).toHaveAttribute("aria-pressed", "true");
  await turn.click();
  await expect(page.getByRole("button", { name: "Auto turn: off" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await details(page);
  const all = page.getByRole("button", { name: "Frame every part" });
  await all.click();
  await expect(all).toHaveAttribute("aria-pressed", "true");
});

test("without WebGL the stage shows the picture of the model, and the plates still work", async ({
  page,
}) => {
  await withoutWebGL(page);
  await open(page);
  await expect(stage(page)).toHaveAttribute("data-status", "nogl", { timeout: 60_000 });
  await expect(page.getByRole("img", { name: "Fanny, the 3D model" })).toBeVisible();
  await expect(page.getByText("This browser cannot draw 3D")).toBeVisible();
  await expect(stage(page).locator("canvas")).toHaveCount(0);
  await plates(page).nth(2).click();
  await expect(page.getByRole("img", { name: "Ruby, Mecha Maiden, the 3D model" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2 })).toHaveText("Ruby");
});

test("a model that is gone shows its picture and Try again brings it back", async ({ page }) => {
  await page.route("**/others/3d/fanny/hero_fanny_skin09_high_add.obj", (route) =>
    route.fulfill({ status: 404, body: "" }),
  );
  await open(page);
  await expect(stage(page)).toHaveAttribute("data-status", "failed", { timeout: 60_000 });
  await expect(page.getByText("The model could not be shown.")).toBeVisible();
  await expect(page.getByRole("img", { name: "Fanny, the 3D model" })).toBeVisible();
  await page.unroute("**/others/3d/fanny/hero_fanny_skin09_high_add.obj");
  await page.getByRole("button", { name: "Try again" }).click();
  await stageReady(page);
  await expect(page.getByText("The model could not be shown.")).toHaveCount(0);
});

test("the details sheet opens from a button on a narrow screen, closes with Escape and is out of reach when shut", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  await stageReady(page);
  const sheet = page.locator("#model-details");
  await expect(sheet).toHaveAttribute("data-open", "false");
  await expect(sheet).toHaveAttribute("inert", "");
  const button = page.getByRole("button", { name: "Details" });
  await button.click();
  await expect(sheet).toHaveAttribute("data-open", "true");
  await expect(button).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("button", { name: "Close" })).toBeFocused();
  await expect(page.getByText("Triangles")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(sheet).toHaveAttribute("data-open", "false");
  await expect(button).toBeFocused();
  // No horizontal scroll, and the plates stay inside the row.
  const over = await page.evaluate(() => {
    const el = document.scrollingElement ?? document.documentElement;
    return el.scrollWidth - el.clientWidth;
  });
  expect(over).toBeLessThanOrEqual(0);
});

test("on a wide screen the facts and the layers are always there, with no sheet button", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page);
  await stageReady(page);
  await expect(page.getByRole("button", { name: "Details" })).toBeHidden();
  await expect(page.getByText("Triangles")).toBeVisible();
  await expect(page.getByRole("switch", { name: "Body, face and hair" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Frame every part" })).toBeVisible();
});
