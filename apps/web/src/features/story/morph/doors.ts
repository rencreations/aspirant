/**
 * The cards at the foot of the chapter on screen, by the chapter they lead to (`end` for the end
 * page). The pull at the bottom of the page starts the card's morph through it, and the pull at the
 * top waits here for the card of the chapter before to come on the page.
 */
export interface DoorHandle {
  /** The card (the link). */
  readonly el: HTMLElement;
  /** Start the morph through this card, as a press on it does. False when it did not start. */
  readonly start: (keyboard: boolean) => Promise<boolean>;
}

const doors = new Map<string, DoorHandle>();

export function registerDoor(key: string, handle: DoorHandle): () => void {
  doors.set(key, handle);
  return () => {
    if (doors.get(key) === handle) doors.delete(key);
  };
}

export function findDoor(key: string): DoorHandle | undefined {
  return doors.get(key);
}

/** The card for `key` once it is on the page (checked every frame), or null after `frames`. */
export function whenDoor(key: string, frames = 240): Promise<DoorHandle | null> {
  return new Promise((resolve) => {
    let left = frames;
    const look = () => {
      const door = doors.get(key);
      if (door?.el.isConnected) {
        resolve(door);
        return;
      }
      left -= 1;
      if (left <= 0) {
        resolve(null);
        return;
      }
      requestAnimationFrame(look);
    };
    look();
  });
}
