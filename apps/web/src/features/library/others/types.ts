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

/**
 * What a model part is: the body (with face and hair), the weapon, the robot, the robot's face
 * screen, or a piece that is never drawn (an effect plane that came without its texture).
 */
export type ModelPart = "body" | "weapon" | "robot" | "robotFace" | "hidden";

/** The switches of the stage. A model has only the ones that are really in its file. */
export type ModelLayer = "body" | "weapon" | "robot";

export interface ModelInfo {
  /** Wavefront .obj with a .mtl, or a binary FBX. */
  format: "obj" | "fbx";
  /** Folder of the model in the library, a key. */
  dir: string;
  /** The model file (the .obj or the .fbx). */
  obj: string;
  /** The .mtl, empty for an FBX. */
  mtl: string;
  verts: number;
  tris: number;
  /** Size of the model file. */
  bytes: number;
  /** Size of the texture PNGs the viewer loads. */
  texBytes: number;
  /** Material name to the texture file it wears (relative to `dir`). */
  maps: Record<string, string>;
  /** Which part a piece belongs to: [regex, part], tried on "<object name> <material name>" in lower case. */
  rules: Array<[string, ModelPart]>;
  /** The layer switches that mean something for this model. */
  layers: ModelLayer[];
  /** The other expression sheets of the robot's face (Fanny and Layla only), relative to `dir`. */
  faces: string[];
  /** Number of files of the model in the library, and their total size. */
  files: number;
  totalBytes: number;
  /** Materials that are see-through in the .mtl, with their opacity. */
  opacity?: Record<string, number>;
}

export interface ModelItem extends OthersBase {
  kind: "model";
  /** The skin's name from the file name, when the file has one. */
  skin?: string;
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
