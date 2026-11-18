import type { Actor, Actors } from "./types";

/**
 * The registry of everything the stage draws and a section drives. The rule that makes the scroll
 * stateless: before the sections run in a frame every actor is hidden, so an actor that no section
 * sets is not shown, and when two sections set the same actor the later one wins.
 */
export class ActorRegistry implements Actors {
  private readonly byName = new Map<string, Actor>();

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
    for (const actor of this.byName.values()) actor.visible = false;
  }

  apply(): void {
    for (const actor of this.byName.values()) {
      if (actor.object) actor.object.visible = actor.visible;
    }
  }

  dispose(): void {
    for (const actor of this.byName.values()) actor.dispose?.();
    this.byName.clear();
  }
}
