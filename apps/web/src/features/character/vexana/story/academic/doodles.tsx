import type { CSSProperties } from "react";

import type { Doodle } from "./academic-data";

/** Strokes of each doodle. Every path is drawn in turn when its entry comes into view. */
const PATHS: Record<Doodle, readonly string[]> = {
  gate: [
    "M10 150H150",
    "M30 150V64M130 150V64",
    "M30 64Q80 18 130 64",
    "M52 150V46M72 150V34M92 150V34M112 150V46",
    "M20 14l-5 15M58 8l-5 15M100 10l-5 15M140 16l-5 15",
  ],
  plum: [
    "M80 56C45 56 28 84 38 114C46 140 70 148 80 142C90 148 114 140 122 114C132 84 115 56 80 56Z",
    "M80 56C80 42 86 32 96 28",
    "M96 28C108 20 122 24 126 34C114 40 102 38 96 28Z",
    "M52 92C54 82 62 74 72 72",
  ],
  lamp: [
    "M48 44H112L132 88H28Z",
    "M80 88V134",
    "M54 140H106",
    "M62 140Q80 128 98 140",
    "M80 28V12M44 32L36 20M116 32L124 20",
  ],
  doughnut: [
    "M20 88a60 60 0 1 0 120 0a60 60 0 1 0 -120 0",
    "M64 88a16 16 0 1 0 32 0a16 16 0 1 0 -32 0",
    "M32 70Q50 46 80 52T130 66",
    "M52 72l8-4M96 60l8 6M112 104l8-6M58 112l8 4M78 46l4 8",
  ],
  bag: [
    "M44 52H116L124 150H36Z",
    "M44 52L52 34H108L116 52",
    "M52 34Q80 46 108 34",
    "M62 52Q80 22 98 52",
    "M64 100l32 0M64 118l32 0",
  ],
  fireworks: [
    "M80 64L80 22M80 64L110 34M80 64L122 64M80 64L110 94M80 64L80 106M80 64L50 94M80 64L38 64M80 64L50 34",
    "M80 118L88 138L108 146L88 154L80 174L72 154L52 146L72 138Z",
    "M20 130l5 0M135 126l5 0M28 110l0 5",
  ],
  rift: [
    "M80 8C114 28 120 82 102 152C94 164 66 164 58 152C40 82 46 28 80 8Z",
    "M80 8L72 48L86 80L70 122",
    "M80 38C96 60 98 100 90 142",
    "M20 90l16 0M126 90l16 0M30 120l12 0",
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
