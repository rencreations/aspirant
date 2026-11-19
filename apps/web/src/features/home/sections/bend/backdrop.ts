import type { BackdropKind, BackdropOptions } from "../../fx/backdrop";

import { T, type BeatState } from "./beats";

/** What the section asks of the live backdrop at a moment of its clock. */
export interface BackdropAsk {
  readonly kind: BackdropKind;
  readonly options: BackdropOptions;
}

const ask = (kind: BackdropKind, options: BackdropOptions): BackdropAsk => ({ kind, options });

/** The chase's last backdrop goes on while the book closes (the same call: no cross-fade at the joint). */
const COMIC = ask("pixel-blast", { amount: 0.5, speed: 0.7 });
/**
 * A stance lasts about 0.45 s, so the four elements cross in 0.2 s and each one stands formed for a
 * moment. At the default 0.5 s they were never whole (each was gone before it had come in).
 */
export const ELEMENT_FADE = 0.2;
/** The four stances: the element she bends, drawn behind her. */
const ELEMENT: readonly BackdropAsk[] = [
  ask("earth", { amount: 0.85, fade: ELEMENT_FADE }),
  ask("air", { amount: 0.85, fade: ELEMENT_FADE }),
  ask("water", { amount: 0.85, fade: ELEMENT_FADE }),
  ask("fire", { amount: 0.85, fade: ELEMENT_FADE }),
];
/** The wall of fan art stands: soft pools of colour behind the pictures. */
const WALL = ask("soft-aurora", { amount: 0.85, speed: 0.8 });
/** The ring turns and is thrown: thin-film colour. */
const RING = ask("iridescence", { amount: 0.75, speed: 0.9 });
/** The splash arts stand and turn: slow ribbons of light. */
const SPIRAL = ask("aurora", { amount: 0.7, speed: 0.8 });
/** The drone and Tetra: floating soft dots, air to breathe in. */
const MEET = ask("particles", { amount: 0.85, speed: 0.8 });

/** The backdrop for a beat: one kind for each part (a 0.5 s cross-fade joins them). */
export function backdropAt(b: BeatState): BackdropAsk {
  const s = b.s;
  if (s < T.bendFrom) return COMIC;
  if (s < T.holdFrom) return ELEMENT[Math.min(3, Math.max(0, b.wave))]!;
  if (s < T.gatherFrom + 0.1) return WALL;
  if (s < T.spiralFrom) return RING;
  if (s < T.advFrom) return SPIRAL;
  if (s < T.glideFrom) return SPIRAL;
  return MEET;
}
