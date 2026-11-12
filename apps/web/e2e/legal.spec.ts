import { readFileSync } from "node:fs";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { skipGate, url } from "./helpers";

/**
 * The legal pages, the analytics question, the menu foot and the "Copyright or takedown" link
 * (`features/legal/`). Nothing reaches Google before Accept: every request to Google is caught here
 * and answered with an empty script.
 */
const EMAIL = "idham@creations.ren";
const NAME = "Muhammad Idham Ma'arif";
// The code host, the repository, the source code, and the old contact: none may be on a page.
const FORBIDDEN = new RegExp(
  ["git", "hub|ren", "creations|source", " code|shirasaka"].join(""),
  "i",
);
const GOOGLE = /googletagmanager\.com|google-analytics\.com/;
const GTM = "GTM-PZP9Q52J";

/** The id of the first item of a library data file that is a still picture (the Fanart file starts with videos). */
function firstPictureId(file: string): string {
  const data = JSON.parse(
    readFileSync(path.join(import.meta.dirname, "..", "public", "data", "library", file), "utf8"),
  ) as { items?: Array<{ id?: unknown; img?: unknown; video?: unknown }> };
  const picture = (data.items ?? []).find(
    (item) => typeof item.id === "string" && item.img !== undefined && item.video == null,
  );
  if (typeof picture?.id !== "string") throw new Error(`no picture in ${file}`);
  return picture.id;
}

/** Catch every request to Google. Returns the list that fills as they come. */
async function catchGoogle(page: Page): Promise<string[]> {
  const seen: string[] = [];
  await page.route(GOOGLE, async (route) => {
    seen.push(route.request().url());
    await route.fulfill({ status: 200, contentType: "text/javascript", body: "" });
  });
  return seen;
}

test.describe("the three legal pages", () => {
  for (const [route, heading] of [
    ["/terms/", "Terms of service"],
    ["/privacy/", "Privacy policy"],
    ["/takedown/", "Copyright and takedown"],
  ] as const) {
    test(`${route} names who runs the site and mentions no code host`, async ({ page }) => {
      await skipGate(page);
      await page.goto(url(route));
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading);
      const text = await page.locator("#main").innerText();
      expect(text).toContain(NAME);
      expect(text).toContain(EMAIL);
      expect(text).toContain("Senayan");
      expect(text).not.toMatch(FORBIDDEN);
      await expect(
        page.locator("#main a[href='/terms/'], #main a[href$='/terms/']").first(),
      ).toBeAttached();
    });
  }

  test("the terms say the owner owns only the technical work, and the privacy policy names the tools", async ({
    page,
  }) => {
    await skipGate(page);
    await page.goto(url("/terms/"));
    await expect(page.locator("#main")).toContainText(
      "We own the website's code and technical work",
    );
    await expect(page.locator("#main")).toContainText("within 7 days");
    await page.goto(url("/privacy/"));
    await expect(page.locator("#main")).toContainText("Cloudflare Web Analytics");
    await expect(page.locator("#main")).toContainText("Google Analytics 4");
    await expect(page.locator("#main")).toContainText("14 months");
    await expect(page.locator("#main")).toContainText("Moonton");
  });
});

