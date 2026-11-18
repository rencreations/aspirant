/**
 * When does a wheel, a touch or a key mean "I want to go on"? The page is held while the scene
 * arrives, and the first scroll that comes after the scene stands lets it go (nobody is trapped).
 * But the hold swallows the scroll that brought the visitor here, and a trackpad goes on sending
 * events for a second after the fingers lift. That tail must not count: only a fresh gesture,
 * which begins after the scene stood, does. Pure arithmetic, no DOM.
 *
 * A gesture is a run of events with no gap longer than `QUIET_MS`. A gesture that began before the
 * gate was armed is the old one, and it stays old however long it goes on.
 */

/** A pause this long ends a gesture. */
export const QUIET_MS = 450;
/**
 * After the scene stands, a gesture that begins within this many milliseconds is too early: a visitor
 * swiping again and again through the arrival (each touch is a new gesture) would otherwise be let
 * go one swipe after the scene appeared, having hardly seen it.
 */
export const GRACE_MS = 1400;
/** Distance (pixels) a wheel gesture must cover to count. One notch of a mouse wheel is 100. */
export const WHEEL_PX = 100;
/** Distance (pixels) a touch drag must cover to count. */
export const TOUCH_PX = 36;

export class IntentGate {
  private since = Number.POSITIVE_INFINITY;
  private lastAt = Number.NEGATIVE_INFINITY;
  private began = Number.NEGATIVE_INFINITY;
  private travel = 0;

  /**
   * The scene stands now (or a record was picked now): gestures that began earlier than `now` plus
   * the grace do not count. A pick passes 0 for the grace: the visitor has just pressed, not scrolled.
   */
  arm(now: number, graceMs: number = GRACE_MS): void {
    this.since = now + graceMs;
  }

  /** The scene does not stand: nothing counts. */
  disarm(): void {
    this.since = Number.POSITIVE_INFINITY;
  }

  get armed(): boolean {
    return this.since !== Number.POSITIVE_INFINITY;
  }

  /** A finger went down: whatever comes next is a new gesture. */
  begin(): void {
    this.lastAt = Number.NEGATIVE_INFINITY;
  }

  /**
   * One wheel event or one touch move of `px` pixels at time `now` (milliseconds). True when the
   * gesture has covered `limit` pixels and began after the gate was armed.
   */
  feed(now: number, px: number, limit: number): boolean {
    if (now - this.lastAt > QUIET_MS) {
      this.began = now;
      this.travel = 0;
    }
    this.lastAt = now;
    this.travel += Math.abs(px);
    if (this.began < this.since) return false;
    return this.travel >= limit;
  }
}

/** The keys that scroll a page down: they never need a gesture, a key press is deliberate. */
export function isScrollOnKey(key: string): boolean {
  return key === " " || key === "PageDown" || key === "ArrowDown" || key === "End";
}

/** A touch that lifts within this many pixels of where it began, and soon enough, is a tap. */
export const TAP_PX = 12;
export const TAP_MS = 600;

/**
 * Was a touch a tap? The pointer hub reports a press the moment a finger goes down, but a finger
 * that goes down on a sleeve may be the start of a scroll. The pick counts only when the finger
 * lifts almost where it began, and soon (a cancel, which is the browser taking the gesture for a
 * scroll, never counts).
 */
export function isTap(dx: number, dy: number, ms: number): boolean {
  return dx * dx + dy * dy <= TAP_PX * TAP_PX && ms >= 0 && ms <= TAP_MS;
}
