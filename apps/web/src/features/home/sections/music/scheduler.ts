/**
 * What happens, in order, after the visitor picks a record. A small state machine with no DOM and
 * no three: the runtime feeds it what the actors report (where the disc is, whether the needle is
 * down, how fast the platter turns) and does what it says (`commands`).
 *
 *   idle      the crate waits for a choice
 *   toCrate   the left drone flies over the crate
 *   fetch     the disc comes out of its sleeve and goes to that drone's glove
 *   carry     the drone flies to the platter with the disc
 *   place     the disc lands on the platter, the right drone starts to crank
 *   needle    the left drone lowers the needle, and the song begins
 *   back      the left drone flies home
 *   playing   the music sounds, the notes come out of the horn
 *   ended     the track ended: the needle is up, the crank stops, the disc waits
 *   lift      "another record": the needle goes up, the music fades, the drone goes to the platter
 *   return    the disc goes back to its sleeve
 */
export type Step =
  | "idle"
  | "toCrate"
  | "fetch"
  | "carry"
  | "place"
  | "needle"
  | "back"
  | "playing"
  | "ended"
  | "lift"
  | "return";

/** What the records actor calls the places of its disc. */
export type DiscPhase = "idle" | "picking" | "held" | "placing" | "seated" | "returning";

export type DroneSpot = "idle" | "crate" | "platter" | "needle";

export interface SchedulerInput {
  /** Seconds since the last call. */
  dt: number;
  discPhase: DiscPhase;
}

/** What the runtime should do this frame. */
export interface Commands {
  step: Step;
  /** The step that began since the last call, or null. The disc's targets are set on these edges. */
  entered: Step | null;
  /** The sleeve that was chosen, or null. */
  choice: number | null;
  /** The needle is down (`gramophone.setNeedle`). */
  needle: boolean;
  /** The right drone cranks. */
  crank: boolean;
  /** The track should be sounding (the runtime starts it once the needle is down and the platter is fast enough). */
  music: boolean;
  /** Where the left drone is. */
  spot: DroneSpot;
  /** The sleeves can be pressed. */
  interactive: boolean;
}

/** Seconds each step lasts at least. A step that waits for the disc gives up after `GIVE_UP`. */
export const TO_CRATE = 0.8;
export const CARRY = 1.1;
export const NEEDLE = 1.0;
export const BACK = 1.0;
export const LIFT = 1.0;
export const RETURN_AT = 1.1;
export const GIVE_UP = 5;

export class Scheduler {
  step: Step = "idle";
  private t = 0;
  private choice: number | null = null;
  private entered: Step | null = null;
  readonly commands: Commands = {
    step: "idle",
    entered: null,
    choice: null,
    needle: false,
    crank: false,
    music: false,
    spot: "idle",
    interactive: true,
  };

  /** A record was chosen (a sleeve was pressed, or a key). Only counts while the crate waits. */
  choose(index: number): boolean {
    if (this.step !== "idle") return false;
    this.choice = index;
    this.go("toCrate");
    return true;
  }

  /** "Another record": take this one off and put it back. Only counts once the disc is on its way to the platter or on it. */
  again(): boolean {
    if (
      this.step === "needle" ||
      this.step === "back" ||
      this.step === "playing" ||
      this.step === "ended"
    ) {
      this.go("lift");
      return true;
    }
    return false;
  }

  /** The track played to its end. */
  trackEnded(): void {
    if (this.step === "playing") this.go("ended");
  }

  /** Everything back to the start (the section was left). */
  reset(): void {
    this.choice = null;
    this.go("idle");
  }

  update(input: SchedulerInput): Commands {
    this.t += Math.max(0, input.dt);
    const phase = input.discPhase;
    switch (this.step) {
      case "toCrate":
        if (this.t >= TO_CRATE) this.go("fetch");
        break;
      case "fetch":
        if (phase === "held" || this.t >= GIVE_UP) this.go("carry");
        break;
      case "carry":
        if (this.t >= CARRY) this.go("place");
        break;
      case "place":
        if (phase === "seated" || this.t >= GIVE_UP) this.go("needle");
        break;
      case "needle":
        if (this.t >= NEEDLE) this.go("back");
        break;
      case "back":
        if (this.t >= BACK) this.go("playing");
        break;
      case "lift":
        if (this.t >= LIFT) this.go("return");
        break;
      case "return":
        if ((phase === "idle" && this.t >= RETURN_AT) || this.t >= GIVE_UP + RETURN_AT) {
          this.choice = null;
          this.go("idle");
        }
        break;
      default:
        break;
    }
    return this.write();
  }

  private go(step: Step): void {
    this.step = step;
    this.t = 0;
    this.entered = step;
  }

  private write(): Commands {
    const c = this.commands;
    const s = this.step;
    c.step = s;
    c.entered = this.entered;
    this.entered = null;
    c.choice = this.choice;
    c.needle = s === "needle" || s === "back" || s === "playing";
    c.crank = s === "place" || s === "needle" || s === "back" || s === "playing";
    // The song begins when the needle is on the record, not when the drone has flown home.
    c.music = s === "needle" || s === "back" || s === "playing";
    c.interactive = s === "idle";
    c.spot =
      s === "toCrate" || s === "fetch"
        ? "crate"
        : s === "carry" || s === "place" || s === "lift" || (s === "return" && this.t < RETURN_AT)
          ? "platter"
          : s === "needle"
            ? "needle"
            : s === "return"
              ? "crate"
              : "idle";
    return c;
  }
}
