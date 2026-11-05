import type { CharacterSlug } from "@/lib/slugs";
import type { SceneName } from "@/features/character/stage/timeline";

import type { CollectionFile, ItemBase } from "../types";

/** What a clip is. The welcome and the idle loop are the stage's own, a pose is a page of the engine. */
type ClipKind = "welcome" | "idle" | "pose" | "short";

/** One clip of the room: a button, and one item of the collection. */
export interface AnimClip extends ItemBase {
  kind: ClipKind;
  /** The engine scene that plays it. Null for the welcome and the idle loop. */
  scene: SceneName | null;
  /** The word on the button, for example `Face`, `Blade`, `Scythe`. */
  label: string;
  /** One plain sentence about what it shows. */
  line: string;
  /** Length of the clip in seconds, null while the recording is not ready. */
  dur: number | null;
  /** Position inside the character's buttons. */
  order: number;
  /** The recording it was cut from, relative to the source library. */
  src: string;
}

/** One character of the picker. */
export interface AnimChar {
  slug: CharacterSlug;
  name: string;
  /** The "In the game" caption: what the clips of this character are. */
  caption: string;
  /** Her palette, copied from the site's character data. */
  palette: { primary: string; secondary: string; glow: string; ink: string };
  /** The face on the tab: its centre as percentages of the 800 by 450 art, and a zoom. */
  face: { x: number; y: number; zoom: number };
  /** The part of the picture that stays in view when the stage is cropped, in percent from the left. */
  focus: number;
}

/** `public/data/library/animation.json`. */
export interface AnimationFile extends CollectionFile<AnimClip> {
  characters: AnimChar[];
  /** The line under the stage that says how it works. */
  hint: string;
}
