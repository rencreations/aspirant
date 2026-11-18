/**
 * The hook for comic marks. Silverbolt does not draw sweat drops, anger veins, sparks or smoke (the
 * comic marks helper does, in the `marks` pass). It says when one belongs and where: an event with
 * a kind, the socket it belongs at (a point that follows the animated bone, so the mark can be
 * parented to it or read its position every frame) and a strength from 0 to 1.
 *
 * ```ts
 * const off = silverbolt.onMark((m) => marks.spawn(m.kind, m.at, m.strength));
 * ```
 */
import type { Object3D } from "three";

export type MarkKind =
  /** A poke on the head: sparks off the horns. */
  | "sparks"
  /** Annoyed breath from the snout, every few tenths of a second. */
  | "smoke"
  /** The anger vein on the forehead (the outburst starts). */
  | "vein"
  /** A drop of sweat (the doll is on its head, a long drag on the tail). */
  | "sweat"
  /** Dizzy stars over the head (after a hard shake). */
  | "stars"
  /** A gust of wind off the wings (a poke on a wing). */
  | "gust"
  /** The body puffed up. */
  | "puff"
  /** A heart: it enjoys being petted. */
  | "heart"
  /** A bite: the jaws closed (a chomp). */
  | "chomp";

export interface MarkEvent {
  kind: MarkKind;
  /** The name of the socket: `headTop`, `mouth`, `snout`, `wingL`, `wingR`, `tailTip`, `bodyCentre`, `cheekL`, `cheekR`. */
  socket: string;
  /** The socket itself, an Object3D that follows the bone. */
  at: Object3D;
  /** 0 to 1. */
  strength: number;
}

export type MarkListener = (event: MarkEvent) => void;

/** A tiny emitter, no allocation but the event. */
export class MarkBus {
  private readonly listeners = new Set<MarkListener>();

  on(listener: MarkListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  emit(event: MarkEvent): void {
    for (const listener of this.listeners) listener(event);
  }

  get size(): number {
    return this.listeners.size;
  }
}
