import { describe, expect, it } from "vitest";

import {
  FLOW_SPEED_MIN,
  GAP_MAX,
  GAP_MIN,
  MAX_RATIO,
  MIN_RATIO,
  ROW_H_MAX,
  ROW_H_MIN,
  boxHeight,
  firstScreenIndexes,
  metricsFor,
  needsRebuild,
  overscanFor,
  pickSize,
  pitchOf,
  planRows,
  rowOfPicture,
  rowShift,
  scrollForPicture,
  scrollToShow,
  slideProgress,
  slideWindow,
  tileRatio,
  visibleRows,
  type FlowMetrics,
} from "./math";

/** A reproducible mix of ratios: wide frames, squares and tall pictures. */
function mix(
  n: number,
  seed = 7,
  kinds = [16 / 9, 2.37, 1, 0.56, 1.5, 0.75, 2.22, 1.33],
): number[] {
  let s = seed;
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    out.push(tileRatio(kinds[s % kinds.length] ?? 1, 1));
  }
  return out;
}

const SIZES: Array<[string, number, number]> = [
  ["laptop", 1440, 900],
  ["desktop", 1920, 1080],
  ["tablet", 820, 1180],
  ["phone", 390, 844],
  ["phone landscape", 844, 390],
  ["ultrawide", 3440, 1440],
];

const scrollAt = (y: number, boxTop = 300, maxScroll = 1e9) => ({ y, boxTop, maxScroll });

describe("metricsFor", () => {
  it("gives every screen one row height and one gap, inside their limits", () => {
    for (const [, w, h] of SIZES) {
      const m = metricsFor(w, h);
      expect(m.rowH).toBeGreaterThanOrEqual(ROW_H_MIN);
      expect(m.rowH).toBeLessThanOrEqual(ROW_H_MAX);
      expect(m.gap).toBeGreaterThanOrEqual(GAP_MIN);
      expect(m.gap).toBeLessThanOrEqual(GAP_MAX);
    }
  });

  it("makes a phone's rows the floor and a laptop's taller", () => {
    expect(metricsFor(390, 844).rowH).toBe(ROW_H_MIN);
    expect(metricsFor(1440, 900).rowH).toBeGreaterThan(ROW_H_MIN);
  });
});

describe("tileRatio", () => {
  it("keeps the picture's own ratio, with a wide safety margin", () => {
    expect(tileRatio(1920, 1080)).toBeCloseTo(16 / 9, 5);
    expect(tileRatio(2560, 1079)).toBeCloseTo(2560 / 1079, 5);
    expect(tileRatio(100, 10000)).toBe(MIN_RATIO);
    expect(tileRatio(10000, 100)).toBe(MAX_RATIO);
    expect(tileRatio(0, 0)).toBe(1);
  });
});

