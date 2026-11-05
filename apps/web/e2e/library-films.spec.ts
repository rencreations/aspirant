import { expect, test, type Page } from "@playwright/test";

import { skipGate, url } from "./helpers";

/**
 * The Films room of the collection (`/collection/films/`): the featured film, the rows, the
 * filters and the search, the cinema view (scenes, start time, deep link) and the site's player
 * with English captions. The films themselves are in the library (R2, or the local mirror in
 * development), so the tests that play one skip when the library cannot be reached.
 */

test.describe.configure({ timeout: 120_000 });

const WE_BELIEVE = "film-layla-and-fanny-video-official-lore-trailer-trailer";
const DAY_OF_ENDERS = "film-selena-and-obsidia-video-trailer-001-3994447231709070185";
const DRAMA_3A2 = "film-vexana-and-guinevere-video-interactive-drama-3a2";

/** Console errors and uncaught exceptions. Files of the library origin belong to the pipeline, not to this code. */
function watch(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    if (msg.location().url.includes("/library/v1/")) return;
    errors.push(`${msg.text()} ${msg.location().url}`);
  });
  page.on("pageerror", (err) => errors.push(err.message));
  return errors;
}

async function open(page: Page, query = "") {
  await skipGate(page);
  const errors = watch(page);
  await page.goto(url(`/collection/films/${query}`));
  await expect(page.locator("[data-row]").first()).toBeAttached();
  return errors;
}

const dialog = (page: Page) => page.getByRole("dialog").first();

test("shows the room: one h1, the featured film, the rows in order and the parody last", async ({
  page,
}) => {
  const errors = await open(page);
  await expect(page.locator("h1")).toHaveText("Films");
  await expect(page.locator("#featured-title")).toBeVisible();

  const rows = await page
    .locator("section[data-row]")
    .evaluateAll((els) => els.map((e) => e.getAttribute("data-row")));
  expect(rows.length).toBeGreaterThanOrEqual(10);
  expect(rows[0]).toBe("trailers");
  expect(rows[rows.length - 1]).toBe("parody");
  expect(rows).toContain("link-design");
  expect(rows).toContain("link-fanart");
  // The two link rows sit just before the parody.
  expect(rows.slice(-3)).toEqual(["link-design", "link-fanart", "parody"]);

  const parody = page.locator('section[data-row="parody"]');
  await expect(parody.getByRole("note")).toContainText("parody");
  await expect(parody.getByRole("note")).toContainText("canon");
  expect(errors).toEqual([]);
});

test("links to Design and Fanart point at those rooms", async ({ page }) => {
  await open(page);
  await expect(page.locator('section[data-row="link-design"] a')).toHaveAttribute(
    "href",
    /\/collection\/design\/?$/,
  );
  await expect(page.locator('section[data-row="link-fanart"] a')).toHaveAttribute(
    "href",
    /\/collection\/fanart\/?$/,
  );
});

test("the drama row leads to Vexana's page", async ({ page }) => {
  await open(page);
  await expect(page.locator('section[data-row="drama"] a')).toHaveAttribute(
    "href",
    /\/character\/vexana\/?$/,
  );
});

test("searches, filters by character, pair and kind, and clears", async ({ page }) => {
  await open(page);
  const cards = page.locator("button[aria-label$='. Open']");
  const total = await cards.count();
  expect(total).toBeGreaterThan(40);

  await page.getByRole("searchbox").fill("believe");
  await expect(page).toHaveURL(/q=believe/);
  await expect(page.getByRole("button", { name: /^We Believe!\./ }).first()).toBeVisible();
  expect(await cards.count()).toBeLessThan(total);
  await expect(page.locator("#featured-title")).toHaveCount(0);

  await page.getByRole("searchbox").fill("zzzz nothing");
  await expect(page.getByText("No film matches")).toBeVisible();
  await page.getByRole("button", { name: "Clear the filters" }).click();
  await expect(page.getByRole("searchbox")).toHaveValue("");
  await expect(page.locator("#featured-title")).toBeVisible();

  await page.getByRole("button", { name: /^Filters/ }).click();
  await page
    .getByRole("group", { name: "Character" })
    .getByRole("button", { name: /^Ruby/ })
    .click();
  await expect(page).toHaveURL(/who=ruby/);
  expect(await cards.count()).toBeLessThan(total);

  await page
    .getByRole("group", { name: "Kind" })
    .getByRole("button", { name: /^Trailers/ })
    .click();
  await expect(page).toHaveURL(/kind=trailers/);
  await expect(page.locator("section[data-row]")).toHaveCount(1);
});

