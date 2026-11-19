import { writeFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { jointZones, playThresholds, restFor, zoneIndexAt, ZONE_INSET } from "./snap";
import { homeLayout } from "./where";

/**
 * The real registry's joints. These are the invariants that hold for any page of sections: a change
 * of a length, a lead or a play table moves the joints and must not break them.
 */
describe("the joints of the real page", () => {
  const layout = homeLayout();
  const zones = jointZones(layout);
  const thresholds = playThresholds(layout);

  it("has joints, in order, with no overlap, all inside the page", () => {
    expect(zones.length).toBeGreaterThan(3);
    for (let i = 0; i < zones.length; i++) {
      const z = zones[i]!;
      expect(z.to).toBeGreaterThan(z.from);
      expect(z.from).toBeGreaterThanOrEqual(0);
      expect(z.to).toBeLessThanOrEqual(layout.total + 1);
      if (i > 0) expect(z.from).toBeGreaterThan(zones[i - 1]!.to);
    }
  });

  it("never offers a rest inside a joint or across a threshold, from any position in any joint", () => {
    const lines: string[] = [];
    for (const z of zones) {
      let withRest = 0;
      let without = 0;
      for (let s = z.from + ZONE_INSET + 0.001; s < z.to - ZONE_INSET; s += 0.007) {
        const target = restFor(z, thresholds, s);
        if (Number.isNaN(target)) {
          without++;
          continue;
        }
        withRest++;
        expect(zoneIndexAt(zones, target), `joint ${z.from}-${z.to} from ${s}`).toBe(-1);
        const lo = Math.min(s, target);
        const hi = Math.max(s, target);
        for (const t of thresholds) {
          expect(t > lo + 1e-9 && t < hi - 1e-9, `${t} crossed from ${s} to ${target}`).toBe(false);
        }
      }
      lines.push(
        `${z.from.toFixed(3)} to ${z.to.toFixed(3)}  rest from ${withRest} positions, none from ${without}`,
      );
    }
    if (process.env.K6_DUMP) writeFileSync(process.env.K6_DUMP, lines.join("\n"));
  });

  it("keeps the footer (a section that never rests) out of every joint", () => {
    const footer = layout.placed.find((p) => p.def.dom === "flow");
    if (!footer) return;
    for (const z of zones) {
      expect(z.from < footer.to && z.to > footer.from).toBe(false);
    }
  });
});