describe("planRows", () => {
  it("returns nothing for nothing", () => {
    expect(planRows([], metricsFor(1440, 900))).toEqual([]);
  });

  for (const [name, w, h] of SIZES) {
    describe(name, () => {
      const m = metricsFor(w, h);
      const ratios = mix(300);
      const rows = planRows(ratios, m);

      it("puts every picture in exactly one row, in order", () => {
        let next = 0;
        for (const row of rows) {
          expect(row.start).toBe(next);
          expect(row.widths).toHaveLength(row.count);
          next += row.count;
        }
        expect(next).toBe(ratios.length);
      });

      it("makes every full row slide at least the floor, and its slack is its travel", () => {
        for (const row of rows.slice(0, -1)) {
          expect(row.travel).toBeGreaterThanOrEqual(FLOW_SPEED_MIN * m.vh - 0.5);
          expect(row.travel).toBe(Math.max(0, row.content - m.vw));
        }
      });

      it("stands the rows one pitch apart and alternates their direction", () => {
        rows.forEach((row, i) => {
          expect(row.index).toBe(i);
          expect(row.top).toBe(i * pitchOf(m));
          expect(row.dir).toBe(i % 2 === 0 ? 1 : -1);
        });
        expect(boxHeight(rows.length, m)).toBe(rows.length * pitchOf(m) - m.gap);
      });

      it("keeps the whole picture: width is the row height times the ratio", () => {
        const row = rows[2];
        if (!row) throw new Error("no row");
        row.widths.forEach((width, k) => {
          expect(width).toBe(Math.round((ratios[row.start + k] ?? 1) * m.rowH));
        });
        const sum = row.widths.reduce((a, b) => a + b, 0) + m.gap * (row.count - 1);
        expect(row.content).toBe(sum);
      });
    });
  }

  it("holds 4 to 9 pictures a row for ordinary pictures on a laptop and a desktop", () => {
    for (const [w, h] of [
      [1440, 900],
      [1920, 1080],
    ] as const) {
      const m = metricsFor(w, h);
      const rows = planRows(mix(400, 3), m).slice(0, -1);
      const counts = rows.map((r) => r.count);
      expect(Math.min(...counts)).toBeGreaterThanOrEqual(3);
      expect(Math.max(...counts)).toBeLessThanOrEqual(10);
      expect(new Set(counts).size).toBeGreaterThanOrEqual(2);
    }
  });

  it("holds 4 wide stills a row at 1440 and 1920, and 2 on a phone", () => {
    const wide = new Array<number>(80).fill(2.37);
    expect(planRows(wide, metricsFor(1440, 900))[0]?.count).toBe(4);
    expect(planRows(wide, metricsFor(1920, 1080))[0]?.count).toBe(4);
    expect(planRows(wide, metricsFor(390, 844))[0]?.count).toBe(2);
  });

  it("is deterministic", () => {
    const m = metricsFor(1440, 900);
    const ratios = mix(120);
    expect(planRows(ratios, m)).toEqual(planRows(ratios, m));
  });

  it("takes as many tall pictures as a row needs", () => {
    const m = metricsFor(1920, 1080);
    const rows = planRows(new Array<number>(60).fill(0.45), m);
    expect(rows[0]?.count).toBeGreaterThan(9);
    for (const row of rows.slice(0, -1))
      expect(row.travel).toBeGreaterThanOrEqual(0.2 * m.vh - 0.5);
  });

  it("handles 0, 1, 2, 3 and 17 pictures, and one very wide picture", () => {
    const m = metricsFor(1440, 900);
    for (const n of [1, 2, 3]) {
      const rows = planRows(new Array<number>(n).fill(1.5), m);
      expect(rows).toHaveLength(1);
      expect(rows[0]?.count).toBe(n);
    }
    // Too few to fill the screen: one row that stands still, centred.
    const few = planRows([1.5, 1.5], m)[0];
    if (!few) throw new Error("no row");
    expect(few.content).toBeLessThan(m.vw);
    expect(rowShift(few, m, scrollAt(0))).toBe(Math.round((m.vw - few.content) / 2));
    expect(rowShift(few, m, scrollAt(4000))).toBe(rowShift(few, m, scrollAt(0)));
    const seventeen = planRows(mix(17, 5), m);
    expect(seventeen.reduce((n, r) => n + r.count, 0)).toBe(17);
    expect(seventeen.length).toBeGreaterThanOrEqual(3);
    const wideOne = planRows([5, 1.78, 1.78, 1.78], m);
    expect(wideOne.reduce((n, r) => n + r.count, 0)).toBe(4);
  });

  it("slides a row of 5 to 1 pictures no further than its own slack", () => {
    const m = metricsFor(390, 844);
    const row = planRows([5, 1.78, 1.78], m)[0];
    if (!row) throw new Error("no row");
    // A picture wider than the screen is whole at the row height and slides like any other.
    expect(row.widths[0]).toBeGreaterThan(m.vw);
    expect(row.travel).toBe(row.content - m.vw);
  });
});

