import { StubRuntime } from "../../kernel/stub";
import type { SectionCtx, SectionRuntime } from "../../kernel/types";

/** The walking skeleton's runtime: it only fades the copy. The section's owner replaces it. */
export function createRuntime(ctx: SectionCtx): SectionRuntime {
  return new StubRuntime(ctx, { fadeIn: false, fadeOut: false });
}
