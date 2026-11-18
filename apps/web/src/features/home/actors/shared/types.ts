import type { SectionCtx } from "../../kernel/types";

/**
 * What an actor needs to build itself and to register its hit targets. A section passes its own
 * context (it has more than this), the lab passes a plain one.
 */
export type ActorCtx = Pick<
  SectionCtx,
  "stage" | "actors" | "pointer" | "cursor" | "viewport" | "audio"
>;
