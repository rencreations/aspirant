import {
  BufferGeometry,
  DataTexture,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  ShaderMaterial,
} from "three";
import { describe, expect, it } from "vitest";

import { distinctMeshes, programKey, texturesOf } from "./warm";

const geometry = new BufferGeometry();

describe("texturesOf", () => {
  it("finds every picture of a material and of a shader's uniforms, once", () => {
    const map = new DataTexture(new Uint8Array(4), 1, 1);
    const other = new DataTexture(new Uint8Array(4), 1, 1);
    const root = new Group();
    const a = new Mesh(geometry, new MeshStandardMaterial({ map, normalMap: other }));
    const b = new Mesh(geometry, new MeshBasicMaterial({ map }));
    const c = new Mesh(
      geometry,
      new ShaderMaterial({ uniforms: { uFace: { value: other }, uTime: { value: 1 } } }),
    );
    root.add(a, b, c);
    const found = texturesOf(root);
    expect(found).toHaveLength(2);
    expect(found).toContain(map);
    expect(found).toContain(other);
  });

  it("finds nothing on an actor with no pictures", () => {
    const root = new Group();
    root.add(new Mesh(geometry, new MeshBasicMaterial()));
    expect(texturesOf(root)).toEqual([]);
  });
});

describe("distinctMeshes", () => {
  it("keeps one mesh for each program", () => {
    const shared = new MeshStandardMaterial();
    const root = new Group();
    const one = new Mesh(geometry, shared);
    const two = new Mesh(geometry, shared);
    const three = new Mesh(geometry, new MeshStandardMaterial());
    root.add(one, two, three);
    expect(distinctMeshes(root)).toEqual([one, three]);
  });

  it("tells a mesh with morph targets from one without, on the same material", () => {
    const shared = new MeshStandardMaterial();
    const plain = new Mesh(geometry, shared);
    const morphed = new Mesh(geometry, shared);
    morphed.morphTargetInfluences = [0, 0];
    expect(programKey(plain)).not.toBe(programKey(morphed));
    const root = new Group();
    root.add(plain, morphed);
    expect(distinctMeshes(root)).toHaveLength(2);
  });

  it("ignores what is not a mesh", () => {
    const root = new Group();
    root.add(new Group());
    expect(distinctMeshes(root)).toEqual([]);
  });
});
