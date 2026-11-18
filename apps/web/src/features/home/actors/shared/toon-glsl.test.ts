import { ShaderLib } from "three";
import { describe, expect, it, vi } from "vitest";

import {
  BEGIN_NORMAL_CHUNK,
  MAIN_OPEN,
  NORMAL_GUARD,
  OUTGOING,
  PROJECT_CHUNK,
  patchCardInkFragment,
  patchCardInkVertex,
  patchInkVertex,
  patchToonFragment,
  patchToonVertex,
} from "./toon-glsl";

const basic = ShaderLib.basic;

describe("the anchors in three's basic shader", () => {
  it("the vertex shader has the normal guard, the project chunk and the begin normal chunk", () => {
    expect(basic.vertexShader).toContain(NORMAL_GUARD);
    expect(basic.vertexShader).toContain(PROJECT_CHUNK);
    expect(basic.vertexShader).toContain(BEGIN_NORMAL_CHUNK);
  });

  it("the fragment shader has main and the outgoing light line", () => {
    expect(basic.fragmentShader).toContain(MAIN_OPEN);
    expect(basic.fragmentShader).toContain(OUTGOING);
  });
});

describe("patchToonVertex", () => {
  const out = patchToonVertex(basic.vertexShader);
  it("always runs the normal chunks and hands the normal and view vector on", () => {
    expect(out).not.toContain(NORMAL_GUARD);
    expect(out).toContain("#if 1");
    expect(out).toContain("vToonN = transformedNormal;");
    expect(out).toContain("vToonV = - mvPosition.xyz;");
    expect(out.startsWith("varying vec3 vToonN;")).toBe(true);
  });

  it("warns and changes nothing for a source without the anchors", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const same = patchToonVertex("void main() {}");
    expect(same).toContain("void main() {}");
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe("patchToonFragment", () => {
  const out = patchToonFragment(basic.fragmentShader);
  it("replaces the stock light with the cel shade and adds the glow", () => {
    expect(out).not.toContain(OUTGOING);
    expect(out).toContain("toonShade( diffuseColor.rgb");
    expect(out).toContain("outgoingLight += toonGlow;");
    expect(out).toContain("#if TOON_BANDS == 3");
  });

  it("declares what it reads before main", () => {
    expect(out.indexOf("uniform vec3 uToonL;")).toBeLessThan(out.indexOf(MAIN_OPEN));
    expect(out.indexOf("varying vec3 vToonN;")).toBeLessThan(out.indexOf(MAIN_OPEN));
  });
});

describe("patchInkVertex", () => {
  const out = patchInkVertex(basic.vertexShader);
  it("skins and morphs the smooth normal and moves the vertex in clip space", () => {
    expect(out).toContain("attribute vec3 aSmooth;");
    expect(out).toContain("vec3 objectNormal = aSmooth;");
    expect(out).not.toContain(BEGIN_NORMAL_CHUNK);
    expect(out).toContain("inkClip.xy +=");
    expect(out).toContain("inkClip.w");
    expect(out).toContain("gl_Position = inkClip;");
  });

  it("pushes along the outward normal: a back side material has its normal turned, so it is turned back", () => {
    expect(out).toContain("#ifdef FLIP_SIDED");
    expect(out).toContain("inkNormal = - inkNormal;");
    expect(out).toContain("projectionMatrix * vec4( inkNormal, 0.0 )");
  });

  it("pushes the hull back in view space before it projects", () => {
    expect(out).toContain("inkView.z -= uInkPush;");
  });
});

describe("the card ink", () => {
  it("shifts the whole card on the screen by the line width and pushes it back", () => {
    const out = patchCardInkVertex(basic.vertexShader);
    expect(out).toContain("uniform vec2 uInkShift;");
    expect(out).toContain("inkClip.xy += uInkShift");
    expect(out).toContain("inkView.z -= uInkPush;");
    expect(out).not.toContain("aSmooth");
  });

  it("paints the ink colour and leaves the alpha test to the picture", () => {
    const out = patchCardInkFragment(basic.fragmentShader);
    expect(out).toContain("vec3 outgoingLight = uInkColor;");
    expect(out).toContain("#include <alphatest_fragment>");
    expect(out.startsWith("uniform vec3 uInkColor;")).toBe(true);
  });
});
