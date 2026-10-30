import type { CSSProperties, ReactNode } from "react";

import type { RosterPair } from "./entries";
import { BAYS, BOARD_W, LEAN, mid, SLASH, SLOTS } from "./layout";
import styles from "./roster.module.css";

/**
 * The small print of the wall, kept to a minimum: a thin ruler above and below the panels, one
 * line of type for each pair, and two marks and a few rails on the red side. All of it is drawn on
 * one layer in board units, thin and low in contrast, so the panels stay in front. It is
 * decoration: nothing here is read by assistive technology (the words are painted by the
 * stylesheet from `data-t`) and nothing takes the pointer.
 */

const n2 = (n: number) => String(n).padStart(2, "0");
/** Is a point of the board on the red side of the slash? */
const redAt = (x: number, y: number) => x < SLASH.x - LEAN * (y - SLASH.y) - 6;

type Kind = "ruler";

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
  /** Ghost type or vertical type. */
  readonly s?: "ghost" | "vert";
}

const block = (m: Mark): CSSProperties =>
  ({
    "--x": m.x,
    "--y": m.y,
    "--w": m.w,
    "--h": m.h,
  }) as CSSProperties;

function build(pairs: readonly RosterPair[]): Mark[] {
  const marks: Mark[] = [];
  let id = 0;
  const add = (m: Omit<Mark, "id">) => marks.push({ id: `m${id++}`, ...m });
  const names = new Map(pairs.map((p) => [p.id, p.names.toUpperCase()]));

  // One thin ruler above the panels and one below, with a coordinate every 300 units.
  for (const y of [-9, 387]) add({ x: 0, y, k: "ruler", w: BOARD_W, h: 2.2 });
  for (let x = 300; x < BOARD_W; x += 300) {
    add({ x: x + 1.5, y: -17, t: `X ${String(x).padStart(4, "0")}` });
    add({ x: x + 1.5, y: 393.5, t: `X ${String(x).padStart(4, "0")}` });
  }

  const centres = BAYS.map((bay) => {
    const ss = SLOTS.filter((s) => s.pair === bay);
    return ss.reduce((sum, s) => sum + mid(s), 0) / ss.length;
  });

  // One line above each pair and one below it.
  BAYS.forEach((bay, b) => {
    const x0 = b === 0 ? 150 : ((centres[b - 1] ?? 0) + (centres[b] ?? 0)) / 2 + 8;
    add({ x: x0, y: -26, t: `PAIR ${n2(b + 1)} / ${names.get(bay) ?? ""}` });
    add({ x: x0, y: 400, t: `END OF PAIR ${n2(b + 1)}` });
  });

  // The red side keeps two marks: a ghost number and one vertical line of type.
  add({ x: -4, y: 232, t: "04", s: "ghost" });
  add({ x: 6, y: 60, t: "ASPIRANT ROSTER 04 / TEN ASPIRANTS / FIVE PAIRS", s: "vert" });
  return marks;
}

/** The thin parts of the red side: two soft bands and a few rails along the lean. */
function RedLines() {
  const rails = [44, 92, 200];
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
      ].map(([c, wide, cls]) => (
        <path
          key={String(c)}
          d={`M${reach(Number(c), -112)} -112L${reach(Number(c) + Number(wide), -112)} -112L${reach(Number(c) + Number(wide), 512)} 512L${reach(Number(c), 512)} 512Z`}
          className={String(cls)}
        />
      ))}
      {rails.map((c) => (
        <line key={c} x1={reach(c, -112)} y1={-112} x2={reach(c, 512)} y2={512} strokeWidth={0.6} />
      ))}
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
    ]
      .filter(Boolean)
      .join(" ");
    return <i key={m.id} className={cls} style={block(m)} data-t={m.t} />;
  });
  return (
    <div className={styles.decor} aria-hidden="true">
      <RedLines />
      {nodes}
    </div>
  );
}
