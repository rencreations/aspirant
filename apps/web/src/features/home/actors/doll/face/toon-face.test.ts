import { ShaderLib } from "three";
import { afterEach, describe, expect, it, vi } from "vitest";

import { patchToonFragment, patchToonVertex } from "../../shared/toon-glsl";

import { PAINT_PATCHES, patchFaceFragment, patchFaceVertex, toonFaceHead } from "./toon-face";
import { FACE_FRAGMENT_HEAD } from "./shader";

function count(text: string, part: string): number {
  return text.split(part).length - 1;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the paint patches", () => {
  it("each line they follow is in the generated face shader exactly once", () => {
    for (const [line] of PAINT_PATCHES) {
      expect(count(FACE_FRAGMENT_HEAD, line), line).toBe(1);
    }
  });

  it("every drawn feature of the face is covered (eyes, glyphs, brows, tears, mouth, sweat)", () => {
    const text = PAINT_PATCHES.map(([line]) => line).join("\n");
    for (const part of [
      "eL.rgb",
      "eR.rgb",
      "gcL",
      "gcR",
      "uInk, max(bL",
      "tc,",
      "mouth.rgb",
      "TEAR",
    ]) {
      expect(text).toContain(part);
    }
  });

  it("toonFaceHead adds one paint line for each and resets the coverage in gFace", () => {
    const head = toonFaceHead();
    expect(count(head, "gPaint = max(")).toBe(PAINT_PATCHES.length);
    expect(count(head, "float gPaint = 0.0;")).toBe(1);
    expect(head).toContain("vec3 gFace(vec3 base, vec2 bind) {\n  gPaint = 0.0;");
  });
});

describe("the patched shaders", () => {
  it("find every anchor in three's basic material (a moved anchor warns)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const vertex = patchFaceVertex(patchToonVertex(ShaderLib.basic.vertexShader));
    const fragment = patchFaceFragment(patchToonFragment(ShaderLib.basic.fragmentShader));
    expect(warn).not.toHaveBeenCalled();
    expect(vertex).toContain("attribute float _face;");
    expect(vertex).toContain("vBind = position;");
    expect(vertex).toContain("vFace = _face;");
    expect(fragment).toContain("gFace(diffuseColor.rgb, vBind.xy)");
  });

  it("draws the face before the toon shade and lays the features back after it", () => {
    const fragment = patchFaceFragment(patchToonFragment(ShaderLib.basic.fragmentShader));
    const drawn = fragment.indexOf("gFace(diffuseColor.rgb");
    const shade = fragment.indexOf("toonShade( diffuseColor.rgb");
    const back = fragment.indexOf("outgoingLight = mix( outgoingLight, diffuseColor.rgb");
    const out = fragment.indexOf("#include <opaque_fragment>");
    expect(drawn).toBeGreaterThan(0);
    expect(shade).toBeGreaterThan(drawn);
    expect(back).toBeGreaterThan(shade);
    expect(out).toBeGreaterThan(back);
  });

  it("warns on a shader that has none of the anchors, and leaves it as it is", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(patchFaceVertex("void main() {}")).toBe("void main() {}");
    expect(warn).toHaveBeenCalledTimes(2);
  });
});
