import { statSync } from "node:fs";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useHomeFlow } from "@/lib/home-flow";
import type { PreloadItem } from "@/lib/preload";

import { resetOpeningGate } from "./boot/preload";
import { SECTIONS } from "./kernel/sections";
import { homeItems } from "./preload-items";

/**
 * The loading list of the home is a contract with the loading screen: what the bar waits for is the
 * first screens and nothing else, every file is listed once, and what is not waited for downloads in
 * a set order. Changing the waited list is a decision (a heavier first load for every visitor), so a
 * new waited item has to be added here on purpose.
 */

/** Everything the home may make a visitor wait for, by id prefix or exact id. */
const WAITED_SITE = [
  /^chunk:/,
  /^field:(p|w):/,
  // The wall's extra thumbnails, one item for fifty small pictures.
  "field:tiles",
  // The first 24 pictures of the wall's pool (round three); the other 135 are deferred.
  "field:pool:first",
  "media:/models/about/drone.glb",
  "media:/img/home/drone-faces.webp",
  "media:/img/home/drone-faces-2.webp",
  "media:/img/home/marks.webp",
  "img:/img/home/mlbb.webp",
  "img:/img/about/themlabel.webp",
  "stream:home-trailer",
];

/** A document load adds what the opening carries in: the two Guinevere drones. */
const WAITED_OPENING = [...WAITED_SITE, "media:/models/about/companion.glb"];

const allowed = (id: string, list: Array<string | RegExp>) =>
  list.some((rule) => (typeof rule === "string" ? rule === id : rule.test(id)));

function listFor(arrival: "site" | "document"): PreloadItem[] {
  resetOpeningGate();
  useHomeFlow.setState(
    arrival === "document"
      ? { arrival: "document", phase: "cover" }
      : { arrival: "site", phase: "open" },
  );
  return homeItems();
}

/** The size of a file that lives in `public/`, or 0 for one that does not (the library's, in the bucket). */
function publicBytes(id: string): number {
  const match = /^(?:media|img|data):(\/.*)$/.exec(id);
  if (!match?.[1]) return 0;
  try {
    return statSync(path.join(process.cwd(), "public", match[1])).size;
  } catch {
    return 0;
  }
}

beforeEach(() => {
  resetOpeningGate();
});

afterEach(() => {
  useHomeFlow.setState({ arrival: "site", phase: "open" });
  resetOpeningGate();
});

describe("homeItems", () => {
  for (const arrival of ["site", "document"] as const) {
    describe(`on arrival "${arrival}"`, () => {
      it("lists every file once", () => {
        const ids = listFor(arrival).map((i) => i.id);
        expect(ids.filter((id, k) => ids.indexOf(id) !== k)).toEqual([]);
      });

      it("starts with the stage's own chunk (the opening's scene first on a document load)", () => {
        const items = listFor(arrival);
        const ids = items.map((i) => i.id);
        expect(ids).toContain("chunk:home-engine");
        if (arrival === "document") {
          // The drone's own files lead (a waiting visitor looks at it), the rest follows.
          expect(ids.slice(0, 6)).toContain("media:/models/about/drone.glb");
          expect(ids.indexOf("chunk:home-drone")).toBeLessThan(ids.indexOf("chunk:home-hero"));
        }
      });

      it("waits only for what the first screens need", () => {
        const waited = listFor(arrival).filter((i) => !i.deferred);
        const list = arrival === "document" ? WAITED_OPENING : WAITED_SITE;
        const strangers = waited.map((i) => i.id).filter((id) => !allowed(id, list));
        expect(strangers, "waited items nobody has decided on").toEqual([]);
        expect(waited.length).toBeLessThan(70);
      });

      it("waits for about as many bytes of the site's own files as the design says", () => {
        const waited = listFor(arrival).filter((i) => !i.deferred);
        const bytes = waited.reduce((sum, i) => sum + publicBytes(i.id), 0);
        // The pictures of the library (the eighteen wide cards, 2.4 MB) come from the bucket.
        expect(bytes / 1_048_576).toBeLessThan(4);
      });

      it("gives every deferred item a place in the queue", () => {
        const deferred = listFor(arrival).filter((i) => i.deferred);
        expect(deferred.length).toBeGreaterThan(80);
        for (const item of deferred) {
          expect(Number.isFinite(item.priority), `${item.id} has no priority`).toBe(true);
        }
      });
    });
  }

  it("keeps the first section's whole first screen waited, and the long films deferred", () => {
    const items = listFor("site");
    const byId = new Map(items.map((i) => [i.id, i]));
    expect(byId.get("chunk:home-hero")?.deferred).toBeFalsy();
    expect(byId.get("stream:home-trailer")?.deferred).toBeFalsy();
    // The ten previews, Silverbolt, the doll, Selena, the voice lines and the covers come later.
    for (const id of [
      "media:/models/home/silverbolt.glb",
      "media:/models/home/doll.glb",
      "music-disc-faces",
    ]) {
      expect(byId.get(id)?.deferred, id).toBe(true);
    }
    expect(items.some((i) => i.id.startsWith("media:/video/home/preview/v2/") && i.deferred)).toBe(
      true,
    );
    expect(items.some((i) => i.id.startsWith("home-voices:clips:") && i.deferred)).toBe(true);
  });

  it.each([false, true])("loads the Selena rig when the wide layout matches %s", (wide) => {
    const query = window.matchMedia("(min-width: 900px) and (orientation: landscape)");
    const media = vi.spyOn(window, "matchMedia").mockReturnValue({ ...query, matches: wide });
    try {
      const items = listFor("site");
      const rig = items.find((item) => item.id === "media:/models/home/selena-r7.glb");
      expect(rig?.deferred).toBe(wide ? true : undefined);
      expect(items.some((item) => item.id === "img:/img/home/cards/selena-45.webp")).toBe(true);
    } finally {
      media.mockRestore();
    }
  });

  it("takes every section's list into the aggregate", () => {
    const items = new Set(listFor("site").map((i) => i.id));
    for (const section of SECTIONS) {
      for (const item of section.preload()) {
        expect(items.has(item.id), `${section.id}: ${item.id}`).toBe(true);
      }
    }
  });
});
