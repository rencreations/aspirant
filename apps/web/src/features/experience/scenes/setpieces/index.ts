import type { ComponentType } from "react";

import type { SetPieceProps } from "../../contract";

export { SET_PIECE_ANCHORS } from "./anchors";

/** Lazy modules for each anchor id; the reader renders the piece after `anchor.after`. */
export const setPieceRegistry: Readonly<
  Record<string, () => Promise<{ default: ComponentType<SetPieceProps> }>>
> = {};
