import type { CSSProperties } from "react";

import type { Doodle } from "./alone-data";

/** Strokes of each doodle. Every path is drawn in turn when its entry comes into view. */
const PATHS: Record<Doodle, readonly string[]> = {
  window: [
    "M34 156V70Q34 20 80 20Q126 20 126 70V156Z",
    "M80 20V156M34 92H126",
    "M46 156H114M26 164H134",
    "M58 52L66 60M96 46L104 54",
  ],
  coat: [
    "M52 30L80 46L108 30L126 44L134 150H26L34 44Z",
    "M80 46V150",
    "M80 74h8M80 98h8M80 122h8",
    "M52 30Q80 8 108 30",
  ],
  gloves: [
    "M30 98Q22 62 52 54Q74 48 88 66Q96 40 120 50Q146 62 130 102Q122 140 84 146Q40 148 30 98Z",
    "M52 54Q56 78 70 88",
    "M88 66Q92 84 104 92",
    "M44 118Q70 130 118 118",
  ],
  suitcase: [
    "M28 70H132V148H28Z",
    "M62 70V52Q62 44 70 44H90Q98 44 98 52V70",
    "M28 98H132",
    "M74 98V112H86V98",
    "M44 70V148M116 70V148",
  ],
  score: [
    "M42 18H118V152H42Z",
    "M42 18L28 32V166H104L118 152",
    "M58 52H102M58 74H102M58 96H88",
    "M76 124a22 22 0 1 0 44 0a22 22 0 1 0 -44 0",
    "M86 124L96 134L112 114",
  ],
  star: [
    "M80 14L94 60L142 74L94 88L80 134L66 88L18 74L66 60Z",
    "M80 40L87 66L112 74L87 82L80 108L73 82L48 74L73 66Z",
    "M28 150h16M116 150h16M70 160h20",
  ],
  stair: [
    "M30 160V130H64V100H98V70H132V40",
    "M30 160H132",
    "M30 130H64M64 100H98M98 70H132",
    "M104 28Q112 10 124 20",
    "M120 56l12-12M124 24l14-4",
  ],
};

/** A small ink drawing for the margin of an entry. */
export function DoodleArt({ kind, className }: { kind: Doodle; className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 160 180"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {PATHS[kind].map((d, i) => (
        <path key={i} d={d} pathLength={1} style={{ "--k": i } as CSSProperties} />
      ))}
    </svg>
  );
}
