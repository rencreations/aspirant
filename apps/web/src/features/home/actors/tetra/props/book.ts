import { clamp01, easeOutBack, ramp, springTo, type Sprung } from "../ease";

/**
 * The comic book as arithmetic: how far it is out of her pocket, how open, and where a page is in
 * its turn. Pure, no three. The mesh (`book-mesh.ts`) lays this on its boards.
 *
 * Seen from the visitor's side the book shows its outsides: the back cover on the left and the front
 * cover on the right when it is open, only the back cover when it is shut. The two covers carry the
 * two comics. A page turns over the top and the spine.
 */

/** How the open book is bent: each board leans back from the spine by this much (radians). */
export const OPEN_V = 0.32;

/** The boards' angles about the spine for an openness from 0 (shut) to 1 (open). */
export function boardAngles(
  open: number,
  out: { front: number; back: number } = { front: 0, back: 0 },
): { front: number; back: number } {
  const o = clamp01(open);
  // The front board lies behind the back board when shut (half a turn about the spine) and swings
  // round to the right. It leaves quickly and settles slowly, so the cover seems to lift.
  const lift = 1 - Math.pow(1 - o, 1.6);
  out.front = Math.PI + (OPEN_V - Math.PI) * lift;
  out.back = -OPEN_V * ramp(0.35, 1, o);
  return out;
}

/** How long a page takes to turn, in seconds. */
export const TURN_SECONDS = 0.9;

/**
 * Where a turning page is, from 0 (flat on the right) to 1 (flat on the left), as an angle about
 * the spine and a lift (the page rises over the top as it goes). `progress` is 0 to 1.
 */
export function pageTurn(
  progress: number,
  out: { angle: number; lift: number; bend: number } = { angle: 0, lift: 0, bend: 0 },
): { angle: number; lift: number; bend: number } {
  const p = clamp01(progress);
  const eased = p * p * (3 - 2 * p);
  out.angle = eased * Math.PI;
  out.lift = Math.sin(Math.PI * p);
  out.bend = out.lift;
  return out;
}

/** The pop of the book out of nowhere: a scale that rises past 1 and settles. */
export function popScale(present: number): number {
  const p = clamp01(present);
  return p <= 0 ? 0 : easeOutBack(p, 1.2);
}

export class BookState {
  /** 0 away (in her pocket), 1 in her hands. */
  readonly present: Sprung = { x: 0, v: 0 };
  /** 0 shut, 1 open. */
  readonly open: Sprung = { x: 0, v: 0 };
  /** The page being turned: 0 to 1, or -1 for none. */
  turning = -1;
  /** How many pages have been turned (the pictures on the pages follow it). */
  turned = 0;

  /** Where the book wants to be. */
  wantPresent = 0;
  wantOpen = 0;

  /** Start turning a page. Ignored while one is turning. */
  turnPage(): boolean {
    if (this.turning >= 0 || this.open.x < 0.85) return false;
    this.turning = 0;
    return true;
  }

  /** The book is where it is asked to be, at once. */
  snap(): void {
    this.present.x = this.wantPresent;
    this.present.v = 0;
    this.open.x = this.wantOpen;
    this.open.v = 0;
    this.turning = -1;
  }

  step(dt: number): void {
    springTo(this.present, this.wantPresent, 9, dt);
    // A book that is away is gone, not a speck: the spring's tail is cut.
    if (this.wantPresent === 0 && this.present.x < 0.02) {
      this.present.x = 0;
      this.present.v = 0;
    }
    // It opens a little after it arrives in her hands, and shuts before it goes.
    const arrived = ramp(0.6, 0.95, this.present.x);
    springTo(this.open, this.wantOpen * arrived, 9, dt);
    if (this.turning >= 0) {
      this.turning += dt / TURN_SECONDS;
      if (this.turning >= 1) {
        this.turning = -1;
        this.turned += 1;
      }
    }
  }
}
