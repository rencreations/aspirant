import { chunkItem, type PreloadItem } from "@/lib/preload";
import { discFacesItem } from "@/features/library/music/faces";

import { duoItems } from "../../actors/duo/preload";
import { coverItems } from "../../actors/records/covers";

export function preload(): PreloadItem[] {
  return [
    ...duoItems(),
    {
      ...chunkItem("home-music", "Preparing the music", () => import("./runtime")),
      deferred: true,
      priority: 42,
    },
    ...coverItems({ count: 10, priority: 42.4 }),
    { ...discFacesItem(), deferred: true, priority: 42.5 },
  ];
}