test.describe("the analytics question", () => {
  test("asks once, sends nothing to Google until Accept, then loads the container", async ({
    page,
  }) => {
    const google = await catchGoogle(page);
    await skipGate(page, { asked: false });
    await page.goto(url("/terms/"));
    const banner = page.locator("[data-consent]");
    await expect(banner).toBeVisible({ timeout: 15_000 });
    await expect(banner.getByRole("button", { name: "Reject" })).toBeVisible();
    await expect(banner.getByRole("button", { name: "Accept" })).toBeVisible();
    expect(google).toEqual([]);

    await banner.getByRole("button", { name: "Accept" }).click();
    await expect(banner).toHaveCount(0);
    await expect.poll(() => google.length, { timeout: 15_000 }).toBeGreaterThan(0);
    expect(google[0]).toContain(GTM);

    // Consent Mode: advertising denied, analytics granted.
    const layer = await page.evaluate(() =>
      (window.dataLayer ?? []).map((entry) =>
        typeof entry === "object" && entry !== null && "length" in entry
          ? Array.from(entry as ArrayLike<unknown>)
          : entry,
      ),
    );
    const flat = JSON.stringify(layer);
    expect(flat).toContain('"ad_storage":"denied"');
    expect(flat).toContain('"ad_personalization":"denied"');
    expect(flat).toContain('"analytics_storage":"granted"');

    // Saved: a reload does not ask again.
    await page.reload();
    await page.waitForTimeout(2500);
    await expect(page.locator("[data-consent]")).toHaveCount(0);
  });

  test("Reject sends nothing and removes the cookies Google Analytics set", async ({ page }) => {
    const google = await catchGoogle(page);
    await skipGate(page, { asked: false });
    await page.goto(url("/terms/"));
    await page.evaluate(() => {
      document.cookie = "_ga=GA1.1.1.1; path=/";
      document.cookie = "_ga_7BHES29TV4=GS2.1.s1; path=/";
    });
    const banner = page.locator("[data-consent]");
    await expect(banner).toBeVisible({ timeout: 15_000 });
    await banner.getByRole("button", { name: "Reject" }).click();
    await expect(banner).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => document.cookie)).not.toContain("_ga");
    await page.waitForTimeout(1500);
    expect(google).toEqual([]);
    const saved = await page.evaluate(() => localStorage.getItem("aspirants:consent"));
    expect(saved).toContain('"rejected"');
  });

  test("a browser that sends Global Privacy Control is never asked and never counted", async ({
    page,
  }) => {
    const google = await catchGoogle(page);
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "globalPrivacyControl", { value: true });
    });
    await skipGate(page, { asked: false });
    await page.goto(url("/terms/"));
    await page.waitForTimeout(2500);
    await expect(page.locator("[data-consent]")).toHaveCount(0);
    expect(google).toEqual([]);
  });

  test("the menu has the legal links, the new line and Cookie settings, which asks again", async ({
    page,
  }) => {
    await skipGate(page);
    await page.goto(url("/terms/"));
    await page.getByRole("button", { name: /open menu/i }).click();
    const legal = page.getByRole("navigation", { name: "Legal" });
    await expect(legal).toBeVisible();
    await expect(legal.getByRole("link", { name: "Terms" })).toHaveAttribute("href", /\/terms\/?$/);
    await expect(legal.getByRole("link", { name: "Privacy" })).toHaveAttribute(
      "href",
      /\/privacy\/?$/,
    );
    const menu = page.locator("body");
    await expect(menu).not.toContainText("Resonance terminal");
    await expect(menu).not.toContainText("Selrick Academy / ");
    const wide = (page.viewportSize()?.width ?? 0) >= 900;
    if (wide) await expect(menu).toContainText("Made by MLBB Community");

    await legal.getByRole("button", { name: "Cookie settings" }).click();
    const banner = page.locator("[data-consent]");
    await expect(banner).toBeVisible({ timeout: 10_000 });
    await expect(banner).toContainText("Now: rejected");
  });
});

test.describe("the takedown page", () => {
  test("the link from an item names it, and the buttons wait for the three boxes", async ({
    page,
  }) => {
    await skipGate(page);
    await page.goto(
      url(
        "/takedown/?item=fanart-1&title=Moonlit+Layla&page=%2Fcollection%2Farts%2Ffanart%2F%3Fi%3Dfanart-1",
      ),
    );
    const items = page.getByLabel("What to take down");
    await expect(items).toHaveValue(/Moonlit Layla \(item fanart-1\)/);
    await expect(items).toHaveValue(/aspirant\.cc\/collection\/arts\/fanart\/\?i=fanart-1/);

    const mail = page.getByRole("link", { name: "Open in my email app" });
    await expect(mail).toHaveAttribute("aria-disabled", "true");
    await page.getByLabel("Your name").fill("Dewi Lestari");
    await page.getByLabel("Why").fill("I drew this and did not give permission.");
    await expect(mail).toHaveAttribute("aria-disabled", "false");
    const href = (await mail.getAttribute("href")) ?? "";
    expect(href.startsWith(`mailto:${EMAIL}?subject=`)).toBe(true);
    expect(decodeURIComponent(href)).toContain("Moonlit Layla");
    expect(decodeURIComponent(href)).toContain("Signed: Dewi Lestari");
    await expect(page.getByRole("link", { name: "Gmail" })).toHaveAttribute(
      "href",
      /^https:\/\/mail\.google\.com\//,
    );
    // No email or phone box: the mail they send carries the address we reply to.
    await expect(page.locator("#main input[type='email'], #main input[type='tel']")).toHaveCount(0);
    // Nothing typed went into the address, and it is not a form.
    expect(page.url()).not.toContain("Dewi");
    await expect(page.locator("#main form")).toHaveCount(0);
  });
});

test.describe("Copyright or takedown on an item", () => {
  const DIALOG = "[role='dialog'][data-zoom-viewer]";

  test("is on a fan picture and not on an official one", async ({ page }) => {
    await skipGate(page);
    const fan = firstPictureId("arts-fanart.json");
    await page.goto(url(`/collection/arts/fanart/?i=${fan}`));
    await expect(page.locator(DIALOG)).toBeVisible({ timeout: 60_000 });
    const link = page.locator(`${DIALOG} [data-report]`);
    await expect(link).toHaveText("Copyright or takedown");
    await expect(link).toHaveAttribute("href", new RegExp(`/takedown/?\\?item=${fan}`));

    const official = firstPictureId("arts-scene.json");
    await page.goto(url(`/collection/arts/scene/?i=${official}`));
    await expect(page.locator(DIALOG)).toBeVisible({ timeout: 60_000 });
    await expect(page.locator(`${DIALOG} [data-report]`)).toHaveCount(0);
  });

  test("is on every 3D model", async ({ page }) => {
    await skipGate(page);
    await page.goto(url("/collection/models/"));
    await expect(page.locator("#model-details [data-report]")).toBeAttached({ timeout: 60_000 });
    await expect(page.locator("#model-details [data-report]")).toHaveText("Copyright or takedown");
  });
});
