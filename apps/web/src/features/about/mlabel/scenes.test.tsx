import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { DIM, isScene, SCENES, type Track } from "./scenes";
import type { Key, Pose } from "./scrub";

vi.mock("@/components/transition/t-link", () => ({
  TLink: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: unknown;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children as never}
    </a>
  ),
}));

/** The pose an element is in at a point of its pass, when the keys on both sides agree. */
function around(keys: readonly Key[], at: number): [Pose | undefined, Pose | undefined] {
  const sorted = [...keys].sort((a, b) => a[0] - b[0]);
  const before = sorted.filter(([t]) => t <= at).at(-1)?.[1] ?? sorted[0]?.[1];
  const after = sorted.find(([t]) => t > at)?.[1] ?? sorted.at(-1)?.[1];
  return [before, after];
}

const AT_REST = (p: Pose | undefined) =>
  (p?.x ?? 0) === 0 &&
  (p?.y ?? 0) === 0 &&
  (p?.vw ?? 0) === 0 &&
  (p?.vh ?? 0) === 0 &&
  (p?.ry ?? 0) === 0 &&
  (p?.o ?? 1) === 1;

let host: HTMLElement;

beforeAll(async () => {
  const { LabelContent } = await import("./content");
  host = document.createElement("div");
  host.innerHTML = renderToStaticMarkup(<LabelContent />);
  document.body.append(host);
});

/** The parts, with the length each is given in the stylesheet (held) or a likely one (scrolled). */
function parts() {
  return Array.from(host.querySelectorAll<HTMLElement>("[data-scene]")).map((root) => {
    const held = Number.parseFloat(root.style.getPropertyValue("--len"));
    const len = Number.isFinite(held) ? held : 0.25;
    return { root, name: root.dataset.scene, len, span: 1 + len };
  });
}

function tracksOf(part: ReturnType<typeof parts>[number], narrow = false): Track[] {
  if (!isScene(part.name)) throw new Error(`no scene ${part.name ?? ""}`);
  return SCENES[part.name]({ root: part.root, span: part.span, len: part.len, narrow });
}

describe("TheMLabel's content", () => {
  it("is type only: no picture between the definition and the end", () => {
    const middle = Array.from(host.querySelectorAll("[data-label-part]")).filter(
      (el) => !["what", "end"].includes((el as HTMLElement).dataset.labelPart ?? ""),
    );
    expect(middle.map((el) => (el as HTMLElement).dataset.labelPart)).toEqual([
      "system",
      "collect",
      "rewards",
      "hall",
      "story",
    ]);
    for (const el of middle) expect(el.querySelectorAll("img, video, picture")).toHaveLength(0);
  });

  it("no longer carries the fan notice at its foot", () => {
    expect(host.textContent).not.toMatch(/Not affiliated with/);
  });

  it("gives every element that is marked to move exactly one track", () => {
    const moved = new Map<Element, number>();
    for (const part of parts()) {
      for (const { el } of tracksOf(part)) moved.set(el, (moved.get(el) ?? 0) + 1);
    }
    const marked = Array.from(host.querySelectorAll("[data-k]"));
    expect(marked.length).toBeGreaterThan(40);
    for (const el of marked) expect(moved.get(el), el.outerHTML.slice(0, 80)).toBe(1);
  });

  it("keeps every key of a part inside its pass", () => {
    for (const part of parts()) {
      for (const narrow of [false, true]) {
        for (const { keys } of tracksOf(part, narrow)) {
          for (const [at] of keys) {
            expect(at, part.name).toBeGreaterThanOrEqual(0);
            expect(at, part.name).toBeLessThanOrEqual(part.span);
          }
        }
      }
    }
  });

  it("shows a held part whole before it lets go of the screen", () => {
    for (const part of parts().filter((p) => p.len > 1)) {
      // The last point at which the part is still held with nothing leaving yet.
      const at = part.len - 0.32;
      for (const { el, keys } of tracksOf(part)) {
        const k = (el as HTMLElement).dataset.k ?? "";
        if (["ones", "tens"].includes(k)) continue;
        const [before, after] = around(keys, at);
        expect(AT_REST(before) && AT_REST(after), `${part.name} ${k}`).toBe(true);
      }
    }
  });

  it("counts a whole series, ten skins, before the reward line comes", () => {
    const collect = parts().find((p) => p.name === "collect");
    if (!collect) throw new Error("no collect part");
    const tracks = tracksOf(collect);
    const at = (k: string) => tracks.find((t) => (t.el as HTMLElement).dataset.k === k);
    const ones = at("ones")?.keys.at(-1);
    const tens = at("tens")?.keys.at(-1);
    expect(ones?.[1].y).toBeCloseTo((-100 * 10) / 11);
    expect(tens?.[1].y).toBeCloseTo(-50);
    const wipe = at("wipe")?.keys[0]?.[0] ?? 0;
    expect(wipe).toBeGreaterThanOrEqual(ones?.[0] ?? Infinity);
    expect(host.querySelectorAll('[data-k="tick"]')).toHaveLength(10);
  });

  it("shows a scrolled row whole in the middle of the screen", () => {
    for (const part of parts().filter((p) => p.name === "reward" || p.name === "rule")) {
      for (const { keys } of tracksOf(part)) {
        const [before, after] = around(keys, part.span / 2);
        expect(AT_REST(before) && AT_REST(after), part.name).toBe(true);
      }
    }
  });

  it("lights the story's item at the middle of the screen and dims it away from there", () => {
    const spot = parts().find((p) => p.name === "spot");
    if (!spot) throw new Error("no spot");
    const name = tracksOf(spot).find((t) => (t.el as HTMLElement).dataset.k === "spot-name");
    const [lit] = around(name?.keys ?? [], spot.span / 2);
    expect(lit?.o).toBe(1);
    const [early] = around(name?.keys ?? [], 0.32);
    expect(early?.o).toBe(DIM);
  });
});
