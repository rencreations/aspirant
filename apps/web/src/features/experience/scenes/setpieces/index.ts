import type { ComponentType } from "react";

import type { SetPieceAnchor, SetPieceProps } from "../../contract";

/** Stub, owned by the scene engineer. Anchors say where each piece sits; the registry holds the component. */
export const SET_PIECE_ANCHORS: readonly SetPieceAnchor[] = [];

export const setPieceRegistry: Readonly<
  Record<string, () => Promise<{ default: ComponentType<SetPieceProps> }>>
> = {};
