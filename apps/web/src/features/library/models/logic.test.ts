import { describe, expect, it } from "vitest";

import {
  clipRows,
  clipsOf,
  fetchOrder,
  formOfClip,
  mergeKeyTimes,
  nearestKey,
  placeOf,
  stepIndex,
} from "./logic";

const entries = [
  { id: "models-selena", views: [{ id: "selena-in-game" }, { id: "selena-entrance" }] },
  { id: "models-fanny", views: [{ id: "fanny" }, { id: "fanny-blade" }] },
] as never;

describe("the place in the list", () => {
  it("opens on the first view of the first entry", () => {
    expect(placeOf(entries, "", "")).toEqual({ entry: 0, view: 0 });
  });

  it("reads the entry and the view of the address", () => {
    expect(placeOf(entries, "models-fanny", "fanny-blade")).toEqual({ entry: 1, view: 1 });
    expect(placeOf(entries, "models-fanny", "nope")).toEqual({ entry: 1, view: 0 });
  });

  it("finds the entry of a view named alone", () => {
    expect(placeOf(entries, "", "selena-entrance")).toEqual({ entry: 0, view: 1 });
  });

  it("goes round the ends", () => {
    expect(stepIndex(0, -1, 15)).toBe(14);
    expect(stepIndex(14, 1, 15)).toBe(0);
  });

  it("fetches the nearest views first", () => {
    expect(fetchOrder(5, 2)).toEqual([2, 3, 1, 4, 0]);
  });
});

describe("the clip list", () => {
  const clips = [
    { id: "idle", label: "Idle" },
    { id: "phone-in", label: "Idle to Phone", group: "phone", groupLabel: "Phone" },
    { id: "phone-loop", label: "Phone Loop", group: "phone", groupLabel: "Phone" },
    { id: "interaction-1", label: "Interaction 1" },
  ];

  it("folds a group into one row where its first clip stands", () => {
    const rows = clipRows(clips);
    expect(rows.map((r) => r.kind)).toEqual(["clip", "group", "clip"]);
    const group = rows[1];
    expect(group?.kind === "group" ? group.clips.map((c) => c.id) : []).toEqual([
      "phone-in",
      "phone-loop",
    ]);
  });

  it("lists the clips of the form on show", () => {
    const view = {
      forms: [
        { id: "normal", label: "Normal", clips: [{ id: "normal/idle", label: "Idle" }] },
        { id: "abyssal", label: "Abyssal", clips: [{ id: "abyssal/idle", label: "Idle" }] },
      ],
    };
    expect(clipsOf(view, "abyssal")[0]?.id).toBe("abyssal/idle");
    expect(clipsOf(view)[0]?.id).toBe("normal/idle");
    expect(formOfClip("abyssal/idle")).toBe("abyssal");
  });
});

describe("the keys of a clip", () => {
  it("merges the tracks' times into one sorted list", () => {
    const keys = mergeKeyTimes(
      [
        [0, 0.5, 1],
        [0, 0.25, 0.5000001, 1],
      ],
      1,
    );
    expect(keys).toEqual([0, 0.25, 0.5, 1]);
  });

  it("finds the nearest key", () => {
    expect(nearestKey([0, 0.25, 0.5, 1], 0.6)).toBe(2);
    expect(nearestKey([0, 0.25, 0.5, 1], 0.9)).toBe(3);
    expect(nearestKey([], 1)).toBe(0);
  });
});
