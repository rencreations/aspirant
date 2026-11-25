import { readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  BUNNY_BODY_TARGETS,
  BUNNY_BONES,
  BUNNY_MODEL,
  BUNNY_MODEL_BYTES,
  BUNNY_TARGETS,
} from "./model";

const FILE = path.resolve(import.meta.dirname, "../../../../public", BUNNY_MODEL.slice(1));

interface GlbJson {
  nodes: Array<{ name?: string }>;
  skins: Array<{ joints: number[] }>;
  meshes: Array<{ extras?: { targetNames?: string[] } }>;
}

/** The JSON part of the GLB. */
function glbJson(): GlbJson {
  const bytes = readFileSync(FILE);
  const length = bytes.readUInt32LE(12);
  return JSON.parse(bytes.subarray(20, 20 + length).toString("utf8")) as GlbJson;
}

describe("the bunny's model record", () => {
  it("counts the file's real bytes", () => {
    expect(statSync(FILE).size).toBe(BUNNY_MODEL_BYTES);
  });

  it("names the bones the file's skin has, in its order", () => {
    const json = glbJson();
    expect(json.skins).toHaveLength(1);
    expect(json.skins[0]?.joints.map((i) => json.nodes[i]?.name)).toEqual([...BUNNY_BONES]);
  });

  it("names the targets the file has, in its order", () => {
    expect(glbJson().meshes[0]?.extras?.targetNames).toEqual([...BUNNY_TARGETS]);
  });

  it("lists body targets that are targets", () => {
    for (const name of BUNNY_BODY_TARGETS) expect(BUNNY_TARGETS).toContain(name);
  });
});
