import { logoItems } from "../fx/logo/preload";
import { duoItems } from "../actors/duo/preload";
import { droneItems } from "../actors/drone/preload";
import { chunkItem, type PreloadItem } from "@/lib/preload";

/**
 * What the opening needs before the visitor can press, in two tiers.
 *
 * Tier one is what it takes to DRAW the drone: its script, its model, its faces and its icons, and
 * the opening's own scene code. The drone is what a waiting visitor looks at, so on a slow link it
 * must appear long before the rest has arrived. Tier two is what the intro needs after the press
 * (the two Guinevere drones, the logo's drawing) and every section's first screen. All of it is
 * waited for, so the intro never stalls for a file after the press. The marks (bang, sweat,
 * hearts) are drawn by a shader and load nothing: their code is in the scene chunk.
 *
 * The ORDER is real: the items of tier two do not start until tier one has arrived (`afterTheDrone`),
 * so the drone's files do not share the connection with thirty pictures. Nothing is skipped, capped
 * or timed, and the bar is still the real bytes of the whole list.
 */

/** Tier one: the drone, and the scene that draws it. */
export function droneTier(): PreloadItem[] {
  return [
    ...droneItems({ deferred: false }),
    chunkItem(
      "home-boot",
      "Preparing the opening",
      async () => {
        await Promise.all([import("./runtime"), import("../fx/comic-marks")]);
      },
      1,
    ),
  ];
}

/** Tier two, the opening's part: the pair and the logo the intro carries in. */
export function introTier(): PreloadItem[] {
  return [...duoItems({ deferred: false }), ...logoItems()];
}

/** Both tiers, in order. */
export function bootItems(): PreloadItem[] {
  return [...droneTier(), ...introTier()];
}

// The gate between the two tiers. One per document: a second list that holds the same items finds
// the first one's items already running (or done) and must not wait for a gate of its own.
let gate: Promise<void> | null = null;
let release: () => void = () => undefined;
let need = new Set<string>();
const arrived = new Set<string>();

/** For the tests: forget the gate. */
export function resetOpeningGate(): void {
  gate = null;
  release = () => undefined;
  need = new Set();
  arrived.clear();
}

/**
 * Puts `first` ahead of `rest`: the items of `first` run as they always did and the waited items of
 * `rest` start when every item of `first` has finished (arrived, or skipped because the server says
 * it is gone). The progress, the labels and the bytes are the items' own. A deferred item is left
 * alone: it already waits for the whole waited list.
 */
export function afterTheDrone(
  first: readonly PreloadItem[],
  rest: readonly PreloadItem[],
): PreloadItem[] {
  if (!gate) {
    need = new Set(first.map((item) => item.id));
    gate = new Promise<void>((resolve) => {
      release = resolve;
    });
  }
  const open = gate;
  const track = (item: PreloadItem): PreloadItem => ({
    ...item,
    run: async (report, context) => {
      try {
        return await item.run(report, context);
      } finally {
        arrived.add(item.id);
        let all = true;
        for (const id of need) if (!arrived.has(id)) all = false;
        if (all) release();
      }
    },
  });
  const hold = (item: PreloadItem): PreloadItem =>
    item.deferred
      ? item
      : {
          ...item,
          run: async (report, context) => {
            await open;
            return item.run(report, context);
          },
        };
  return [...first.map(track), ...rest.map(hold)];
}
