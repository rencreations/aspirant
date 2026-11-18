import { ShaderLib } from "three";
import { describe, expect, it } from "vitest";

import { patchToonFragment, patchToonVertex } from "../shared/toon-glsl";

import { patchVinylFragment, patchVinylVertex } from "./vinyl";

const basic = ShaderLib.basic;

describe("the vinyl's patches (on top of the toon patch)", () => {
  const vertex = patchVinylVertex(patchToonVertex(basic.vertexShader));
  const fragment = patchVinylFragment(patchToonFragment(basic.fragmentShader));

  it("hand the disc's own position and normal to the fragment", () => {
    expect(vertex).toContain("vObjPos = position;");
    expect(vertex).toContain("vObjNormal = normal;");
    expect(fragment).toContain("varying vec3 vObjPos;");
  });

  it("draw the rings after the picture and the shine after the toon shade", () => {
    const rings = fragment.indexOf("float grGroove");
    const shade = fragment.indexOf("toonShade( diffuseColor.rgb");
    const shine = fragment.indexOf("float grFan");
    const opaque = fragment.indexOf("#include <opaque_fragment>");
    expect(rings).toBeGreaterThan(-1);
    expect(shade).toBeGreaterThan(rings);
    expect(shine).toBeGreaterThan(shade);
    expect(opaque).toBeGreaterThan(shine);
  });

  it("reads the toon light, not a light of the scene", () => {
    expect(fragment).toContain("uToonL");
    expect(fragment).not.toContain("uKeyDir");
    expect(fragment).not.toContain("roughnessFactor");
  });

  it("cuts the fans with hard smoothsteps, never a power curve", () => {
    expect(fragment).toContain("smoothstep( 0.988, 0.992, grS )");
    expect(fragment).not.toContain("pow(");
  });
});
