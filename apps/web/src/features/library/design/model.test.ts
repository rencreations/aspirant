import { describe, expect, it } from "vitest";

import {
  captionParts,
  clock,
  formatDate,
  groupByYear,
  inkOn,
  justify,
  matchesQuery,
  passes,
  pairsOf,
  pickSize,
  ratioLabel,
  sizeLabel,
  spanLabel,
  targetHeight,
  NO_FILTERS,
} from "./model";
import type { DesignCampaign, DesignPost } from "./types";

function post(over: Partial<DesignPost> & { id: string }): DesignPost {
  return {
    title: "T",
    collection: "design",
    chars: ["ruby", "angela"],
    pair: "ruby-angela",
    canon: "official",
    tags: ["draw"],
    caption: "A caption",
    date: "2022-12-03",
    account: "@mobilelegendsgame",
    campaign: "c1",
    url: "https://example.com/p/1",
    kind: "poster",
    thumb: "t",
    credit: { by: null, platform: "Instagram", url: null },
    ...over,
  };
}

describe("justify", () => {
  const aspects = [1, 0.8, 0.8, 1.78, 1, 1, 0.56, 1, 0.8, 1];

  it("fills the width exactly in every full row and keeps the shapes", () => {
    const width = 1000;
    const rows = justify(aspects, width, 260, 10);
    expect(rows.flatMap((r) => r.items).map((i) => i.index)).toEqual(aspects.map((_, i) => i));
    rows.slice(0, -1).forEach((r) => {
      const used = r.items.reduce((n, i) => n + i.w, 0) + 10 * (r.items.length - 1);
      expect(used).toBe(width);
      r.items.forEach((it) => {
        const a = aspects[it.index] ?? 1;
        // Within a pixel of the true shape (the last item takes the rounding).
        expect(Math.abs(it.w / r.h - a)).toBeLessThan(0.03);
      });
    });
  });

  it("keeps the target height on a short last row", () => {
    const rows = justify([1, 1], 1200, 260, 10);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.h).toBe(260);
    expect(rows[0]?.items.map((i) => i.w)).toEqual([260, 260]);
  });

  it("returns nothing for no width or no pictures", () => {
    expect(justify([1], 0, 200, 10)).toEqual([]);
    expect(justify([], 800, 200, 10)).toEqual([]);
  });

  it("puts one very wide picture on its own row", () => {
    const rows = justify([4, 1, 1], 600, 200, 10);
    expect(rows[0]?.items).toHaveLength(1);
  });
});

