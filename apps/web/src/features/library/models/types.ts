import type { CollectionFile, ItemBase, LibImage } from "../types";

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
  /** Folder of the model in the library, a key. The files stay under `others/3d/` in the bucket. */
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
  /** Size in bytes of every file the viewer fetches: the model, each texture, each face sheet (names relative to `dir`). */
  sizes: Record<string, number>;
  /** Number of files of the model in the library, and their total size. */
  files: number;
  totalBytes: number;
  /** Materials that are see-through in the .mtl, with their opacity. */
  opacity?: Record<string, number>;
}

/** One game client model. The data file is `public/data/library/models.json`. */
export interface ModelItem extends ItemBase {
  kind: "model";
  /** One plain sentence about the model. */
  note?: string;
  /** The skin's name from the file name, when the file has one. */
  skin?: string;
  model: ModelInfo;
  /** A picture of the model, used on the picker and when WebGL is missing. */
  img: LibImage;
}

export type ModelsFile = CollectionFile<ModelItem>;