test("opens a film in the cinema view with its scenes, and Esc closes it", async ({ page }) => {
  const errors = await open(page);
  await page
    .getByRole("button", { name: /^We Believe!\./ })
    .first()
    .click();
  await expect(dialog(page)).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`i=${WE_BELIEVE}`));
  await expect(dialog(page).getByRole("heading", { level: 2 })).toHaveText("We Believe!");
  const scenes = dialog(page).getByRole("list").getByRole("button");
  expect(await scenes.count()).toBeGreaterThanOrEqual(10);
  // Nothing plays by itself: the player is not open.
  await expect(page.locator("video")).toHaveCount(0);

  await page.keyboard.press("Escape");
  await expect(dialog(page)).toHaveCount(0);
  await expect(page).not.toHaveURL(/i=/);
  expect(errors).toEqual([]);
});

test("a deep link with a start time opens the film primed at that second", async ({ page }) => {
  await open(page, `?i=${DAY_OF_ENDERS}&t=45`);
  await expect(dialog(page)).toBeVisible();
  await expect(dialog(page).getByText("Plays from 0:45")).toBeVisible();
  // The scene that holds 0:45 is the current one.
  await expect(dialog(page).locator("button[aria-current='true']")).toContainText("0:40");
  await expect(page.locator("video")).toHaveCount(0);
});

test("a film posted under a second id opens through that id", async ({ page }) => {
  await open(page, `?i=${DRAMA_3A2}`);
  await expect(dialog(page)).toBeVisible();
  await expect(dialog(page).getByRole("heading", { level: 2 })).toContainText("Where They Met");
  await expect(dialog(page).getByRole("link", { name: /Vexana/ })).toHaveAttribute(
    "href",
    /\/character\/vexana\/?$/,
  );
});

test("the parody card is marked as non-canon", async ({ page }) => {
  await open(page);
  const card = page.locator('section[data-row="parody"] button[aria-label$=". Open"]');
  await expect(card).toContainText("Non-canon parody");
  await card.click();
  await expect(dialog(page).getByRole("note")).toContainText("Nothing in it counts as canon");
});

test("a scene press opens the player at that second, with English captions", async ({ page }) => {
  const library = process.env.NEXT_PUBLIC_LIBRARY_ORIGIN ?? "https://s3.aspirant.cc";
  const errors = await open(page, `?i=${WE_BELIEVE}`);
  // The captions are fetched by the page, so the library must allow this origin (CORS).
  const reachable = await page.evaluate(
    (u) =>
      fetch(u).then(
        (r) => r.ok,
        () => false,
      ),
    `${library}/library/v1/films/${WE_BELIEVE}/en.vtt`,
  );
  test.skip(!reachable, "the library is not reachable from this page (network or CORS)");

  await expect(dialog(page)).toBeVisible();
  // The scene at 0:44 (the quiet field).
  await dialog(page).getByRole("button", { name: /0:44/ }).first().click();
  const video = page.locator("video");
  await expect(video).toHaveCount(1);
  await expect(video).toHaveAttribute("src", /#t=44\.6$/);
  // Playwright's own Chromium cannot always decode H.264: the checks that need frames or a loaded
  // track run only in a browser that says it can play it.
  const decodes = await page.evaluate(
    () => document.createElement("video").canPlayType('video/mp4; codecs="avc1.64001f"') !== "",
  );
  if (decodes) {
    await expect
      .poll(() => video.evaluate((v: HTMLVideoElement) => v.readyState), { timeout: 30_000 })
      .toBeGreaterThanOrEqual(1);
    const at = await video.evaluate((v: HTMLVideoElement) => v.currentTime);
    expect(at).toBeGreaterThan(40);
    // The English captions load as a track the page can read.
    await expect
      .poll(
        () =>
          video.evaluate((v: HTMLVideoElement) => {
            const track = v.textTracks[0];
            return track ? (track.cues?.length ?? 0) : 0;
          }),
        { timeout: 30_000 },
      )
      .toBeGreaterThan(5);
  }
  expect(errors).toEqual([]);

  // Esc closes the player first, and the cinema view stays.
  await page.keyboard.press("Escape");
  await expect(page.locator("video")).toHaveCount(0, { timeout: 10_000 });
  await expect(dialog(page)).toBeVisible();
});

test("the featured play button opens the player from the start, and Esc closes both layers", async ({
  page,
}) => {
  const library = process.env.NEXT_PUBLIC_LIBRARY_ORIGIN ?? "https://s3.aspirant.cc";
  const errors = await open(page);
  const reachable = await page.evaluate(
    (u) =>
      fetch(u, { method: "HEAD" }).then(
        (r) => r.ok,
        () => false,
      ),
    `${library}/library/v1/films/${DAY_OF_ENDERS}/video.mp4`,
  );
  test.skip(!reachable, "the library is not reachable from this page (network or CORS)");

  await page.getByRole("button", { name: "Play the film" }).click();
  const video = page.locator("video");
  await expect(video).toHaveCount(1, { timeout: 15_000 });
  expect(await video.getAttribute("src")).not.toContain("#t=");
  await expect(dialog(page)).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.locator("video")).toHaveCount(0, { timeout: 10_000 });
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page).not.toHaveURL(/i=/);
  expect(errors).toEqual([]);
});
