import { sectionScreens } from "../../kernel/where";
import { seg, smooth } from "../vp";
import { REST_U, STORY } from "./stations";

export { seg, smooth } from "../vp";
export const selenaScreens = (): number => sectionScreens("selena");
export const AT = { words: [0.15, 0.5] } as const;
export const WORD_IN = 0.35;

export function newBeats() {
  return { drawer: 0, room: 0, o: 0, clip: 0, wipe: 0, white: 0, whiteOut: 0, actors: true };
}

export type Beats = ReturnType<typeof newBeats>;

export function beatsAt(u: number, out = newBeats(), tail = 0): Beats {
  out.o = seg(u, REST_U, STORY);
  out.room = 1 - smooth(seg(out.o, 0, 0.11));
  out.drawer = smooth(seg(u, 0, 0.7)) * out.room;
  out.clip = seg(out.o, 0.12, 1) * 6.291667;
  // The second turn shows her back about four and a half seconds into the clip.
  out.wipe = smooth(seg(out.clip, 4.42, 5.95));
  out.white = out.wipe === 1 ? 1 : 0;
  out.whiteOut = smooth(seg(tail, 0.04, 0.45));
  out.actors = out.wipe < 1;
  return out;
}
