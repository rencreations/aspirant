import { describe, expect, it } from "vitest";

import { DRAMA_NODES, isEnding } from "./drama-graph";
import { DRAMA_FILES, type DramaFileName } from "./drama.generated";
import { markIndexAt, nextStep, previousMark, type MarkInfo } from "./drama-marks";

const film: MarkInfo = { marks: [0, 0.6, 5.2, 10.4], choiceAt: 20, duration: 30 };
const ending: MarkInfo = { marks: [0, 3, 8], choiceAt: null, duration: 20 };

describe("next", () => {
  it("goes to the next mark, from the start and from the middle of a line", () => {
    expect(nextStep(film, 0)).toEqual({ kind: "mark", at: 0.6 });
    expect(nextStep(film, 0.6)).toEqual({ kind: "mark", at: 5.2 });
    expect(nextStep(film, 7)).toEqual({ kind: "mark", at: 10.4 });
  });

  it("treats a time a frame off a mark as the mark", () => {
    expect(nextStep(film, 5.12)).toEqual({ kind: "mark", at: 10.4 });
    expect(nextStep(film, 5.3)).toEqual({ kind: "mark", at: 10.4 });
  });

  it("after the last line goes to the choices, and then nowhere", () => {
    expect(nextStep(film, 10.4)).toEqual({ kind: "choices", at: 20 });
    expect(nextStep(film, 15)).toEqual({ kind: "choices", at: 20 });
    expect(nextStep(film, 20)).toEqual({ kind: "none" });
    expect(nextStep(film, 25)).toEqual({ kind: "none" });
  });

  it("after the last line of an ending goes to its end", () => {
    expect(nextStep(ending, 8)).toEqual({ kind: "end", at: 19.95 });
    expect(nextStep(ending, 19.9)).toEqual({ kind: "none" });
  });

  it("never goes to a mark that is after the choices appear", () => {
    const late: MarkInfo = { marks: [0, 5, 25], choiceAt: 20, duration: 30 };
    expect(nextStep(late, 5)).toEqual({ kind: "choices", at: 20 });
  });
});

describe("back", () => {
  it("restarts a line that has been showing, and goes to the line before otherwise", () => {
    expect(previousMark(film.marks, 7)).toBe(5.2);
    expect(previousMark(film.marks, 5.5)).toBe(0.6);
    expect(previousMark(film.marks, 0.7)).toBe(0);
    expect(previousMark(film.marks, 0)).toBe(0);
  });

  it("knows which line is on screen", () => {
    expect(markIndexAt(film.marks, 0)).toBe(0);
    expect(markIndexAt(film.marks, 5.19)).toBe(2);
    expect(markIndexAt(film.marks, 9)).toBe(2);
    expect(markIndexAt(film.marks, 99)).toBe(3);
    expect(markIndexAt([], 3)).toBe(-1);
  });
});

describe("walking a real episode with Space", () => {
  it("visits every line once and ends at the choices or the end", () => {
    for (const n of DRAMA_NODES) {
      const info = DRAMA_FILES[n.file as DramaFileName];
      let t = 0;
      let steps = 0;
      let last = "";
      for (;;) {
        const step = nextStep(info, t);
        if (step.kind === "none") break;
        t = step.at;
        last = step.kind;
        steps++;
        expect(steps, n.id).toBeLessThan(60);
        if (step.kind !== "mark") break;
      }
      expect(last, n.id).toBe(isEnding(n) ? "end" : "choices");
      expect(steps, n.id).toBe(info.marks.length);
    }
  });
});
