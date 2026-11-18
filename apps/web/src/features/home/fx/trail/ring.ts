/**
 * The points a trail remembers: a fixed ring of (x, y, time), oldest overwritten when it is full.
 * Positions are in the stage's pixel frame. Nothing is allocated after the constructor.
 */
export class TrailHistory {
  readonly x: Float32Array;
  readonly y: Float32Array;
  readonly t: Float32Array;
  /** Points held. */
  length = 0;
  /** The slot of the oldest point. */
  private start = 0;

  constructor(readonly capacity: number) {
    this.x = new Float32Array(capacity);
    this.y = new Float32Array(capacity);
    this.t = new Float32Array(capacity);
  }

  reset(): void {
    this.length = 0;
    this.start = 0;
  }

  push(x: number, y: number, t: number): void {
    let at: number;
    if (this.length < this.capacity) {
      at = (this.start + this.length) % this.capacity;
      this.length += 1;
    } else {
      at = this.start;
      this.start = (this.start + 1) % this.capacity;
    }
    this.x[at] = x;
    this.y[at] = y;
    this.t[at] = t;
  }

  /** The slot of the `i`th newest point (0 is the newest). `i` must be below `length`. */
  newest(i: number): number {
    return (this.start + this.length - 1 - i + this.capacity * 2) % this.capacity;
  }

  /** The time of the newest point, or `-Infinity` when there is none. */
  newestTime(): number {
    return this.length === 0 ? -Infinity : this.t[this.newest(0)]!;
  }

  /** Forget the points older than `time`. */
  dropBefore(time: number): void {
    while (this.length > 0 && this.t[this.start]! < time) {
      this.start = (this.start + 1) % this.capacity;
      this.length -= 1;
    }
  }
}
