import type { CollectionFile, ItemBase, LibImage, LibVideo } from "../types";

/** The five sections of the room, in page order. */
export type OthersGroupId = "emotes" | "gameplay" | "skills" | "site" | "more";

export interface OthersGroup {
  id: OthersGroupId;
  /** The big title of the section. (Not `title`: the library index counts every object that has one as an item.) */
  heading: string;
  line: string;
  kind: "stickers" | "clips" | "icons" | "images" | "links";
}

interface OthersBase extends ItemBase {
  group: OthersGroupId;
  /** One plain sentence about the item. */
  note?: string;
}

export interface EmoteItem extends OthersBase {
  kind: "emote";
  /** The preview film of the whole set (it has sound, so it opens in the player). */
  preview: boolean;
  video: LibVideo & { sound: boolean; bytes: number };
}

export interface GameplayItem extends OthersBase {
  kind: "gameplay";
  caption: string;
  date: string;
  video: LibVideo & { bytes: number };
}

export interface SkillItem extends OthersBase {
  kind: "skill";
  /** The name from the file: Passive, Skill 2, Skill 3, cancel. */
  label: string;
  img: LibImage;
}

export interface SiteItem extends OthersBase {
  kind: "site";
  set: string;
  setLabel: string;
  img: LibImage;
}

export interface LinkItem extends OthersBase {
  kind: "link";
  line: string;
  /** `story`, `character:<slug>`. */
  to: string;
  /** A picture the site already ships (a path in `public/`). */
  local: string;
}

export type OthersItem = EmoteItem | GameplayItem | SkillItem | SiteItem | LinkItem;

export interface OthersFile extends CollectionFile<OthersItem> {
  groups: OthersGroup[];
}
