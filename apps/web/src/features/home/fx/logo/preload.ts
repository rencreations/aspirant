import { chunkItem, type PreloadItem } from "@/lib/preload";

/**
 * What the logo needs before the first screen. It has no file: both pictures of it are drawn from
 * the vector in `components/logo/` (already in the bundle, the bar uses it), so the item is the
 * actor's code and the drawing of the big texture, which takes a few tens of milliseconds and is
 * done while the page loads, not at the first frame. The hero's runtime calls `logoItems()` in its
 * `preload()`. Waited: the first screen shows the logo.
 */
export function logoItems(): PreloadItem[] {
  return [
    chunkItem(
      "home-logo",
      "Drawing the logo",
      async () => {
        const [raster, math, stage] = await Promise.all([
          import("./raster"),
          import("./math"),
          import("../../kernel/stage"),
        ]);
        // The texture of this screen, made ahead: the actor finds it when it is built.
        const w = window.innerWidth;
        const h = window.innerHeight;
        raster.heroCanvasFor(
          math.heroArtWidth(w, h),
          stage.pixelRatioFor(w, h, window.devicePixelRatio || 1),
        );
        return import("./actor");
      },
      1,
    ),
  ];
}