describe("rowShift", () => {
  const m = metricsFor(1440, 900);
  const rows = planRows(mix(200), m);
  const MAX = 1e9;
  /** A scroll position in the middle of a row's slide. */
  const middleOf = (row: (typeof rows)[number]) => {
    const [start, end] = slideWindow(row, m, 300, MAX);
    return (start + end) / 2;
  };

  it("never lets the screen see outside the strip, at any scroll", () => {
    for (const [, w, h] of SIZES) {
      const mm = metricsFor(w, h);
      const planned = planRows(mix(200, 11), mm);
      for (const row of planned.slice(0, 40)) {
        for (let y = -600; y < 42 * pitchOf(mm); y += 41) {
          const x = rowShift(row, mm, scrollAt(y, 260, 40 * pitchOf(mm)));
          if (row.content >= mm.vw) {
            expect(x).toBeLessThanOrEqual(0);
            expect(x + row.content).toBeGreaterThanOrEqual(mm.vw);
          } else {
            expect(x).toBeGreaterThanOrEqual(0);
          }
        }
      }
    }
  });

  it("shows every picture whole at some point of its row's slide", () => {
    for (const row of rows.slice(0, -1)) {
      let a = 0;
      for (let k = 0; k < row.count; k++) {
        const wk = row.widths[k] ?? 0;
        if (wk <= m.vw) {
          const lo = Math.max(-row.travel, -a);
          const hi = Math.min(0, m.vw - a - wk);
          expect(lo).toBeLessThanOrEqual(hi);
        }
        a += wk + m.gap;
      }
    }
  });

  it("moves row 1 right and row 2 left while the page scrolls down", () => {
    const [a, b] = rows;
    if (!a || !b) throw new Error("no rows");
    const y = middleOf(a);
    expect(rowShift(a, m, scrollAt(y + 40, 300, MAX))).toBeGreaterThan(
      rowShift(a, m, scrollAt(y, 300, MAX)),
    );
    const yb = middleOf(b);
    expect(rowShift(b, m, scrollAt(yb + 40, 300, MAX))).toBeLessThan(
      rowShift(b, m, scrollAt(yb, 300, MAX)),
    );
  });

  it("reverses when the page scrolls up", () => {
    const [a, b] = rows;
    if (!a || !b) throw new Error("no rows");
    const y = middleOf(a);
    expect(rowShift(a, m, scrollAt(y - 40, 300, MAX))).toBeLessThan(
      rowShift(a, m, scrollAt(y, 300, MAX)),
    );
    const yb = middleOf(b);
    expect(rowShift(b, m, scrollAt(yb - 40, 300, MAX))).toBeGreaterThan(
      rowShift(b, m, scrollAt(yb, 300, MAX)),
    );
  });

  it("is a straight line of the scroll inside the slide, so scrolling back retraces it", () => {
    const row = rows[3];
    if (!row) throw new Error("no row");
    const [start, end] = slideWindow(row, m, 300, MAX);
    const at = (t: number) => rowShift(row, m, scrollAt(start + t * (end - start), 300, MAX), 1000);
    const x1 = at(0.25);
    const x2 = at(0.5);
    const x3 = at(0.75);
    expect(x3 - x2).toBeCloseTo(x2 - x1, 2);
    expect(at(0.5)).toBe(at(0.5));
  });

  it("slides the whole travel while the row is whole on the screen, from the bottom edge to the top edge", () => {
    const row = rows[4];
    if (!row) throw new Error("no row");
    const [start, end] = slideWindow(row, m, 300, MAX);
    expect(end - start).toBeCloseTo(m.vh - m.rowH, 6);
    const span = Math.abs(
      rowShift(row, m, scrollAt(end, 300, MAX)) - rowShift(row, m, scrollAt(start, 300, MAX)),
    );
    expect(span).toBeCloseTo(row.travel, 0);
    // The ends: row 3 moves right, so it starts at its end and finishes at its start.
    expect(rowShift(row, m, scrollAt(start - 500, 300, MAX))).toBe(-row.travel);
    expect(rowShift(row, m, scrollAt(end + 500, 300, MAX))).toBe(0);
  });

  it("stays at the ends while the row is far off screen", () => {
    const row = rows[2];
    if (!row) throw new Error("no row");
    expect(rowShift(row, m, scrollAt(1e6, 300, MAX))).toBe(
      rowShift(row, m, scrollAt(2e6, 300, MAX)),
    );
  });

  it("rounds to a whole device pixel", () => {
    const row = rows[1];
    if (!row) throw new Error("no row");
    for (let y = 0; y < 3000; y += 37) {
      const x = rowShift(row, m, scrollAt(y, 300, MAX), 2);
      expect(Math.abs(x * 2 - Math.round(x * 2))).toBeLessThan(1e-9);
    }
  });

  it("lets the last rows finish their slide as the page ends", () => {
    const last = rows[rows.length - 2];
    if (!last) throw new Error("no row");
    const maxScroll = 300 + last.top + m.rowH / 2 + 100;
    const [, end] = slideWindow(last, m, 300, maxScroll);
    expect(end).toBeLessThanOrEqual(maxScroll);
    expect(slideProgress(last, m, { y: maxScroll, boxTop: 300, maxScroll })).toBe(1);
  });

  it("starts a first row at the beginning of its slide at the top of the page, so no picture is lost", () => {
    for (const first of rows.slice(0, 3)) {
      expect(slideProgress(first, m, scrollAt(0, 300, MAX))).toBe(0);
      const [start, end] = slideWindow(first, m, 300, MAX);
      expect(start).toBeGreaterThanOrEqual(0);
      expect(end).toBeGreaterThan(start);
      // Both ends of the strip are reached while the row is on the screen.
      const a = rowShift(first, m, scrollAt(0, 300, MAX));
      const b = rowShift(first, m, scrollAt(end, 300, MAX));
      expect(Math.abs(b - a)).toBeCloseTo(first.travel, 0);
    }
  });
});

