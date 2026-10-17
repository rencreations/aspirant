import type { FrameShape } from "@/components/frame/frame-shapes";
import type { PairId } from "@/content/types";

/** Frame shapes by the proportions they suit. The index keeps a row from repeating itself. */
const WIDE: readonly FrameShape[] = ["chamfer", "parallelogram", "rift", "ticket"];
const SQUARE: readonly FrameShape[] = ["hex", "bite", "emblem"];
const TALL: readonly FrameShape[] = ["arch", "star", "chamfer"];

export type Orientation = "wide" | "square" | "tall";

export function orientationOf(width: number, height: number): Orientation {
  const ratio = width / height;
  if (ratio > 1.25) return "wide";
  if (ratio < 0.8) return "tall";
  return "square";
}

export function pickShape(orientation: Orientation, index: number): FrameShape {
  const list = orientation === "wide" ? WIDE : orientation === "square" ? SQUARE : TALL;
  return list[index % list.length] ?? "chamfer";
}

/** The width over height each shape wants, so that rows of frames line up. */
export function shapeRatio(shape: FrameShape, imageRatio: number): number {
  switch (shape) {
    case "hex":
    case "bite":
    case "emblem":
    case "circle":
      return 1;
    case "arch":
      return 0.78;
    case "star":
      return 0.85;
    case "parallelogram":
      return 1.6;
    case "ticket":
      return 1.5;
    case "rift":
      return Math.min(1.7, Math.max(0.9, imageRatio));
    default:
      return Math.min(1.8, Math.max(0.75, imageRatio));
  }
}

/** Glow colour per pair, tuned to read on the dark surface (the pair palettes are darker). */
const PAIR_ACCENT: Readonly<Record<PairId, string>> = {
  "fanny-layla": "#ff8a68",
  "ruby-angela": "#ffb28c",
  "lesley-change": "#ff8fc7",
  "guinevere-vexana": "#b891ff",
  "selena-obsidia": "#8fcfff",
};

export function pairAccent(pair: PairId | null): string | undefined {
  return pair ? PAIR_ACCENT[pair] : undefined;
}
