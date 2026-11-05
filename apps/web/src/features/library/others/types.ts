import type { CollectionFile, ItemBase, LibImage, LibVideo } from "../types";

/** The six sections of the room, in page order. */
export type OthersGroupId = "models" | "emotes" | "gameplay" | "skills" | "site" | "more";

export interface OthersGroup {
  id: OthersGroupId;
  title: string;
  line: string;
  kind: "models" | "stickers" | "clips" | "icons" | "images" | "links";
}

interface OthersBase extends ItemBase {
  group: OthersGroupId;
  /** One plain sentence about the item. */
  note?: string;
}

/** What a model part is: the body (with face and hair), the weapon, the robot, or the robot's face screen. */
export type ModelPart = "body" | "weapon" | "robot" | "robotFace";

export interface ModelInfo {
  /** Folder of the model in the library, a key. */
  dir: string;
  obj: string;
  mtl: string;
  verts: number;
  tris: number;
  /** Size of the .obj file. */
  bytes: number;
  /** Size of the texture PNGs the .mtl names. */
  texBytes: number;
  /** Material name to texture file name (from the .mtl, relative to `dir`). */
  maps: Record<string, string>;
  /** Material name to the part it belongs to. */
  parts: Record<string, ModelPart>;
  /** The eight other expression sheets of the robot's face, relative to `dir`. */
  faces: string[];
}

export interface ModelItem extends OthersBase {
  kind: "model";
  model: ModelInfo;
  /** A picture of the model, used when WebGL is missing and on the picker. */
  img?: LibImage;
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

export type OthersItem = ModelItem | EmoteItem | GameplayItem | SkillItem | SiteItem | LinkItem;

export interface OthersFile extends CollectionFile<OthersItem> {
  groups: OthersGroup[];
}
