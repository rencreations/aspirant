/**
 * The one-shot reactions to being touched. A reaction is a pulse: it rises, holds and falls on its
 * own clock, and always ends, whatever the pointer does next (the pointer only starts one). Two
 * touches in a row restart the pulse from where it is, so the figure never snaps.
 */
import { smoothstep } from "./motion";

export class Pulse {
  private age = 0;
  private length = 0;
  private attack = 0;
  private release = 0;
  /** Where the value was when a new pulse started on top of a running one. */
  private from = 0;
  private current = 0;

  /** Start (or restart) the pulse: it rises over `attack`, falls over `release`, `length` in all. */
  start(length: number, attack = 0.12, release = 0.5): void {
    this.from = this.current;
    this.age = 0;
    this.length = Math.max(length, attack + 0.05);
    this.attack = attack;
    this.release = Math.min(release, this.length - attack);
  }

  /** 0 to 1. */
  get value(): number {
    return this.current;
  }

  get active(): boolean {
    return this.age < this.length;
  }

  /** Advance by `dt` seconds. A `dt` of 0 changes nothing. */
  step(dt: number): number {
    if (!(dt > 0) || this.age >= this.length) {
      if (this.age >= this.length) this.current = 0;
      return this.current;
    }
    this.age = Math.min(this.length, this.age + dt);
    const rise = smoothstep(this.age / this.attack);
    const fall = 1 - smoothstep((this.age - (this.length - this.release)) / this.release);
    const env = Math.min(rise, fall);
    // A restart blends out of the value it began from, so there is no jump.
    const blend = this.from * (1 - rise);
    this.current = Math.max(env, Math.min(1, blend * fall));
    if (this.age >= this.length) this.current = 0;
    return this.current;
  }

  /** Stop at once (a jump). */
  reset(): void {
    this.age = this.length;
    this.current = 0;
    this.from = 0;
  }
}
