import { ShaderLib } from "three";
import { afterEach, describe, expect, it, vi } from "vitest";

import { COPIES, patchDollInkVertex, shiftOf } from "./ink";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("shiftOf", () => {
  it("is a unit vector, evenly round the circle", () => {
    for (let i = 0; i < COPIES; i += 1) {
      const [x, y] = shiftOf(i);
      expect(Math.hypot(x, y)).toBeCloseTo(1, 10);
    }
    expect(shiftOf(0)[0]).toBeCloseTo(1, 10);
    const sum = Array.from({ length: COPIES }, (_, i) => shiftOf(i)).reduce(
      (a, v) => [a[0] + v[0], a[1] + v[1]],
      [0, 0],
    );
    expect(Math.abs(sum[0] ?? 1)).toBeLessThan(1e-9);
    expect(Math.abs(sum[1] ?? 1)).toBeLessThan(1e-9);
  });
});

describe("patchDollInkVertex", () => {
  it("finds its anchor in three's basic vertex shader and shifts after it", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const out = patchDollInkVertex(ShaderLib.basic.vertexShader);
    expect(warn).not.toHaveBeenCalled();
    expect(out.indexOf("gl_Position = inkClip;")).toBeGreaterThan(
      out.indexOf("#include <project_vertex>"),
    );
    expect(out).toContain("uniform vec2 uInkShift;");
  });

  it("takes the depth from the pushed point and the place from the point itself", () => {
    const out = patchDollInkVertex(ShaderLib.basic.vertexShader);
    expect(out).toContain("pushedView.z -= uInkPush;");
    expect(out).toContain("inkClip.z = pushedClip.z / pushedClip.w * inkClip.w;");
    expect(out).toContain("inkClip.xy += uInkShift");
  });

  it("warns and leaves a shader with no anchor as it is", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(patchDollInkVertex("void main() {}")).toBe("void main() {}");
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
