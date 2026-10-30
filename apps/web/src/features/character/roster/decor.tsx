import type { CSSProperties, ReactNode } from "react";

import type { RosterPair } from "./entries";
import { BAYS, BOARD_W, END, LEAN, mid, SLASH, SLOTS } from "./layout";
import styles from "./roster.module.css";

/**
 * The small print of the wall: rows of labels, rulers, counters, bars, barcodes and hazard
 * stripes in the bands above and below the panels, and the same kind of detail packed into the red
 * field behind the title block. All of it is drawn on one layer in board units, thin and low in
 * contrast, so the panels stay in front. It is decoration: nothing here is read by assistive
 * technology (the words are painted by the stylesheet from `data-t`) and nothing takes the pointer.
 * Only a few marks blink, and only when the page is finished (`.blink`).
 */

const n2 = (n: number) => String(n).padStart(2, "0");
/** A number that is the same on every build, from a seed. */
const pick = (seed: number, size: number) => {
  const x = Math.sin(seed * 12.9898 + 7.233) * 43758.5453;
  return Math.floor((x - Math.floor(x)) * size);
};
const hex = (seed: number, len: number) =>
  Array.from({ length: len }, (_, i) => "0123456789ABCDEF"[pick(seed * 31 + i, 16)]).join("");

/** Is a point of the board on the red side of the slash? */
const redAt = (x: number, y: number) => x < SLASH.x - LEAN * (y - SLASH.y) - 6;

type Kind =
  | "ruler"
  | "ruler2"
  | "segs"
  | "hazard"
  | "hazardV"
  | "box"
  | "bars"
  | "barcode"
  | "hline"
  | "dots"
  | "plate";

interface Mark {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  /** Text (painted by the stylesheet). */
  readonly t?: string;
  /** A block: its kind and size, in units. */
  readonly k?: Kind;
  readonly w?: number;
  readonly h?: number;
  /** A fill from 0 to 1, for a bar. */
  readonly f?: number;
  /** Larger type, ghost type, or blinking. */
  readonly s?: "big" | "ghost" | "vert" | "dim";
  readonly blink?: boolean;
}

const block = (m: Mark): CSSProperties =>
  ({
    "--x": m.x,
    "--y": m.y,
    "--w": m.w,
    "--h": m.h,
    "--f": m.f,
  }) as CSSProperties;

