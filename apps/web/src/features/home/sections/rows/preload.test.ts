import { describe, expect, it } from "vitest";

import { aggregateItems, splitItems } from "../../kernel/preload";
import { section as rows } from "./index";
import { section as strip } from "../strip";

describe("the loading lists of the rows and the strip", () => {
  const all = aggregateItems([rows, strip]);
  const { waited, deferred } = splitItems(all);

  it("wait for the scene code of both sections, the film's code and the first seconds of the trailer", () => {
    const ids = waited.map((i) => i.id);
    expect(ids).toContain("chunk:home-rows");
    expect(ids).toContain("chunk:home-strip");
    expect(ids).toContain("chunk:home-film");
    expect(ids).toContain("stream:home-trailer");
  });

  it("keep the ten preview clips behind everything, in a fixed order", () => {
    const clips = deferred.filter((i) => i.id.includes("preview/"));
    expect(clips).toHaveLength(10);
    const priorities = clips.map((i) => i.priority ?? 0);
    expect(priorities).toEqual([...priorities].sort((a, b) => a - b));
  });

  it("list an item once even though both sections ask for the film", () => {
    const ids = all.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("never wait for the whole trailer that the play button opens", () => {
    expect(all.some((i) => i.id.includes("video/films/"))).toBe(false);
  });
});
