/**
 * The wall's own slide, the mechanics of premotio's carousel made automatic: the rows glide by a
 * rate the section sets, a hovered card stops the glide (eased over about a third of a second), and
 * it resumes after the pointer has left. Position and speed are plain numbers.
 */
export interface Carousel {
  /** Distance slid, in the wall plane's pixels. */
  pos: number;
  /** Current speed, px/s. */
  speed: number;
  /** Seconds left before the glide resumes after a hold. */
  resume: number;
}

export const makeCarousel = (): Carousel => ({ pos: 0, speed: 0, resume: 0 });

/** The time constant of the stop and of the start, in seconds. */
const STOP_TAU = 0.1;
const START_TAU = 0.3;
/** The pause after a hold before the rows move again. */
export const RESUME_DELAY = 0.35;

/**
 * Advance the carousel by `dt`. `rate` is the speed the section wants (px/s, negative goes the
 * other way). While `hold` is true the target speed is zero. Returns the new position.
 */
export function stepCarousel(c: Carousel, dt: number, rate: number, hold: boolean): number {
  if (!(dt > 0)) return c.pos;
  if (hold) c.resume = RESUME_DELAY;
  else c.resume = Math.max(0, c.resume - dt);
  const want = hold || c.resume > 0 ? 0 : rate;
  const tau = want === 0 ? STOP_TAU : START_TAU;
  c.speed += (want - c.speed) * (1 - Math.exp(-dt / tau));
  if (Math.abs(c.speed) < 0.01 && want === 0) c.speed = 0;
  c.pos += c.speed * dt;
  return c.pos;
}
