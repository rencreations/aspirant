/**
 * The change between Selena's two forms (In Game), as times. Plain arithmetic: the stage plays it.
 *
 * The owner's sequence: whatever is playing blends into the form's idle; the idle blends into the
 * first transform clip; where the game sends that form under the ground it is hidden and the other
 * form takes over, playing the second transform clip from the matching time; that blends into the
 * other form's idle; then the switch can be used again.
 */
export interface FormsLeg {
  /** The first clip (on the form that leaves). */
  first: string;
  /** When, in the first clip, the form is sent under the ground and hidden. */
  hideAt: number;
  /** The second clip (on the form that arrives). */
  second: string;
  /** Where the second clip starts when it takes over. */
  secondFrom: number;
}

export interface FormsData {
  roots: { normal: string; abyssal: string };
  toAbyssal: FormsLeg;
  toNormal: FormsLeg;
}

export interface ChangeTimes {
  /** The blend of what was playing into the idle ends. */
  idleAt: number;
  /** The first clip starts (its blend from the idle starts here). */
  firstAt: number;
  /** The swap: the first form is hidden, the second shows, playing the second clip. */
  swapAt: number;
  /** The blend of the second clip into the arriving form's idle starts. */
  settleAt: number;
  /** All done: the switch works again. */
  doneAt: number;
}

export const FADE_TO_IDLE = 0.3;
export const HOLD_IDLE = 0.18;
export const FADE_TO_FIRST = 0.18;
export const FADE_TO_REST = 0.35;

/**
 * The times of one change from the moment the switch is pressed. `playingIdle` is true when the
 * form already rests in its idle (no blend needed); `secondLength` is the second clip's length.
 */
export function changeTimes(
  leg: FormsLeg,
  playingIdle: boolean,
  secondLength: number,
): ChangeTimes {
  const idleAt = playingIdle ? 0 : FADE_TO_IDLE;
  const firstAt = idleAt + HOLD_IDLE;
  const swapAt = firstAt + Math.max(0, leg.hideAt);
  const rest = Math.max(FADE_TO_REST, secondLength - leg.secondFrom);
  const settleAt = swapAt + rest - FADE_TO_REST;
  return { idleAt, firstAt, swapAt, settleAt, doneAt: settleAt + FADE_TO_REST };
}

/** The leg that goes from `from` to the other form. */
export function legOf(data: FormsData, from: string): FormsLeg {
  return from === "abyssal" ? data.toNormal : data.toAbyssal;
}

/** The other form. */
export function otherForm(form: string): "normal" | "abyssal" {
  return form === "abyssal" ? "normal" : "abyssal";
}

/** A forms record read from a file, or null when it is not one. */
export function readForms(raw: unknown): FormsData | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<FormsData>;
  const leg = (l: Partial<FormsLeg> | undefined): FormsLeg | null =>
    l &&
    typeof l.first === "string" &&
    typeof l.second === "string" &&
    Number.isFinite(l.hideAt) &&
    Number.isFinite(l.secondFrom)
      ? {
          first: l.first,
          second: l.second,
          hideAt: Number(l.hideAt),
          secondFrom: Number(l.secondFrom),
        }
      : null;
  const a = leg(r.toAbyssal);
  const n = leg(r.toNormal);
  if (!a || !n) return null;
  return {
    roots: {
      normal: typeof r.roots?.normal === "string" ? r.roots.normal : "normal",
      abyssal: typeof r.roots?.abyssal === "string" ? r.roots.abyssal : "abyssal",
    },
    toAbyssal: a,
    toNormal: n,
  };
}
