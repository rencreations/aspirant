/**
 * Whether a scene's actors are built, and how patiently they are built. A scene builds in pauses of
 * the scroll (a long task between two wheel events is hidden by a still page). A visitor who has
 * already reached the section is waiting for the build: it must not wait for a pause then.
 *
 * `done` is what a runtime's `ready()` reports (a play does not fire before it). A build that fails
 * is finished too: one missing actor must not stop the page for ever.
 */
export class BuildGate {
  /** The build is over (it worked, or a part of it failed and was left out). */
  done = false;
  private urgent = false;
  private wake: () => void = () => undefined;
  private readonly woken = new Promise<void>((resolve) => {
    this.wake = resolve;
  });

  /** The visitor is at the section: the pauses of the build end at once from now on. */
  hurry(): void {
    if (this.urgent || this.done) return;
    this.urgent = true;
    this.wake();
  }

  get hurried(): boolean {
    return this.urgent;
  }

  /** Resolves when `quiet` does, or at once when the visitor is already waiting. */
  pause(quiet: () => Promise<void>): Promise<void> {
    if (this.urgent) return Promise.resolve();
    return Promise.race([quiet(), this.woken]);
  }

  finish(): void {
    this.done = true;
  }
}
