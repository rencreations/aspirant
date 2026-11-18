import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { documentScreens, layoutSections } from "./layout";
import { SECTIONS } from "./sections";
import { SECTION_IDS } from "./types";
import { homeLayout, sectionEnd, sectionScreens, sectionStart } from "./where";

describe("where", () => {
  it("reads the real registry", () => {
    const layout = layoutSections(SECTIONS);
    for (const p of layout.placed) {
      expect(sectionStart(p.id)).toBe(p.start);
      expect(sectionScreens(p.id)).toBe(p.def.screens);
      expect(sectionEnd(p.id)).toBe(p.end);
    }
    expect(documentScreens(homeLayout())).toBe(documentScreens(layout));
  });

  it("starts each section where the one before it ends", () => {
    for (let i = 1; i < SECTION_IDS.length; i++) {
      const before = SECTION_IDS[i - 1]!;
      const here = SECTION_IDS[i]!;
      expect(sectionStart(here), here).toBeCloseTo(
        sectionStart(before) + sectionScreens(before),
        9,
      );
      expect(sectionEnd(before)).toBeCloseTo(sectionStart(here), 9);
    }
  });

  it("refuses a section that is not in the registry", () => {
    expect(() => sectionStart("nowhere" as never)).toThrow(/no section "nowhere"/);
  });
});

/** The files a module imports with a static `import` or `export ... from` (a dynamic import is a lazy chunk). */
function staticImports(file: string): string[] {
  const text = readFileSync(file, "utf8");
  const found: string[] = [];
  const re = /^\s*(?:import|export)\s+(?:type\s+)?(?:[^;'"]*?\sfrom\s+)?["']([^"']+)["']/gm;
  for (const m of text.matchAll(re)) found.push(m[1]!);
  return found;
}

function resolveImport(from: string, spec: string, srcRoot: string): string | null {
  let base: string;
  if (spec.startsWith(".")) base = path.resolve(path.dirname(from), spec);
  else if (spec.startsWith("@/")) base = path.join(srcRoot, spec.slice(2));
  else return null;
  for (const candidate of [
    `${base}.ts`,
    `${base}.tsx`,
    path.join(base, "index.ts"),
    path.join(base, "index.tsx"),
  ]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

describe("the module graph of the registry", () => {
  const homeRoot = path.resolve(import.meta.dirname, "..");
  const srcRoot = path.resolve(homeRoot, "..", "..");
  const where = path.join(homeRoot, "kernel", "where.ts");

  function closure(entries: string[]): Set<string> {
    const seen = new Set<string>();
    const todo = [...entries];
    while (todo.length) {
      const file = todo.pop()!;
      if (seen.has(file)) continue;
      seen.add(file);
      for (const spec of staticImports(file)) {
        const next = resolveImport(file, spec, srcRoot);
        // Only the home's own files can reach the home's registry.
        if (next?.startsWith(homeRoot)) todo.push(next);
      }
    }
    return seen;
  }

  it("never reaches kernel/where.ts from a section's index.ts or preload.ts", () => {
    const sectionsDir = path.join(homeRoot, "sections");
    const entries: string[] = [];
    for (const dir of readdirSync(sectionsDir)) {
      for (const name of ["index.ts", "preload.ts"]) {
        const file = path.join(sectionsDir, dir, name);
        if (existsSync(file)) entries.push(file);
      }
    }
    expect(entries.length).toBeGreaterThanOrEqual(SECTION_IDS.length * 2);
    // The registry itself, too: it is where the graph starts.
    entries.push(path.join(homeRoot, "kernel", "sections.ts"));
    const reached = closure(entries);
    const offenders = [...reached].filter((f) =>
      staticImports(f).some((s) => resolve(f, s) === where),
    );
    expect(offenders.map((f) => path.relative(homeRoot, f))).toEqual([]);
  });

  function resolve(file: string, spec: string): string | null {
    return resolveImport(file, spec, srcRoot);
  }
});
