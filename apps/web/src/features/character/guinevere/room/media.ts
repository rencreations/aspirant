import { loadMedia } from "@/lib/media-store";
import type { PreloadItem } from "@/lib/preload";

import { createStageMedia } from "../../stage/media";
import { GUINEVERE_STAGE_BYTES, GUINEVERE_STAGE_TIERS } from "./timeline.generated";

/**
 * The room's videos (`scripts/guinevere/stage.py`): one folder per size under
 * `/video/guinevere-stage`. The id is the folder's name, which the stage uses to drop what is
 * still queued when it is left. There are three sizes: a 4K screen gets the 2560 picture.
 */
const ROOM_ID = "guinevere-stage";

/** Choosing, loading and addressing the videos (see `stage/media.ts`). */
export const roomMedia = createStageMedia({
  id: ROOM_ID,
  name: "Guinevere",
  dir: `/video/${ROOM_ID}`,
  tiers: GUINEVERE_STAGE_TIERS,
  bytes: GUINEVERE_STAGE_BYTES,
  tierNames: { lite: "light", "1080": "HD", "1440": "QHD" },
  // The size of the source recordings, for the cover maths.
  source: { width: 3840, height: 1728 },
  // The first load is the welcome and the idle loop. The shorts and the zoom pose follow.
  deferRest: true,
});

/** The files the room needs at its first frame. */
const CORE = ["welcome.mp4", "idle.mp4"] as const;

/** Where the background queue puts the room: after the page's own media, the welcome first. */
const PRIORITY_FIRST = 44;
const PRIORITY_SHORTS = 45;
const PRIORITY_POSE = 46;

const priorityOf = (file: string) =>
  (CORE as readonly string[]).includes(file)
    ? PRIORITY_FIRST
    : file.startsWith("short-")
      ? PRIORITY_SHORTS
      : PRIORITY_POSE;

/**
 * Every video of the room in the size that suits the display, for the background queue of the page
 * (the page's first screen does not wait for them, `loadRoomMedia` is what the way into the room
 * waits for). All of them are downloaded in the background, behind anything the visitor asked for.
 */
export function roomItems(): PreloadItem[] {
  return roomMedia.items().map((item) => {
    const file = item.id.split(":").at(-1) ?? "";
    return {
      ...item,
      deferred: true,
      priority: priorityOf(file),
      run: async (report) => {
        const use = await roomMedia.tierReady();
        return loadMedia(roomMedia.path(use, file), {
          type: "video/mp4",
          expectedBytes: GUINEVERE_STAGE_BYTES[use][file],
          onFraction: report,
          background: true,
        });
      },
    };
  });
}

export const roomCoreFiles = CORE;