describe("scrollForPicture", () => {
  const m = metricsFor(1440, 900);
  const rows = planRows(mix(120), m);
  const MAX = 1e9;

  it("brings a picture of the middle of a row to the middle of the screen", () => {
    for (const row of rows.slice(2, 12)) {
      const k = Math.floor(row.count / 2);
      const y = scrollForPicture(row, k, m, 300, MAX);
      const x = rowShift(row, m, scrollAt(y, 300, MAX));
      let c = 0;
      for (let j = 0; j < k; j++) c += (row.widths[j] ?? 0) + m.gap;
      c += (row.widths[k] ?? 0) / 2;
      const centre = x + c;
      // Within the slide the centre is near the middle; at the ends of the strip it is as near as it can be.
      expect(centre).toBeGreaterThan(0);
      expect(centre).toBeLessThan(m.vw);
    }
  });

  it("keeps the row in the middle half of its slide", () => {
    for (const row of rows.slice(0, 20)) {
      for (let k = 0; k < row.count; k++) {
        const y = scrollForPicture(row, k, m, 300, MAX);
        const q = slideProgress(row, m, scrollAt(y, 300, MAX));
        expect(q).toBeGreaterThanOrEqual(0.25 - 1e-9);
        expect(q).toBeLessThanOrEqual(0.75 + 1e-9);
      }
    }
  });

  it("puts a static row in the middle of its pass", () => {
    const few = planRows([1.5, 1.5], m)[0];
    if (!few) throw new Error("no row");
    const [start, end] = slideWindow(few, m, 300, MAX);
    expect(scrollForPicture(few, 1, m, 300, MAX)).toBeCloseTo((start + end) / 2, 6);
  });
});

describe("scrollToShow", () => {
  const m = metricsFor(1440, 900);
  const rows = planRows(mix(120), m);
  const MAX = 1e9;

  it("shows the picture whole, wherever the page is", () => {
    for (const row of rows.slice(0, 20)) {
      let a = 0;
      for (let k = 0; k < row.count; k++) {
        const w = row.widths[k] ?? 0;
        for (const y0 of [0, 200, 900, 5000]) {
          const y = scrollToShow(row, k, m, 300, MAX, y0);
          const x = rowShift(row, m, scrollAt(y, 300, MAX));
          if (w < m.vw) {
            expect(x + a).toBeGreaterThanOrEqual(-1);
            expect(x + a + w).toBeLessThanOrEqual(m.vw + 1);
          }
        }
        a += w + m.gap;
      }
    }
  });

  it("does not move the page when the picture is whole already", () => {
    const row = rows[3];
    if (!row) throw new Error("no row");
    const [start, end] = slideWindow(row, m, 300, MAX);
    const y = (start + end) / 2;
    // The picture in the middle of the screen at this scroll.
    let a = 0;
    const x = rowShift(row, m, scrollAt(y, 300, MAX));
    let k = 0;
    for (; k < row.count; k++) {
      const w = row.widths[k] ?? 0;
      if (x + a >= 0 && x + a + w <= m.vw) break;
      a += w + m.gap;
    }
    expect(scrollToShow(row, k, m, 300, MAX, y)).toBe(y);
  });

  it("moves the page only as far as the slide needs", () => {
    const row = rows[4];
    if (!row) throw new Error("no row");
    const [start, end] = slideWindow(row, m, 300, MAX);
    const y = (start + end) / 2;
    const last = row.count - 1;
    const y2 = scrollToShow(row, last, m, 300, MAX, y);
    // Nearer than the middle of the row's pass, and still inside it.
    expect(Math.abs(y2 - y)).toBeLessThanOrEqual(m.vh / 2 + 1);
    expect(y2).toBeGreaterThanOrEqual(start - 1);
    expect(y2).toBeLessThanOrEqual(end + 1);
  });

  it("leaves a static row alone", () => {
    const few = planRows([1.5, 1.5], m)[0];
    if (!few) throw new Error("no row");
    expect(scrollToShow(few, 1, m, 300, MAX, 123)).toBe(123);
  });
});

describe("rowOfPicture", () => {
  const rows = planRows(mix(120), metricsFor(1440, 900));

  it("finds the row of every picture", () => {
    for (let i = 0; i < 120; i++) {
      const at = rowOfPicture(rows, i);
      const row = rows[at];
      expect(row).toBeDefined();
      expect(i).toBeGreaterThanOrEqual(row?.start ?? 0);
      expect(i).toBeLessThan((row?.start ?? 0) + (row?.count ?? 0));
    }
    expect(rowOfPicture(rows, 999)).toBe(-1);
    expect(rowOfPicture([], 0)).toBe(-1);
  });
});

