import type { Actor, Actors, FrameInfo } from "./types";

/**
 * The registry of everything the stage draws and a section drives. The rule that makes the scroll
 * stateless: before the sections run in a frame every actor is hidden, so an actor that no section
 * sets is not shown, and when two sections set the same actor the later one wins.
 */
export class ActorRegistry implements Actors {
  private readonly byName = new Map<string, Actor>();
  /** Actors a probe holds shown (the lab): the hide-by-default rule skips them. */
  private readonly pinned = new Set<string>();

  pin(name: string, on: boolean): void {
    if (on) this.pinned.add(name);
    else this.pinned.delete(name);
  }

  register<T extends Actor>(actor: T): T {
    if (this.byName.has(actor.name)) throw new Error(`actor "${actor.name}" is already registered`);
    this.byName.set(actor.name, actor);
    return actor;
  }

  /** Take an actor out (a section that goes). Disposes it. */
  remove(name: string): void {
    const actor = this.byName.get(name);
    if (!actor) return;
    this.byName.delete(name);
    actor.dispose?.();
  }

  get(name: string): Actor | undefined {
    return this.byName.get(name);
  }

  list(): readonly Actor[] {
    return Array.from(this.byName.values());
  }

  hideAll(): void {
    for (const actor of this.byName.values()) actor.visible = this.pinned.has(actor.name);
  }

  apply(): void {
    for (const actor of this.byName.values()) {
      if (actor.object) actor.object.visible = actor.visible;
    }
  }

  update(frame: FrameInfo): void {
    for (const actor of this.byName.values()) {
      if (actor.visible) actor.update?.(frame);
    }
  }

  dispose(): void {
    for (const actor of this.byName.values()) actor.dispose?.();
    this.byName.clear();
  }
}
