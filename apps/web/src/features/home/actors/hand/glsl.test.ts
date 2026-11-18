import { ShaderLib } from "three";
import { describe, expect, it, vi } from "vitest";

import { patchInkVertex, patchToonFragment, patchToonVertex } from "../shared/toon-glsl";

import {
  INK_POSITION,
  MAP_CHUNK,
  OPAQUE_CHUNK,
  PROJECT_CHUNK,
  patchFadeVertex,
  patchGloveFragment,
  patchInkFadeFragment,
  patchInkFadeVertex,
} from "./glsl";

const basic = ShaderLib.basic;

describe("the anchors the hand's patches need", () => {
  it("are in three's basic shader", () => {
    expect(basic.vertexShader).toContain(PROJECT_CHUNK);
    expect(basic.fragmentShader).toContain(MAP_CHUNK);
    expect(basic.fragmentShader).toContain(OPAQUE_CHUNK);
  });

  it("are still there after the toon patch has run", () => {
    expect(patchToonVertex(basic.vertexShader)).toContain(PROJECT_CHUNK);
    const frag = patchToonFragment(basic.fragmentShader);
    expect(frag).toContain(MAP_CHUNK);
    expect(frag).toContain(OPAQUE_CHUNK);
    expect(frag).toContain("vec3 toonN");
  });

  it("the toon ink vertex patch writes the clip position the fade reads", () => {
    expect(patchInkVertex(basic.vertexShader)).toContain(INK_POSITION);
  });
});

describe("the glove's patches", () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

  it("hand the screen height and the claw weight to the fragment", () => {
    const out = patchFadeVertex(patchToonVertex(basic.vertexShader));
    expect(out).toContain("varying float vFadeY;");
    expect(out).toContain("varying float vClaw;");
    expect(out).toContain("attribute float aClaw;");
    expect(out).toContain("vFadeY = gl_Position.y / gl_Position.w;");
    expect(out).toContain("vClaw = aClaw;");
  });

  it("lift the leather after the picture and finish before the opaque chunk", () => {
    const out = patchGloveFragment(patchToonFragment(basic.fragmentShader));
    const lift = out.indexOf("diffuseColor.rgb += uLift");
    const map = out.indexOf(MAP_CHUNK);
    const shade = out.indexOf("toonShade( diffuseColor.rgb");
    const fade = out.indexOf("diffuseColor.a *= smoothstep( uFade.x");
    const opaque = out.indexOf(OPAQUE_CHUNK);
    expect(map).toBeGreaterThan(-1);
    expect(lift).toBeGreaterThan(map);
    expect(shade).toBeGreaterThan(lift);
    expect(fade).toBeGreaterThan(shade);
    expect(opaque).toBeGreaterThan(fade);
    expect(out).toContain("uniform vec3 uClawColor;");
  });

  it("fade the ink from its own clip position", () => {
    const vertex = patchInkFadeVertex(patchInkVertex(basic.vertexShader));
    expect(vertex).toContain("vFadeY = inkClip.y / inkClip.w;");
    const fragment = patchInkFadeFragment(basic.fragmentShader);
    expect(fragment).toContain("diffuseColor.a *= smoothstep( uFade.x, uFade.y, vFadeY );");
    expect(fragment.indexOf("diffuseColor.a *=")).toBeLessThan(fragment.indexOf(OPAQUE_CHUNK));
  });

  it("warns and changes nothing for a source without the anchors", () => {
    warn.mockClear();
    expect(patchGloveFragment("void main() {}")).toContain("void main() {}");
    expect(warn).toHaveBeenCalled();
  });
});