function build(pairs: readonly RosterPair[]): Mark[] {
  const marks: Mark[] = [];
  let id = 0;
  const add = (m: Omit<Mark, "id">) => marks.push({ id: `m${id++}`, ...m });
  const names = new Map(pairs.map((p) => [p.id, p.names.toUpperCase()]));

  // Rulers across the whole board, one above the panels and one below.
  for (const y of [-9, 387]) {
    add({ x: 0, y, k: "ruler", w: BOARD_W, h: 2.2 });
    add({ x: 0, y: y + (y < 0 ? 0.4 : -0.8), k: "ruler2", w: BOARD_W, h: 4 });
  }
  for (let x = 100; x < BOARD_W; x += 100) {
    add({ x: x + 1.5, y: -17, t: `X ${String(x).padStart(4, "0")}` });
    add({ x: x + 1.5, y: 393.5, t: `X ${String(x).padStart(4, "0")}` });
  }

  const centres = BAYS.map((bay) => {
    const ss = SLOTS.filter((s) => s.pair === bay);
    return ss.reduce((sum, s) => sum + mid(s), 0) / ss.length;
  });

  BAYS.forEach((bay, b) => {
    // Each pair gets the stretch of the board that is nearest to it, so the rows never collide.
    const x0 = b === 0 ? 150 : ((centres[b - 1] ?? 0) + (centres[b] ?? 0)) / 2 + 8;
    const x1 =
      b === BAYS.length - 1
        ? (centres[b] ?? 0) + 150
        : ((centres[b] ?? 0) + (centres[b + 1] ?? 0)) / 2 - 8;
    const w = x1 - x0;
    const seed = b + 1;
    // The top band.
    add({ x: x0, y: -26, t: `PAIR ${n2(b + 1)} / ${names.get(bay) ?? ""}` });
    add({
      x: x0,
      y: -34,
      k: "segs",
      w: Math.min(70, w * 0.3),
      h: 2.4,
      f: 0.45 + pick(seed, 50) / 100,
    });
    add({ x: x0 + 78, y: -35.5, t: `SYNC ${90 + pick(seed, 9)}.${pick(seed + 3, 10)}` });
    add({
      x: x0 + Math.min(w - 52, 160),
      y: -26,
      k: "box",
      w: 44,
      h: 7,
      t: `LINK ${hex(seed, 2)}`,
    });
    add({ x: x0 + Math.min(w - 52, 160), y: -35, k: "hazard", w: 44, h: 3 });
    add({ x: x0 + w * 0.55, y: -34, k: "barcode", w: 36, h: 5 });
    add({ x: x0 + w * 0.55 + 42, y: -33.5, t: `SN ${hex(seed * 5, 4)} ${hex(seed * 7, 4)}` });
    add({ x: x0, y: -43, k: "hline", w: w, h: 0.5 });
    add({ x: x0, y: -42, t: `SECTOR ${"ABCDE"[b] ?? "Z"}${b + 1}` });
    add({ x: x0 + 52, y: -42, k: "dots", w: 24, h: 2 });
    add({ x: x0 + w - 74, y: -42, t: `GRID ${24 + b * 4} X ${24 + b * 4}` });
    // The bottom band.
    add({ x: x0, y: 400, t: "ASPIRANT POWER" });
    add({
      x: x0 + 64,
      y: 400.4,
      k: "segs",
      w: Math.min(90, w * 0.35),
      h: 2.4,
      f: 0.3 + pick(seed + 9, 70) / 100,
    });
    add({ x: x0 + 64 + Math.min(90, w * 0.35) + 5, y: 400, t: `${60 + pick(seed + 4, 40)} PCT` });
    add({
      x: x0,
      y: 409,
      t: `LAT ${10 + b * 7}.${pick(seed + 1, 90) + 10}  LON ${70 + b * 5}.${pick(seed + 2, 90) + 10}`,
    });
    add({
      x: x0 + Math.min(w - 52, 150),
      y: 408.5,
      k: "box",
      w: 44,
      h: 7,
      t: `CH ${n2(b * 2 + 1)} ${n2(b * 2 + 2)}`,
    });
    add({ x: x0, y: 418, k: "barcode", w: 44, h: 5 });
    add({
      x: x0 + 50,
      y: 418.5,
      t: `AX ${hex(seed * 3, 4)} ${hex(seed * 11, 4)}`,
      blink: b % 2 === 0,
    });
    add({ x: x0 + w * 0.6, y: 418, k: "hazard", w: 40, h: 3.2 });
    add({ x: x0, y: 428, k: "hline", w, h: 0.5 });
    add({ x: x0, y: 429.5, t: `END OF PAIR ${n2(b + 1)}` });
    add({ x: x0 + w - 60, y: 429.5, t: "SELRICK ACADEMY" });
    add({ x: x0 + w * 0.4, y: 437, k: "dots", w: 40, h: 2 });
  });

  // One line under each panel and one over it.
  for (const s of SLOTS) {
    add({
      x: s.x0 + 16,
      y: s.y1 + 9.5,
      t: `${s.slug.toUpperCase()} / ${n2(SLOTS.indexOf(s) + 1)}`,
    });
    add({ x: s.x1 + 14, y: -8, t: `ID ${hex(SLOTS.indexOf(s) + 40, 6)}` });
  }

  // The end plate.
  add({ x: END.x0 + 40, y: -26, t: "NEXT / THE COLLECTION" });
  add({ x: END.x0 + 40, y: 400, t: "ARCHIVE OPEN" });
  add({ x: END.x0 + 40, y: -34, k: "segs", w: 90, h: 2.4, f: 0.7 });

  // The red side: ghost lettering, rails, plates, columns and small parts.
  add({ x: -4, y: 232, t: "04", s: "ghost" });
  add({ x: 6, y: 60, t: "ASPIRANT ROSTER 04 / TEN ASPIRANTS / FIVE PAIRS", s: "vert" });
  add({ x: 138, y: -6, t: "TERRINIA", s: "big" });
  add({ x: 100, y: 240, t: "SYS ONLINE" });
  add({ x: 100, y: 248, t: "LINK 0A 4F 21" });
  add({ x: 100, y: 256, t: `CODE ${hex(99, 6)}` });
  add({ x: 100, y: 264, t: "STORM CITADEL" });
  add({
    x: 18,
    y: 226,
    t: Array.from({ length: 8 }, (_, i) => hex(i + 70, 4) + " " + hex(i + 90, 2)).join("\n"),
  });
  add({
    x: 52,
    y: 226,
    t: Array.from({ length: 8 }, (_, i) => `${n2(pick(i + 3, 99))}.${n2(pick(i + 8, 99))}`).join(
      "\n",
    ),
    s: "dim",
  });
  add({ x: 16, y: 332, k: "plate", w: 70, h: 22, t: "PLATE 7A" });
  add({ x: 16, y: 360, k: "bars", w: 56, h: 14 });
  add({ x: 80, y: 362, t: "LOAD", s: "dim" });
  add({ x: 0, y: 392, k: "hazard", w: 120, h: 5 });
  add({ x: 0, y: -39, k: "hazard", w: 130, h: 4 });
  add({ x: -3, y: 90, k: "hazardV", w: 3, h: 120 });
  add({ x: 150, y: 214, k: "dots", w: 30, h: 2, blink: true });
  return marks;
}

