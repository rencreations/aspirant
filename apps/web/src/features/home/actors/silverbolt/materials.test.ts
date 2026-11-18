import {
  Bone,
  BufferAttribute,
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  MeshBasicMaterial,
  MeshStandardMaterial,
  ShaderLib,
  Skeleton,
  SkinnedMesh,
} from "three";
import { describe, expect, it } from "vitest";

import { ToonMaterial } from "../shared/toon";
import { MAP_CHUNK, dress, posterizeChannel, posterizeGlsl } from "./materials";

describe("posterizeChannel", () => {
  it("keeps the ends of the range", () => {
    expect(posterizeChannel(0, 6)).toBe(0);
    expect(posterizeChannel(1, 6)).toBe(1);
  });

  it("gives at most `levels` plus one different values over the whole range", () => {
    const seen = new Set<number>();
    for (let i = 0; i <= 1000; i++) seen.add(posterizeChannel(i / 1000, 6));
    expect(seen.size).toBeLessThanOrEqual(7);
    expect(seen.size).toBeGreaterThan(3);
  });

  it("is flat inside a step and never goes down as the value goes up", () => {
    let last = -1;
    for (let i = 0; i <= 200; i++) {
      const v = posterizeChannel(i / 200, 5);
      expect(v).toBeGreaterThanOrEqual(last);
      last = v;
    }
  });

  it("does not change a value that is already a step", () => {
    const once = posterizeChannel(0.37, 6);
    expect(posterizeChannel(once, 6)).toBeCloseTo(once, 12);
  });

  it("treats a negative value as black", () => {
    expect(posterizeChannel(-0.2, 6)).toBe(0);
  });
});

describe("posterizeGlsl", () => {
  it("starts from the anchor of three's own shader, which must still be there", () => {
    expect(ShaderLib.basic.fragmentShader).toContain(MAP_CHUNK);
    expect(posterizeGlsl(6, "colour").startsWith(MAP_CHUNK)).toBe(true);
    expect(posterizeGlsl(6, "tone").startsWith(MAP_CHUNK)).toBe(true);
  });

  it("cuts each channel for the colour mode and only the lightness for the tone mode", () => {
    expect(posterizeGlsl(6, "colour")).toContain("diffuseColor.rgb = stepped * stepped;");
    const tone = posterizeGlsl(6, "tone");
    expect(tone).toContain("float tone = dot( diffuseColor.rgb");
    expect(tone).not.toContain("stepped");
  });

  it("writes the number of steps as a float", () => {
    expect(posterizeGlsl(6, "colour")).toContain("6.0");
    expect(posterizeGlsl(9, "tone")).toContain("9.0");
  });
});

/** A skinned mesh with one bone, the five names the build wrote and the attributes the ink needs. */
function model(names: readonly string[]): Group {
  const root = new Group();
  const bone = new Bone();
  root.add(bone);
  for (const name of names) {
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3));
    geometry.setAttribute("normal", new Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
    geometry.setAttribute("uv", new Float32BufferAttribute([0, 0, 1, 0, 0, 1], 2));
    geometry.setAttribute("skinIndex", new BufferAttribute(new Uint16Array(12), 4));
    geometry.setAttribute(
      "skinWeight",
      new Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], 4),
    );
    const material = new MeshStandardMaterial();
    material.name = name;
    if (name === "silverbolt_ribbon") material.transparent = true;
    const mesh = new SkinnedMesh(geometry, material);
    mesh.name = name;
    root.add(mesh);
    mesh.bind(new Skeleton([bone]));
  }
  return root;
}

const NAMES = [
  "silverbolt_body",
  "silverbolt_gem",
  "silverbolt_socket",
  "silverbolt_crystal",
  "silverbolt_ribbon",
] as const;

describe("dress", () => {
  it("gives every part its toon look and the eyes an unlit picture", () => {
    const { materials } = dress(model(NAMES));
    expect(materials.body).toBeInstanceOf(ToonMaterial);
    expect(materials.socket).toBeInstanceOf(ToonMaterial);
    expect(materials.crystal).toBeInstanceOf(ToonMaterial);
    expect(materials.ribbon).toBeInstanceOf(ToonMaterial);
    expect(materials.gem).toBeInstanceOf(MeshBasicMaterial);
    expect(materials.gem).not.toBeInstanceOf(ToonMaterial);
  });

  it("outlines the armour only: one hull, no line on the eyes, lids, crystals or ribbon", () => {
    const { materials } = dress(model(NAMES));
    expect(materials.set.inks).toHaveLength(1);
    expect(materials.set.inks[0]!.mesh.name).toBe("silverbolt_body_ink");
  });

  it("sorts the ribbon after everything opaque and never writes its depth", () => {
    const scene = model(NAMES);
    const { materials } = dress(scene);
    expect(materials.ribbon.transparent).toBe(true);
    expect(materials.ribbon.depthWrite).toBe(false);
    const ribbon = scene.children.find((o) => o.name === "silverbolt_ribbon");
    expect(ribbon?.renderOrder).toBe(1);
  });

  it("does not cull a skinned mesh by its resting box", () => {
    const scene = model(NAMES);
    dress(scene);
    const meshes = scene.children.filter((o) => (o as SkinnedMesh).isSkinnedMesh);
    expect(meshes.every((o) => !o.frustumCulled)).toBe(true);
  });

  it("cuts the ribbon and the armour into steps and leaves the other parts alone", () => {
    const { materials } = dress(model(NAMES));
    const compile = (m: ToonMaterial): string => {
      const shader = {
        uniforms: {},
        vertexShader: ShaderLib.basic.vertexShader,
        fragmentShader: ShaderLib.basic.fragmentShader,
      };
      m.onBeforeCompile(shader as never, undefined as never);
      return shader.fragmentShader;
    };
    expect(compile(materials.ribbon)).toContain("diffuseColor.rgb = stepped * stepped;");
    expect(compile(materials.body)).toContain("float tone = dot( diffuseColor.rgb");
    expect(compile(materials.crystal)).not.toContain("stepped");
    expect(compile(materials.crystal)).not.toContain("float tone");
    // The toon shade is still there under the cut.
    expect(compile(materials.ribbon)).toContain("toonShade(");
    // Different programs get different keys.
    const keys = new Set(
      [materials.body, materials.ribbon, materials.crystal].map((m) => m.customProgramCacheKey()),
    );
    expect(keys.size).toBe(3);
  });

  it("says so when the build changed a material", () => {
    expect(() => dress(model(NAMES.slice(0, 4)))).toThrow(/materials are not the ones/);
  });

  it("sets the ink for a height without throwing, before and after a size", () => {
    const { materials } = dress(model(NAMES));
    materials.set.setHeight(120);
    const small = materials.set.ink.width;
    materials.set.setHeight(900);
    expect(materials.set.ink.width).toBeGreaterThan(small);
  });
});
