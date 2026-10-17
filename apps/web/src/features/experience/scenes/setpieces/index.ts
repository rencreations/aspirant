import type { ComponentType } from "react";

import type { SetPieceProps } from "../../contract";

export { SET_PIECE_ANCHORS } from "./anchors";

/** Lazy modules for each anchor id; the reader renders the piece after `anchor.after`. */
export const setPieceRegistry: Readonly<
  Record<string, () => Promise<{ default: ComponentType<SetPieceProps> }>>
> = {
  "little-lights": () => import("./LittleLights"),
  "two-stars": () => import("./TwoStars"),
  "sky-breaks-978": () => import("./SkyBreak"),
  "base-falls": () => import("./SkyBreak"),
  "gantry-square": () => import("./GantrySquare"),
  "orb-breaks": () => import("./OrbBreaks"),
  "two-suns": () => import("./TwoSuns"),
  "does-it-hurt": () => import("./DoesItHurt"),
  corridor: () => import("./Corridor"),
  "third-floor-lamp": () => import("./ThirdFloorLamp"),
  "twin-streams": () => import("./TwinStreams"),
  lighthouses: () => import("./Lighthouses"),
};
