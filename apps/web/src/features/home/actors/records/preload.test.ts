import { recordsItems } from "./preload";

describe("recordsItems", () => {
  it("lists the script, the music data and the covers, deferred by default", () => {
    const items = recordsItems();
    expect(items.map((i) => i.id)).toEqual([
      "chunk:home-records",
      "data:/data/library/music.json",
      "records-covers:10",
    ]);
    expect(items.every((i) => i.deferred === true && i.priority === 46)).toBe(true);
  });

  it("can be waited for, with its own count", () => {
    const items = recordsItems({ count: 7, deferred: false });
    expect(items.some((i) => i.id === "records-covers:7")).toBe(true);
    expect(items.every((i) => i.deferred !== true)).toBe(true);
  });
});