describe("labels", () => {
  it("names the common shapes", () => {
    expect(ratioLabel(1080, 1080)).toBe("1:1");
    expect(ratioLabel(1080, 1350)).toBe("4:5");
    expect(ratioLabel(1080, 1920)).toBe("9:16");
    expect(ratioLabel(1920, 1080)).toBe("16:9");
    expect(ratioLabel(720, 377)).toBe("1.91:1");
  });

  it("writes sizes and times", () => {
    expect(sizeLabel(312)).toBe("312 KB");
    expect(sizeLabel(1536)).toBe("1.5 MB");
    expect(clock(64)).toBe("1:04");
  });

  it("writes dates without a time zone and spans without a dash", () => {
    expect(formatDate("2024-07-31")).toBe("31 Jul 2024");
    expect(spanLabel("2022-01-10", "2022-01-29")).toBe("10 to 29 Jan 2022");
    expect(spanLabel("2022-09-24", "2022-10-22")).toBe("24 Sep to 22 Oct 2022");
    expect(spanLabel("2022-12-12", "2023-01-11")).toBe("12 Dec 2022 to 11 Jan 2023");
    expect(spanLabel("2026-09-11", "2026-09-11")).toBe("11 Sep 2026");
    expect(spanLabel("2022-01-10", "2022-01-29")).not.toMatch(
      new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`),
    );
  });
});

describe("sizes", () => {
  it("uses the thumbnail until the picture needs more pixels", () => {
    expect(pickSize(300, 240, 1)).toBe("t");
    expect(pickSize(300, 240, 2)).toBe("p");
    expect(pickSize(1200, 800, 1)).toBe("p");
  });

  it("aims for taller rows on wide screens", () => {
    expect(targetHeight(350)).toBeLessThan(targetHeight(800));
    expect(targetHeight(1200)).toBeGreaterThan(targetHeight(800));
    expect(targetHeight(4000)).toBe(340);
  });
});

describe("filters", () => {
  const all = post({ id: "a", chars: ["fanny", "layla", "ruby", "angela"], pair: null });
  const hub = post({
    id: "b",
    chars: [
      "fanny",
      "layla",
      "ruby",
      "angela",
      "lesley",
      "change",
      "guinevere",
      "vexana",
      "obsidia",
      "selena",
    ],
    pair: null,
    kind: "reel",
    canon: "fan",
    tags: ["relationship"],
  });

  it("matches a mixed post to every pair that one of its characters is in", () => {
    expect(pairsOf(all)).toEqual(["fanny-layla", "ruby-angela"]);
    expect(pairsOf(hub)).toHaveLength(5);
    expect(passes(all, "x", { ...NO_FILTERS, pair: "ruby-angela" })).toBe(true);
    expect(passes(all, "x", { ...NO_FILTERS, pair: "selena-obsidia" })).toBe(false);
  });

  it("filters by character, year, format, canon and topic", () => {
    expect(passes(hub, "x", { ...NO_FILTERS, who: "selena" })).toBe(true);
    expect(passes(all, "x", { ...NO_FILTERS, who: "selena" })).toBe(false);
    expect(passes(all, "x", { ...NO_FILTERS, year: "2022" })).toBe(true);
    expect(passes(all, "x", { ...NO_FILTERS, year: "2023" })).toBe(false);
    expect(passes(hub, "x", { ...NO_FILTERS, fmt: "reel" })).toBe(true);
    expect(passes(all, "x", { ...NO_FILTERS, fmt: "reel" })).toBe(false);
    expect(passes(hub, "x", { ...NO_FILTERS, canon: "fan" })).toBe(true);
    expect(passes(all, "x", { ...NO_FILTERS, canon: "fan" })).toBe(false);
    expect(passes(hub, "x", { ...NO_FILTERS, topic: "relationship" })).toBe(true);
  });

  it("can leave one facet out, to count what its chips would give", () => {
    const f = { ...NO_FILTERS, fmt: "reel", year: "2022" };
    expect(passes(all, "x", f)).toBe(false);
    expect(passes(all, "x", f, "fmt")).toBe(true);
  });

  it("needs every word of a search", () => {
    expect(matchesQuery("the enders arrive on 10/09", "enders arrive")).toBe(true);
    expect(matchesQuery("the enders arrive", "enders obsidia")).toBe(false);
    expect(matchesQuery("anything", "")).toBe(true);
  });
});

describe("the timeline", () => {
  const campaigns: DesignCampaign[] = [
    {
      id: "b",
      title: "B",
      line: "",
      from: "2023-02-01",
      to: "2023-02-02",
      chars: [],
      posts: ["p3"],
    },
    {
      id: "a",
      title: "A",
      line: "",
      from: "2022-01-01",
      to: "2022-01-09",
      chars: [],
      posts: ["p1", "p2"],
    },
    {
      id: "c",
      title: "C",
      line: "",
      from: "2022-06-01",
      to: "2022-06-02",
      chars: [],
      posts: ["p4"],
    },
  ];
  const byId = new Map(["p1", "p2", "p3", "p4"].map((id) => [id, post({ id })] as const));

  it("groups campaigns under the year they began, oldest first", () => {
    const years = groupByYear(campaigns, byId, new Set(["p1", "p2", "p3", "p4"]), false);
    expect(years.map((y) => y.year)).toEqual(["2022", "2023"]);
    expect(years[0]?.campaigns.map((c) => c.campaign.id)).toEqual(["a", "c"]);
  });

  it("reverses everything for newest first and drops empty campaigns", () => {
    const years = groupByYear(campaigns, byId, new Set(["p1", "p2", "p3"]), true);
    expect(years.map((y) => y.year)).toEqual(["2023", "2022"]);
    expect(years[1]?.campaigns).toHaveLength(1);
    expect(years[1]?.campaigns[0]?.posts.map((p) => p.id)).toEqual(["p2", "p1"]);
  });
});

describe("text and colour", () => {
  it("marks the web addresses in a caption as links", () => {
    const parts = captionParts("First line.\n\nSee https://play.example.com/x/1. Then go.");
    expect(parts).toHaveLength(2);
    expect(parts[1]?.find((p) => p.href)?.href).toBe("https://play.example.com/x/1");
    expect(parts[1]?.map((p) => p.text).join("")).toBe(
      "See https://play.example.com/x/1. Then go.",
    );
  });

  it("picks readable ink", () => {
    expect(inkOn("#ffffff")).toBe("#0b0b0e");
    expect(inkOn("#101820")).toBe("#ffffff");
  });
});
