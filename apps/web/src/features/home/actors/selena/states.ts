/**
 * Selena's four states in the character page and the room after it (round seven). Pure, no three.js.
 *
 *   POSE     loops `city_interaction_R_loop` (the hands at the mouth, the list's 4:5 frame)
 *   TO_IDLE  plays `city_interaction_back_R` once (the frame is growing)
 *   IDLE     loops `city_idle` (the frame is whole, the room)
 *   TO_POSE  plays `city_interaction_R` once (the frame is shrinking back)
 *
 * The scene gives one number, the growth of the frame (`expand`, 0 to 1). It becomes a target with
 * a hysteresis (idle once it passes `TO_IDLE_AT` going up, pose once it falls below `TO_POSE_AT`
 * going down), so a scroll that rests near one value never flips her. A transition clip always
 * plays to its end on her own clock and is never cut or scrubbed by the scroll. At its end the
 * machine looks at the target again: if the visitor reversed meanwhile, the opposite transition
 * starts at once. The visitor who stops half way therefore sees the clip that began finish by
 * itself, then the loop that matches where the frame has come to rest.
 */

export type SelenaState = "pose" | "toIdle" | "idle" | "toPose";

export const TO_IDLE_AT = 0.12;
export const TO_POSE_AT = 0.04;

/** Cross fade seconds into each state (the seams the notes measured are all under 4 cm). */
export const STATE_FADE: Readonly<Record<SelenaState, number>> = {
  pose: 0.15,
  toIdle: 0.12,
  idle: 0.15,
  toPose: 0.12,
};

export class StateMachine {
  state: SelenaState;
  private wantIdle: boolean;

  constructor(wantIdle = false) {
    this.wantIdle = wantIdle;
    this.state = wantIdle ? "idle" : "pose";
  }

  /** True when the target is the idle. */
  get idleWanted(): boolean {
    return this.wantIdle;
  }

  /** True while a transition clip plays. */
  get inTransition(): boolean {
    return this.state === "toIdle" || this.state === "toPose";
  }

  /** The target from the growth of the frame, with the hysteresis. */
  target(expand: number): void {
    if (this.wantIdle) {
      if (expand < TO_POSE_AT) this.wantIdle = false;
    } else if (expand > TO_IDLE_AT) {
      this.wantIdle = true;
    }
  }

  /** A seek or a reload: the loop that matches, no transition. */
  jump(expand: number): void {
    this.wantIdle = expand >= (TO_IDLE_AT + TO_POSE_AT) / 2;
    this.state = this.wantIdle ? "idle" : "pose";
  }

  /**
   * One step. `ended` is true when the transition clip that plays has reached its end. Returns the
   * state she has just entered, or null when nothing changed (so the caller starts a clip only then).
   */
  step(ended: boolean): SelenaState | null {
    const was = this.state;
    switch (was) {
      case "pose":
        if (this.wantIdle) this.state = "toIdle";
        break;
      case "idle":
        if (!this.wantIdle) this.state = "toPose";
        break;
      case "toIdle":
        if (ended) this.state = this.wantIdle ? "idle" : "toPose";
        break;
      case "toPose":
        if (ended) this.state = this.wantIdle ? "toIdle" : "pose";
        break;
    }
    return this.state === was ? null : this.state;
  }
}

/** What reacts to the cursor in a state: the head and eyes in the two loops, the parallax in the idle only. */
export function interactionOf(state: SelenaState): { look: number; view: number } {
  switch (state) {
    case "pose":
      return { look: 1, view: 0 };
    case "idle":
      return { look: 1, view: 1 };
    default:
      return { look: 0, view: 0 };
  }
}