describe("visibleRows", () => {
  const m = metricsFor(1440, 900);
  const pitch = pitchOf(m);
  const over = overscanFor(900);

  it("returns none for no rows", () => {
    expect(visibleRows(0, 0, 900, 0, m, over)).toEqual([0, -1]);
  });

  it("holds the rows on screen and the ones within the overscan", () => {
    const [a, b] = visibleRows(40 * pitch, 0, 900, 200, m, over);
    expect(a * pitch + m.rowH).toBeGreaterThanOrEqual(40 * pitch - over);
    expect(b * pitch).toBeLessThanOrEqual(40 * pitch + 900 + over);
    expect(a).toBeLessThanOrEqual(40);
    expect(b).toBeGreaterThanOrEqual(Math.floor((40 * pitch + 900) / pitch));
  });

  it("holds about nine rows on a laptop, whatever the total", () => {
    const [a, b] = visibleRows(60 * pitch, 260, 900, 300, m, over);
    expect(b - a + 1).toBeGreaterThanOrEqual(6);
    expect(b - a + 1).toBeLessThanOrEqual(11);
  });

  it("keeps the first rows at the top of the page", () => {
    const [a, b] = visibleRows(0, 260, 900, 100, m, over);
    expect(a).toBe(0);
    expect(b).toBeGreaterThan(2);
  });

  it("clamps to the rows that exist", () => {
    expect(visibleRows(1e6, 0, 900, 10, m, over)).toEqual([9, 9]);
    expect(visibleRows(-1e6, 0, 900, 10, m, over)).toEqual([0, 0]);
  });
});

describe("needsRebuild", () => {
  const m = metricsFor(390, 844);

  it("plans on the first measure", () => {
    expect(needsRebuild(null, 390, 844)).toBe(true);
  });

  it("plans again when the width changes", () => {
    expect(needsRebuild(m, 400, 844)).toBe(true);
  });

  it("does not plan again when only the height changes a little", () => {
    expect(needsRebuild(m, 390, 844 + 90)).toBe(false);
    expect(needsRebuild(m, 390, 844 - 90)).toBe(false);
  });

  it("plans again for a turn of the phone", () => {
    expect(needsRebuild(m, 844, 390)).toBe(true);
  });
});

describe("pickSize", () => {
  it("asks for the small picture while it is sharp enough, and the preview when not", () => {
    // A 2.37:1 still on a laptop row (about 495 px wide).
    expect(pickSize(495, 209, 1)).toBe("t");
    expect(pickSize(495, 209, 2)).toBe("p");
    expect(pickSize(495, 209, 1.25)).toBe("p");
    // A 16:9 still on a phone row.
    expect(pickSize(284, 160, 2)).toBe("p");
    expect(pickSize(220, 160, 2)).toBe("t");
    expect(pickSize(120, 243, 1)).toBe("t");
  });
});

describe("firstScreenIndexes", () => {
  it("lists the pictures that show at the top of the page, row by row", () => {
    const m = metricsFor(1440, 900);
    const picked = firstScreenIndexes(mix(200), m, 300, 40);
    expect(picked.length).toBeGreaterThan(8);
    expect(picked.length).toBeLessThanOrEqual(40);
    expect(new Set(picked).size).toBe(picked.length);
    expect([...picked].sort((a, b) => a - b)).toEqual(picked);
  });

  it("stops at the limit and is empty for no pictures", () => {
    const m = metricsFor(1440, 900);
    expect(firstScreenIndexes(mix(200), m, 300, 5)).toHaveLength(5);
    expect(firstScreenIndexes([], m, 300, 12)).toEqual([]);
  });

  it("only lists pictures inside the screen", () => {
    const m: FlowMetrics = metricsFor(1440, 900);
    const ratios = mix(200);
    const rows = planRows(ratios, m);
    const picked = new Set(firstScreenIndexes(ratios, m, 300, 100));
    const row = rows[1];
    if (!row) throw new Error("no row");
    let x = rowShift(row, m, { y: 0, boxTop: 300, maxScroll: Number.POSITIVE_INFINITY });
    for (let k = 0; k < row.count; k++) {
      const w = row.widths[k] ?? 0;
      const inside = x + w > 0 && x < m.vw;
      expect(picked.has(row.start + k)).toBe(inside);
      x += w + m.gap;
    }
  });
});
