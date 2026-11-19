import { describe, expect, it } from "vitest";

import { parseColor } from "./colors";
import { fragmentFor, PRELUDE } from "./glsl-prelude";
import { BACKDROP_KINDS, BACKDROP_PALETTES } from "./palettes";
import { KIND_DEFS } from "./registry";

describe("the kind registry", () => {
  it("lists at least thirty kinds, each once", () => {
    expect(BACKDROP_KINDS.length).toBeGreaterThanOrEqual(30);
    expect(new Set(BACKDROP_KINDS).size).toBe(BACKDROP_KINDS.length);
  });

  it("has a definition and two palettes for every kind, and nothing else", () => {
    expect(Object.keys(KIND_DEFS).sort()).toEqual([...BACKDROP_KINDS].sort());
    expect(Object.keys(BACKDROP_PALETTES).sort()).toEqual([...BACKDROP_KINDS].sort());
    for (const kind of BACKDROP_KINDS) {
      expect(Object.keys(BACKDROP_PALETTES[kind]).sort()).toEqual(["daybreak", "storm"]);
    }
  });

  it("gives every kind a sane size, speed, scale and angle", () => {
    for (const kind of BACKDROP_KINDS) {
      const def = KIND_DEFS[kind];
      expect(def.res).toBeGreaterThanOrEqual(0.25);
      expect(def.res).toBeLessThanOrEqual(2);
      expect(def.speed).toBeGreaterThan(0);
      expect(def.scale).toBeGreaterThan(0);
      expect(Number.isFinite(def.angle)).toBe(true);
    }
  });

  it("gives every palette one to four colours that parse, an intensity and an ink", () => {
    for (const kind of BACKDROP_KINDS) {
      for (const theme of ["daybreak", "storm"] as const) {
        const p = BACKDROP_PALETTES[kind][theme];
        expect(p.colors.length).toBeGreaterThanOrEqual(1);
        expect(p.colors.length).toBeLessThanOrEqual(4);
        for (const c of p.colors) expect(parseColor(c), `${kind}/${theme} ${c}`).not.toBeNull();
        expect(parseColor(p.ink), `${kind}/${theme} ink`).not.toBeNull();
        expect(p.intensity).toBeGreaterThan(0);
        expect(p.intensity).toBeLessThanOrEqual(2);
      }
    }
  });

  it("keeps daybreak light and storm rich: the first stop of a daybreak palette is never near black", () => {
    for (const kind of BACKDROP_KINDS) {
      const first = parseColor(BACKDROP_PALETTES[kind].daybreak.colors[0]!)!;
      const luma = 0.2126 * first[0] + 0.7152 * first[1] + 0.0722 * first[2];
      // liquid chrome and the veil are the two that run from light to dark on purpose
      expect(luma, kind).toBeGreaterThan(0.12);
    }
  });
});

// The en and em dash, built from their code points so this file carries none.
const DASHES = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`);

describe("the shaders (text checks: the GPU compile is looked at in the browser)", () => {
  const declared = new Set(
    [...PRELUDE.matchAll(/uniform\s+\w+\s+(u[A-Z]\w*)\s*;/g)].map((m) => m[1]),
  );

  it("each defines bg() with the contract's signature, once", () => {
    for (const kind of BACKDROP_KINDS) {
      const src = KIND_DEFS[kind].frag;
      const found = src.match(/vec4 bg\(vec2 uv, vec2 p, vec2 pt, float t\)/g) ?? [];
      expect(found, kind).toHaveLength(1);
    }
  });

  it("only reads uniforms the prelude declares, or that its own source declares (the ink field's trail)", () => {
    for (const kind of BACKDROP_KINDS) {
      const src = KIND_DEFS[kind].frag;
      const own = new Set(
        [...src.matchAll(/uniform\s+\w+\s+(u[A-Z]\w*)(?:\[\d+\])?\s*;/g)].map((m) => m[1]),
      );
      const used = new Set(src.match(/\bu[A-Z][A-Za-z0-9]*\b/g) ?? []);
      for (const name of used) {
        expect(declared.has(name) || own.has(name), `${kind} uses ${name}`).toBe(true);
      }
    }
  });

  it("have balanced braces and parentheses", () => {
    for (const kind of BACKDROP_KINDS) {
      const src = KIND_DEFS[kind].frag;
      expect((src.match(/\{/g) ?? []).length, `${kind} {`).toBe((src.match(/\}/g) ?? []).length);
      expect((src.match(/\(/g) ?? []).length, `${kind} (`).toBe((src.match(/\)/g) ?? []).length);
    }
  });

  it("use no GLSL reserved word as a name and no dash that is not a minus sign", () => {
    const reserved =
      /\b(float|vec\d|int)\s+(smooth|flat|half|filter|sample|input|output|common|active|partition|packed|resource|layout|patch)\b/;
    for (const kind of BACKDROP_KINDS) {
      const src = KIND_DEFS[kind].frag;
      expect(reserved.test(src), kind).toBe(false);
      expect(DASHES.test(src), kind).toBe(false);
    }
  });

  it("joins the prelude, the kind and the frame into one source", () => {
    const src = fragmentFor(KIND_DEFS.aurora.frag);
    expect(src).toContain("void main()");
    expect(src.indexOf("vec4 bg(")).toBeLessThan(src.indexOf("void main()"));
    expect(src.indexOf("vec3 pal(")).toBeLessThan(src.indexOf("vec4 bg("));
  });
});
