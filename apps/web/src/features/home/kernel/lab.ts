/**
 * The lab: a way to see one actor on the real stage, in the real renderer, from a probe or a
 * Playwright script, with no section in charge of it. `window.__home.lab("silverbolt")` builds the
 * actor (through its own `ensure`), pins it shown (the kernel's hide-by-default skips a pinned
 * actor) and returns the actor itself, so a script can place it, pose it and look at a frame.
 * `window.__home.unpin(name)` gives it back to the sections.
 *
 * Every actor adds one line to `LABS`. The imports are lazy, so a visitor never loads the table's
 * actors for it: a section's own `mount` loads what it uses.
 */
import type { ActorCtx } from "../actors/shared/types";
import type { Actor } from "./types";

type Ensure = (ctx: ActorCtx) => Promise<Actor>;

export const LABS: Readonly<Record<string, Ensure>> = {};
