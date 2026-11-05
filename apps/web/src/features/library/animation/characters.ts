import { CHARACTER_NAMES, CHARACTER_SLUGS, type CharacterSlug } from "@/lib/slugs";

import { readStageData, libraryBundle, timeSkip, type StageBundle } from "./bundle";
import { STAGE_LOADERS } from "./stage-loaders.generated";

/**
 * The registry of the ten. Four characters already have their stage on the site (Selena, Obsidia,
 * Vexana, Guinevere): their timelines and media objects are imported, not copied, so those stages
 * play from the site's own files. The other six come from the stage builder: their
 * `stage-data/<slug>.generated.ts` is listed in `stage-loaders.generated.ts` (written by
 * `scripts/library/animation/index.py`) as soon as it exists, and their videos are in the library
 * folder `animation/<slug>`. A character with neither is "preparing".
 */
type Loader = () => Promise<StageBundle | null>;

const SITE: Partial<Record<CharacterSlug, Loader>> = {
  selena: async () => {
    const [{ selenaMedia }, data] = await Promise.all([
      import("@/features/character/selena/media"),
      import("@/features/character/selena/timeline.generated"),
    ]);
    return {
      slug: "selena",
      timeline: data.SELENA_TIMELINE,
      media: selenaMedia,
      bytes: data.SELENA_BYTES,
      skip: timeSkip(selenaMedia),
    };
  },
  obsidia: async () => {
    const [{ obsidiaMedia }, data] = await Promise.all([
      import("@/features/character/obsidia/media"),
      import("@/features/character/obsidia/timeline.generated"),
    ]);
    return {
      slug: "obsidia",
      timeline: data.OBSIDIA_TIMELINE,
      media: obsidiaMedia,
      bytes: data.OBSIDIA_BYTES,
      skip: timeSkip(obsidiaMedia),
    };
  },
  vexana: async () => {
    const [{ roomMedia }, data] = await Promise.all([
      import("@/features/character/vexana/room/media"),
      import("@/features/character/vexana/room/timeline.generated"),
    ]);
    return {
      slug: "vexana",
      timeline: data.VEXANA_STAGE_TIMELINE,
      media: roomMedia,
      bytes: data.VEXANA_STAGE_BYTES,
      skip: undefined,
    };
  },
  guinevere: async () => {
    const [{ roomMedia }, data] = await Promise.all([
      import("@/features/character/guinevere/room/media"),
      import("@/features/character/guinevere/room/timeline.generated"),
    ]);
    return {
      slug: "guinevere",
      timeline: data.GUINEVERE_STAGE_TIMELINE,
      media: roomMedia,
      bytes: data.GUINEVERE_STAGE_BYTES,
      skip: undefined,
    };
  },
};

/** The ten, in the order of the picker. */
export const ROOM_ORDER: readonly CharacterSlug[] = CHARACTER_SLUGS;

/** True when the character's stage can be built now. */
export function hasStage(slug: CharacterSlug): boolean {
  return slug in SITE || slug in STAGE_LOADERS;
}

/** The first character of the picker that can play, which the room opens on. */
export function firstReady(): CharacterSlug {
  return ROOM_ORDER.find(hasStage) ?? ROOM_ORDER[0]!;
}

const cache = new Map<CharacterSlug, Promise<StageBundle | null>>();

/** A character's stage data and media. Null while the character is preparing. Built once. */
export function loadBundle(slug: CharacterSlug): Promise<StageBundle | null> {
  let p = cache.get(slug);
  if (!p) {
    p = (async () => {
      const site = SITE[slug];
      if (site) return site();
      const lazy = STAGE_LOADERS[slug];
      if (!lazy) return null;
      const data = readStageData(await lazy());
      return data ? libraryBundle(slug, CHARACTER_NAMES[slug], data) : null;
    })().catch((error: unknown) => {
      cache.delete(slug);
      console.warn(`[animation] stage data of ${slug} could not be read`, error);
      return null;
    });
    cache.set(slug, p);
  }
  return p;
}