/** The thin parts: rails along the lean, ticks, a gauge and plates on the red side. */
function RedLines() {
  const rails = [30, 44, 92, 186, 200, 228, 238];
  const reach = (c: number, y: number) => c - LEAN * y;
  return (
    <svg
      className={styles.redArt}
      viewBox="0 -112 330 624"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      {[
        [112, 34, styles.redBand],
        [212, 14, styles.redBandLight],
        [250, 40, styles.redBand],
      ].map(([c, wide, cls]) => (
        <path
          key={String(c)}
          d={`M${reach(Number(c), -112)} -112L${reach(Number(c) + Number(wide), -112)} -112L${reach(Number(c) + Number(wide), 512)} 512L${reach(Number(c), 512)} 512Z`}
          className={String(cls)}
        />
      ))}
      {rails.map((c) => (
        <line
          key={c}
          x1={reach(c, -112)}
          y1={-112}
          x2={reach(c, 512)}
          y2={512}
          strokeWidth={c % 2 === 0 && c > 180 ? 1.4 : 0.6}
        />
      ))}
      {[-26, 54, 134, 214, 294, 374, 424].map((y) => (
        <path
          key={y}
          d={`M0 ${y}H${y > 200 ? 90 : 190}l4 4h${y > 200 ? 24 : 40}`}
          className={styles.redJog}
        />
      ))}
      {Array.from({ length: 13 }, (_, i) => {
        const y = 96 + i * 20;
        const x = 293 - LEAN * (y - 5) - 40;
        const p = (dx: number, dy: number) => `${(x + dx - LEAN * dy).toFixed(1)} ${y + dy}`;
        return (
          <path
            key={y}
            d={`M${p(0, 0)}L${p(16, 0)}L${p(16, 12)}L${p(0, 12)}Z`}
            className={i % 3 === 1 ? styles.redSolid : styles.redJog}
          />
        );
      })}
      <circle cx="268" cy="-20" r="11" className={styles.redGauge} />
      <circle cx="268" cy="-20" r="6" className={styles.redGauge2} />
      <path d="M268 -34V-6M254 -20H282" className={styles.redJog} />
      <path d="M120 400l10 -8l10 8z M146 400l10 -8l10 8z" className={styles.redSolid} />
      <path d="M2 440h112l6 6h40" className={styles.redJog} />
    </svg>
  );
}

/** What fills the bands and the red field. See the notes at the top of this file. */
export function Decor({ pairs }: { pairs: readonly RosterPair[] }) {
  const marks = build(pairs);
  const nodes: ReactNode[] = marks.map((m) => {
    const red = redAt(m.x, m.y);
    const cls = [
      m.k ? styles.blk : styles.tx,
      m.k ? styles[`k_${m.k}`] : "",
      m.s ? styles[`s_${m.s}`] : "",
      red ? styles.onRed : "",
      m.blink ? styles.blink : "",
    ]
      .filter(Boolean)
      .join(" ");
    return (
      <i key={m.id} className={cls} style={block(m)} data-t={m.t}>
        {m.k === "plate" || m.k === "box" ? <b /> : null}
      </i>
    );
  });
  return (
    <div className={styles.decor} aria-hidden="true">
      <RedLines />
      {nodes}
    </div>
  );
}
