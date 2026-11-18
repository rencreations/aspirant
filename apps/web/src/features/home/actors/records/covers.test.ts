import { MAX_SLEEVES } from "./facts";
import { coverAddress, coverCrop, coverItems, pickTracks } from "./covers";

const record = (id: string, cover: Record<string, string>) => ({
  id,
  title: id.toUpperCase(),
  kind: "song",
  ep: null,
  src: `music/${id}.m4a`,
  dur: 100,
  cover,
});

describe("coverCrop", () => {
  it("shows a square picture whole", () => {
    expect(coverCrop(720, 720)).toEqual({ ox: 0, oy: 0, rx: 1, ry: 1 });
  });

  it("crops a wide picture to its middle square", () => {
    const c = coverCrop(800, 450);
    expect(c.ry).toBe(1);
    expect(c.rx).toBeCloseTo(450 / 800, 9);
    expect(c.ox).toBeCloseTo((1 - 450 / 800) / 2, 9);
    expect(c.oy).toBe(0);
    // the window stays inside the picture
    expect(c.ox + c.rx).toBeLessThanOrEqual(1 + 1e-12);
  });

  it("crops a tall picture to its middle square", () => {
    const c = coverCrop(300, 600);
    expect(c.rx).toBe(1);
    expect(c.ry).toBe(0.5);
    expect(c.oy).toBe(0.25);
  });

  it("does not divide by zero", () => {
    expect(coverCrop(0, 0)).toEqual({ ox: 0, oy: 0, rx: 1, ry: 1 });
  });
});

describe("coverAddress", () => {
  it("reads the 720 px library picture first", () => {
    expect(coverAddress({ t: "a/t.webp", p: "a/p.webp" })).toMatch(/a\/p\.webp$/);
    expect(coverAddress({ t: "a/t.webp" })).toMatch(/a\/t\.webp$/);
  });

  it("reads a picture of the site", () => {
    expect(coverAddress({ site: "img/char/vexana/splash-sm.webp" })).toMatch(
      /\/img\/char\/vexana\/splash-sm\.webp$/,
    );
  });

  it("is empty when the data has no cover", () => {
    expect(coverAddress({})).toBe("");
  });
});

describe("pickTracks", () => {
  const items = [
    record("a", { p: "x/a.webp", c: "#112233" }),
    record("b", {}),
    record("c", { site: "img/c.webp" }),
    record("d", { t: "x/d.webp" }),
  ];

  it("returns the first tracks that have a cover, in order", () => {
    const tracks = pickTracks(items, 10);
    expect(tracks.map((t) => t.id)).toEqual(["a", "c", "d"]);
    expect(tracks[0]!.color).toBe("#112233");
    expect(tracks[1]!.color).toBeNull();
    expect(tracks[0]!.audio).toMatch(/music\/a\.m4a$/);
  });

  it("stops at the count", () => {
    expect(pickTracks(items, 2).map((t) => t.id)).toEqual(["a", "c"]);
    expect(pickTracks(items, 0)).toEqual([]);
  });

  it("never returns more than the crate holds", () => {
    const many = Array.from({ length: 30 }, (_, i) => record(`t${i}`, { p: `x/${i}.webp` }));
    expect(pickTracks(many, 100)).toHaveLength(MAX_SLEEVES);
  });
});

describe("coverItems", () => {
  it("lists the data and the covers, deferred by default", () => {
    const items = coverItems();
    expect(items).toHaveLength(2);
    expect(items[0]!.id).toBe("data:/data/library/music.json");
    expect(items[1]!.id).toBe("records-covers:10");
    expect(items.every((i) => i.deferred === true && i.priority === 46)).toBe(true);
  });

  it("can be waited for, and keyed by the count", () => {
    const items = coverItems({ count: 7, deferred: false });
    expect(items[1]!.id).toBe("records-covers:7");
    expect(items.every((i) => i.deferred !== true)).toBe(true);
  });
});
