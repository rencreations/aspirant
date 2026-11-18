import { droneItems } from "../../actors/drone/preload";
import { fieldItems } from "../../fx/image-field/preload";
import { logoItems } from "../../fx/logo/preload";
import { chunkItem, type PreloadItem } from "@/lib/preload";

/**
 * What the hero needs, as loading items (see `kernel/preload.ts`). All of it is waited for: the
 * first screen shows the logo, the ten portrait cards and the drone, and the first thing a visitor
 * does is scroll, so the eighteen wide pictures the cards land on (2.5 MB) are in before the page
 * opens, as the design says (section 6). The files of the logo, the field and the drone come from
 * their own lists, which import no three.js.
 */
export function preload(): PreloadItem[] {
  return [
    chunkItem("home-hero", "Hanging the art", () => import("./runtime"), 1),
    ...logoItems(),
    ...fieldItems("hero", { wide: "waited" }),
    ...droneItems({ deferred: false }),
  ];
}
