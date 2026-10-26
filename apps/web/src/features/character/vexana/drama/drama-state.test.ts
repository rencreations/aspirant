import { describe, expect, it } from "vitest";

import { DRAMA_NODES, DRAMA_START, isEnding, nodeById } from "./drama-graph";
import { DRAMA_FILES, type DramaFileName } from "./drama.generated";
import {
  canContinue,
  dramaReducer,
  edgeKey,
  emptySave,
  graphProblems,
  hasSeenEnding,
  isCrossed,
  isUnlocked,
  parseSave,
  routeTags,
  serializeSave,
  type DramaAction,
  type DramaSave,
} from "./drama-state";

/** An en dash or an em dash, made from the codes so no such character is written in this file. */
const DASHES = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`);

const run = (actions: readonly DramaAction[], from: DramaSave = emptySave()): DramaSave =>
  actions.reduce(dramaReducer, from);

/** The actions that play a route to its ending: the answer index to give at each episode. */
function playRoute(answers: readonly number[], from: DramaSave = emptySave()): DramaSave {
  let save = dramaReducer(from, { type: "new" });
  for (const index of answers) save = dramaReducer(save, { type: "choose", index });
  return dramaReducer(save, { type: "finish" });
}

describe("the first visit", () => {
  it("has nothing to continue, and only the first episode is playable", () => {
    const save = emptySave();
    expect(canContinue(save)).toBe(false);
    expect(isUnlocked(save, DRAMA_START)).toBe(true);
    expect(DRAMA_NODES.filter((n) => isUnlocked(save, n.id)).map((n) => n.id)).toEqual([
      DRAMA_START,
    ]);
  });

  it("cannot play from an episode that is not unlocked", () => {
    const save = dramaReducer(emptySave(), { type: "playFrom", node: "5A" });
    expect(save).toEqual(emptySave());
    expect(canContinue(save)).toBe(false);
  });
});

describe("runs", () => {
  it("Start New makes a run at the first episode, and Continue works", () => {
    const save = dramaReducer(emptySave(), { type: "new" });
    expect(save.run).toEqual({ node: "1", at: 0, route: [], finished: false });
    expect(canContinue(save)).toBe(true);
  });

  it("remembers the last dialogue and leaves the run alone when nothing changed", () => {
    const save = run([{ type: "new" }, { type: "advance", at: 5.2 }]);
    expect(save.run?.at).toBe(5.2);
    expect(dramaReducer(save, { type: "advance", at: 5.2 })).toBe(save);
    expect(dramaReducer(save, { type: "advance", at: -1 })).toBe(save);
    expect(dramaReducer(save, { type: "advance", at: Number.NaN })).toBe(save);
    expect(run([{ type: "quit", at: 10.4 }], save).run?.at).toBe(10.4);
  });

  it("a choice unlocks the next episode, crosses the answer and moves the run on", () => {
    const save = run([
      { type: "new" },
      { type: "advance", at: 31.4 },
      { type: "choose", index: 1 },
    ]);
    expect(save.run).toEqual({
      node: "2B",
      at: 0,
      route: [{ from: "1", choice: 1 }],
      finished: false,
    });
    expect(isUnlocked(save, "2B")).toBe(true);
    expect(isUnlocked(save, "2A")).toBe(false);
    expect(isCrossed(save, "1", 1)).toBe(true);
    expect(isCrossed(save, "1", 0)).toBe(false);
  });

  it("ignores a choice that does not exist and a choice with no run", () => {
    expect(dramaReducer(emptySave(), { type: "choose", index: 0 })).toEqual(emptySave());
    const save = dramaReducer(emptySave(), { type: "new" });
    expect(dramaReducer(save, { type: "choose", index: 2 })).toBe(save);
    expect(dramaReducer(save, { type: "choose", index: -1 })).toBe(save);
  });

  it("an ending finishes the run, is remembered, and greys Continue out", () => {
    const save = playRoute([0, 0, 0, 0, 0, 0]);
    // 1 -> 2A -> 3A -> 4A -> 5A -> 6A (five answers): the sixth is ignored at the ending.
    expect(save.run?.node).toBe("6A");
    expect(save.run?.finished).toBe(true);
    expect(canContinue(save)).toBe(false);
    expect(hasSeenEnding(save, "6A")).toBe(true);
    expect(isUnlocked(save, "6A")).toBe(true);
  });

  it("finish does nothing away from an ending", () => {
    const save = dramaReducer(emptySave(), { type: "new" });
    expect(dramaReducer(save, { type: "finish" })).toBe(save);
  });

  it("Start New after an ending keeps every unlock, crossed answer and ending", () => {
    const done = playRoute([0, 0, 0, 0, 1]);
    const again = dramaReducer(done, { type: "new" });
    expect(again.unlocked).toEqual(done.unlocked);
    expect(again.crossed).toEqual(done.crossed);
    expect(again.endings).toEqual(done.endings);
    expect(again.run).toEqual({ node: "1", at: 0, route: [], finished: false });
    expect(canContinue(again)).toBe(true);
  });

  it("Play from here starts at an unlocked episode, without taking anything back", () => {
    const done = playRoute([0, 0, 0, 0, 1]);
    const there = dramaReducer(done, { type: "playFrom", node: "4A" });
    expect(there.run).toEqual({ node: "4A", at: 0, route: [], finished: false });
    expect(there.unlocked).toEqual(done.unlocked);
    expect(canContinue(there)).toBe(true);
    // Not unlocked on this route: ignored.
    expect(dramaReducer(there, { type: "playFrom", node: "6C" })).toBe(there);
  });

  it("Continue keeps the save as it is", () => {
    const save = run([{ type: "new" }, { type: "advance", at: 5.2 }]);
    expect(dramaReducer(save, { type: "continue" })).toBe(save);
  });

  it("the recap of a run is the tags of its answers, in order", () => {
    const save = playRoute([0, 0, 0, 0, 1]);
    expect(routeTags(save.run!)).toEqual([
      { chapter: 1, tag: "CHECK BADGE" },
      { chapter: 2, tag: "CURIOUS INQUIRY" },
      { chapter: 3, tag: "SUPPORT ACTION" },
      { chapter: 4, tag: "PROBING THE PAST" },
      { chapter: 5, tag: "SIDE BY SIDE" },
    ]);
  });
});

describe("every route", () => {
  /** All the routes from an episode: lists of answer indexes that end at an ending. */
  const routes = (id: string): number[][] => {
    const node = nodeById(id);
    if (isEnding(node)) return [[]];
    return node.choices.flatMap((c, i) => routes(c.to).map((r) => [i, ...r]));
  };

  it("can be played to an ending, and unlocks exactly the episodes on it", () => {
    const all = routes(DRAMA_START);
    expect(all.length).toBeGreaterThan(8);
    const endings = new Set<string>();
    for (const answers of all) {
      const save = playRoute(answers);
      expect(save.run?.finished).toBe(true);
      expect(save.crossed).toHaveLength(answers.length);
      endings.add(save.run!.node);
    }
    expect([...endings].sort()).toEqual(["6A", "6B", "6C"]);
  });

  it("together unlock every episode and cross every answer", () => {
    let save = emptySave();
    for (const answers of routes(DRAMA_START)) save = playRoute(answers, save);
    for (const n of DRAMA_NODES) expect(isUnlocked(save, n.id)).toBe(true);
    for (const n of DRAMA_NODES) {
      n.choices.forEach((_, i) => {
        expect(isCrossed(save, n.id, i)).toBe(true);
      });
    }
    expect(save.endings).toHaveLength(3);
  });
});

describe("the save", () => {
  it("survives a round trip", () => {
    const save = playRoute([1, 1, 1, 1]);
    expect(parseSave(serializeSave(save))).toEqual(save);
  });

  it("falls back to an empty save for nothing, broken JSON and the wrong shape", () => {
    expect(parseSave(null)).toEqual(emptySave());
    expect(parseSave("")).toEqual(emptySave());
    expect(parseSave("{not json")).toEqual(emptySave());
    expect(parseSave("42")).toEqual(emptySave());
    expect(parseSave("null")).toEqual(emptySave());
    expect(parseSave(JSON.stringify({ version: 99, unlocked: ["2A"] }))).toEqual(emptySave());
  });

  it("drops what is wrong inside a save and keeps what is right", () => {
    const raw = JSON.stringify({
      version: 1,
      unlocked: ["2A", "nope", 7, "2A"],
      crossed: [edgeKey("1", 0), "1:9", "zzz:0", "bad"],
      endings: ["6B", "1", "nope"],
      run: {
        node: "4A",
        at: -5,
        route: [
          { from: "1", choice: 0 },
          { from: "x", choice: 0 },
        ],
        finished: "yes",
      },
    });
    const save = parseSave(raw);
    expect(save.unlocked).toEqual(["2A"]);
    expect(save.crossed).toEqual(["1:0"]);
    expect(save.endings).toEqual(["6B"]);
    expect(save.run).toEqual({
      node: "4A",
      at: 0,
      route: [{ from: "1", choice: 0 }],
      finished: false,
    });
  });

  it("drops a run that points at an episode that does not exist", () => {
    const save = parseSave(JSON.stringify({ version: 1, run: { node: "9Z", at: 3 } }));
    expect(save.run).toBeNull();
    expect(canContinue(save)).toBe(false);
  });
});

describe("the graph and its files", () => {
  it("is sound: every answer leads on, every episode is reachable, endings have no choices", () => {
    expect(graphProblems(DRAMA_NODES, DRAMA_START)).toEqual([]);
  });

  it("finds the faults of a broken graph", () => {
    const broken = DRAMA_NODES.filter((n) => n.id !== "4B");
    expect(graphProblems(broken, DRAMA_START).join(" ")).toContain("missing 4B");
    expect(graphProblems(DRAMA_NODES, "nope")).toContain("no first episode");
  });

  it("has a film with dialogue marks for every episode", () => {
    for (const n of DRAMA_NODES) {
      const info = DRAMA_FILES[n.file as DramaFileName];
      expect(info, n.id).toBeDefined();
      expect(info.node, n.id).toBe(n.id);
      expect(info.marks[0], n.id).toBe(0);
      const sorted = [...info.marks].sort((a, b) => a - b);
      expect([...info.marks], n.id).toEqual(sorted);
      expect(
        info.marks.every((m) => m < info.duration),
        n.id,
      ).toBe(true);
      if (isEnding(n)) expect(info.choiceAt, n.id).toBeNull();
      else {
        expect(info.choiceAt, n.id).not.toBeNull();
        expect(info.choiceAt!, n.id).toBeLessThan(info.duration);
        expect(info.choiceAt!, n.id).toBeGreaterThan(info.marks[info.marks.length - 1]!);
      }
    }
  });

  it("has a card for every answer and a title for every ending", () => {
    for (const n of DRAMA_NODES) {
      for (const c of n.choices) {
        expect(c.tag.length).toBeGreaterThan(0);
        expect(c.label.length).toBeGreaterThan(0);
        // No en dash and no em dash in what the player reads.
        expect(DASHES.test(c.label + c.tag)).toBe(false);
      }
      if (isEnding(n)) expect(n.ending?.title.length).toBeGreaterThan(0);
    }
  });
});
