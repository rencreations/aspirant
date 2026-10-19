import { describe, expect, it } from "vitest";

import { pickTier } from "./media";

const base = { width: 1920, height: 1080, dpr: 1 };

describe("pickTier", () => {
  it("gives a 4K screen the biggest video", () => {
    expect(pickTier({ width: 1920, height: 1080, dpr: 2 })).toBe("2160");
    expect(pickTier({ width: 3840, height: 2160, dpr: 1 })).toBe("2160");
  });

  it("gives a full HD screen the middle size, and small windows the smallest", () => {
    expect(pickTier(base)).toBe("1440");
    expect(pickTier({ width: 1280, height: 720, dpr: 1 })).toBe("1080");
    expect(pickTier({ width: 1024, height: 576, dpr: 1 })).toBe("1080");
  });

  it("matches a retina laptop to the 4K video", () => {
    expect(pickTier({ width: 1440, height: 900, dpr: 2 })).toBe("2160");
  });

  it("stops touch devices at the middle size and spares low memory", () => {
    expect(pickTier({ width: 1024, height: 1366, dpr: 2, touch: true })).toBe("1440");
    expect(pickTier({ width: 390, height: 844, dpr: 3, touch: true })).toBe("1440");
    expect(pickTier({ width: 390, height: 844, dpr: 3, touch: true, memory: 4 })).toBe("1080");
    expect(pickTier({ ...base, dpr: 2, memory: 2 })).toBe("1080");
  });

  it("gives the smallest video to a visitor who saves data", () => {
    expect(pickTier({ width: 3840, height: 2160, dpr: 2, saveData: true })).toBe("1080");
  });
});
