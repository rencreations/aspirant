import { libUrl } from "@/lib/library";
import { chunkItem, imageItem, savedItem, type PreloadItem } from "@/lib/preload";

import { duoItems } from "../../actors/duo/preload";
import { VOICES, VOICE_PICKS } from "../../content";

/**
 * What the voices section needs. Nothing here is waited for: the section is far down the page, so
 * it arrives in the background, in the order the visitor reaches it. First the duo, the section's
 * code, the ten small pictures of the chooser, the first Aspirant's art and her eight clips. The
 * music section comes next on the page, so its files (priority 42) go before the other nine
 * Aspirants' art and clips: the visitor picks those when they choose them, and a clip that has not
 * arrived is fetched on the press (the button shows its loading state). Until a picture or a clip
 * has arrived the part that needs it shows its loading state, never a different page.
 *
 * The chooser's small pictures (800 px) and the big art (2048 px) are plain repo files. The voice
 * clips are the library's own (`libUrl(key)`), saved in the browser through `cachedFetch`, the same
 * saved copy `audio.playVoice` reads. The keys are read from the section's data when an Aspirant's
 * item runs, so the data does not weigh on every page's bundle.
 */
const PRIORITY = 41;
/** The art and the clips of the Aspirants after the first: behind the music section's files. */
const LATER = 43;

function deferred(item: PreloadItem, priority: number): PreloadItem {
  return { ...item, deferred: true, priority };
}

/** The clips of one Aspirant: eight files, about half a megabyte. */
function clipsItem(slug: string, priority: number): PreloadItem {
  return {
    id: `home-voices:clips:${slug}`,
    label: "Loading the voice lines",
    weight: 1,
    deferred: true,
    priority,
    run: async (report, context) => {
      const { VOICE_CHARACTERS } = await import("./data");
      const character = VOICE_CHARACTERS.find((c) => c.slug === slug);
      if (!character) return;
      const keys = Object.values(character.lines).map((line) => line.key);
      let done = 0;
      await Promise.all(
        keys.map(async (key) => {
          await savedItem(libUrl(key), "Loading the voice lines").run(() => undefined, context);
          done += 1;
          report(done / keys.length);
        }),
      );
    },
  };
}

export function preload(): PreloadItem[] {
  const items: PreloadItem[] = [
    ...duoItems(),
    deferred(
      chunkItem("home-voices", "Preparing the voices", () => import("./runtime")),
      PRIORITY,
    ),
  ];
  VOICE_PICKS.forEach((pick, i) => {
    const slug = pick.slug;
    // The chooser's small pictures are all wanted at once; the rest waits for its turn.
    const first = slug === VOICES.defaultCharacter;
    const art = first ? PRIORITY + 0.2 : LATER + i * 0.1;
    const clips = first ? PRIORITY + 0.3 : LATER + 0.05 + i * 0.1;
    items.push(
      deferred(
        imageItem(`/img/char/${slug}/splash-sm.webp`, "Loading the characters"),
        PRIORITY + 0.1,
      ),
      deferred(imageItem(`/img/char/${slug}/splash.webp`, "Loading her splash art", 2), art),
      clipsItem(slug, clips),
    );
  });
  return items;
}
