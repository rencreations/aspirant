import { describe, expect, it } from "vitest";

import {
  ART,
  ART_ASPECT,
  ART_CENTRE,
  HANDOFF_AT,
  REG,
  SOCKETS,
  bendPoint,
  clamp,
  cornerWeight,
  heroArtWidth,
  heroRect,
  heroTextureSize,
  isHandedOff,
  leanOf,
  makeWarp,
  morphEnvelope,
  navRasterPlan,
  navTargetFor,
  phaseAt,
  rectFromGrabs,
  rectHeight,
  rectScale,
  revealCoord,
  revealMask,
  sagDepthFor,
  sameNavTarget,
  smoothstep,
  stageRectFromDom,
  turnAngle,
  vertexProgress,
  warpPoint,
  waveEnvelope,
  type Point3,
  type Warp,
} from "./math";

const corners = [
  { lx: -ART.w / 2, ly: ART.h / 2 },
  { lx: ART.w / 2, ly: ART.h / 2 },
  { lx: ART.w / 2, ly: -ART.h / 2 },
  { lx: -ART.w / 2, ly: -ART.h / 2 },
];

function warpFor(P: number): Warp {
  const w = makeWarp();
  w.P = P;
  w.fromX = 12;
  w.fromY = 40;
  w.fromK = 0.37;
  w.toX = -1.1;
  w.toY = 410.99;
  w.toK = 0.058;
  w.env = morphEnvelope(P);
  w.phase = phaseAt(P);
  return w;
}

const at = (lx: number, ly: number, w: Warp): Point3 => {
  const out = { x: 0, y: 0, z: 0 };
  warpPoint(lx, ly, w, out);
  return out;
};

describe("the art box", () => {
  it("has the aspect the notes measured and a centre inside the viewBox", () => {
    expect(ART_ASPECT).toBeCloseTo(4.013, 3);
    expect(ART_CENTRE.x).toBeCloseTo(1490.107, 2);
    expect(ART_CENTRE.y).toBeCloseTo(431.43, 2);
  });

  it("pads the region so a mip never shows a rim", () => {
    expect(REG.w - ART.w).toBe(48);
    expect(REG.h - ART.h).toBe(48);
    expect(REG.x).toBe(ART.x - 24);
  });

  it("derives a rect's height and scale from its width", () => {
    const r = { cx: 0, cy: 0, width: 1008 };
    expect(rectHeight(r)).toBeCloseTo(1008 / ART_ASPECT, 6);
    expect(rectScale(r)).toBeCloseTo(1008 / ART.w, 9);
  });
});

describe("the big logo's size", () => {
  it("is 70 percent of the width, held down by 42 percent of the height", () => {
    expect(heroArtWidth(1440, 900)).toBeCloseTo(1008, 3);
    expect(heroArtWidth(1920, 1080)).toBeCloseTo(1344, 3);
    // a wide, short window: the height decides
    expect(heroArtWidth(2400, 600)).toBeCloseTo(0.42 * 600 * ART_ASPECT, 6);
  });

  it("is 86 percent on a phone", () => {
    expect(heroArtWidth(390, 844)).toBeCloseTo(335.4, 1);
  });

  it("stands centred across and a little above the middle", () => {
    const r = heroRect(1440, 900);
    expect(r.cx).toBe(0);
    expect(r.cy).toBeCloseTo(450 - 0.47 * 900, 6);
  });
});

describe("the nav logo as the browser draws it", () => {
  // The live numbers of docs/design/home/infra.md section 4 and the recon (getBoundingClientRect).
  it("lands the art where the page measured it at 1440 x 900", () => {
    const t = navTargetFor({ left: 632.516, top: 14, width: 174.953, height: 52 }, 2, 1440, 900);
    // art rect x 640.40, y 19.45, w 156.99, h 39.12, centre (718.90, 39.01) in CSS pixels
    expect(t.rect.width).toBeGreaterThan(156.9);
    expect(t.rect.width).toBeLessThan(157.1);
    expect(t.rect.cx + 720).toBeCloseTo(718.9, 0);
    expect(450 - t.rect.cy).toBeCloseTo(39.01, 0);
  });

  it("is right aligned on a phone", () => {
    const t = navTargetFor({ left: 251.109, top: 14, width: 121.109, height: 36 }, 2, 390, 844);
    // art rect x 256.57 y 17.77 w 108.68 h 27.08, centre (310.91, 31.31)
    expect(t.rect.width).toBeGreaterThan(108.5);
    expect(t.rect.width).toBeLessThan(108.9);
    expect(t.rect.cx + 195).toBeCloseTo(310.91, 0);
    expect(422 - t.rect.cy).toBeCloseTo(31.31, 0);
  });

  it("rounds the paint offset to a device pixel and fits the viewBox in the box with one scale", () => {
    const t = navTargetFor({ left: 632.516, top: 14, width: 174.953, height: 52 }, 2, 1440, 900);
    // 1265.03 rounds to 1265; the scale is the laid out box's, not stretched to the rounded one
    expect(t.originX * 2).toBeCloseTo(1265, 1);
    expect(t.unit * 2 * 897).toBeGreaterThan(103.99);
    expect(t.unit * 2 * 897).toBeLessThan(104.01);
    expect(t.domDpr).toBe(2);
  });

  it("rounds to a whole CSS pixel at ratio 1 (633 for 632.516), as the fits showed", () => {
    const t = navTargetFor(
      { left: 632.515625, top: 14, width: 174.953125, height: 52 },
      1,
      1440,
      900,
    );
    expect(t.originX).toBeCloseTo(633, 2);
    expect(t.originY).toBeCloseTo(14, 2);
    // the fit's scale was 0.05797
    expect(t.unit).toBeCloseTo(0.05797, 5);
  });

  it("rounds at the device pixel at 1.5 (765.516 is 1148.27 device px, so 1148)", () => {
    const t = navTargetFor(
      { left: 765.515625, top: 14, width: 174.953125, height: 52 },
      1.5,
      1706,
      950,
    );
    expect(t.originX * 1.5).toBeCloseTo(1148.02, 1);
  });

  it("treats a bad ratio as 1", () => {
    const t = navTargetFor({ left: 10, top: 10, width: 175, height: 52 }, 0, 1000, 800);
    expect(t.domDpr).toBe(1);
  });

  it("compares two targets by value", () => {
    const a = navTargetFor({ left: 632.516, top: 14, width: 174.953, height: 52 }, 2, 1440, 900);
    const b = navTargetFor({ left: 632.516, top: 14, width: 174.953, height: 52 }, 2, 1440, 900);
    const c = navTargetFor({ left: 640.516, top: 14, width: 174.953, height: 52 }, 2, 1440, 900);
    expect(sameNavTarget(a, b)).toBe(true);
    expect(sameNavTarget(a, c)).toBe(false);
    expect(sameNavTarget(a, null)).toBe(false);
    expect(sameNavTarget(null, null)).toBe(true);
  });

  it("converts a DOM rect to the stage frame (y up, origin in the middle)", () => {
    const r = stageRectFromDom(100, 20, 400, 1000, 800);
    expect(r.cx).toBeCloseTo(100 + 200 - 500, 9);
    expect(r.cy).toBeCloseTo(400 - (20 + 400 / ART_ASPECT / 2), 9);
    expect(r.width).toBe(400);
  });
});

describe("the raster of the nav logo", () => {
  for (const dpr of [1, 1.25, 1.5, 2, 3]) {
    it(`puts the region's corner plus the snap on a whole device pixel at ${dpr}x`, () => {
      const t = navTargetFor(
        { left: 632.516, top: 14, width: 174.953, height: 52 },
        dpr,
        1440,
        900,
      );
      const plan = navRasterPlan(t, dpr);
      const cornerX = t.originX * dpr + REG.x * plan.scale;
      const cornerY = t.originY * dpr + REG.y * plan.scale;
      const shiftedX = cornerX + plan.snapX * dpr;
      const shiftedY = cornerY - plan.snapY * dpr;
      expect(Math.abs(shiftedX - Math.round(shiftedX))).toBeLessThan(1e-9);
      expect(Math.abs(shiftedY - Math.round(shiftedY))).toBeLessThan(1e-9);
      // the snap never moves the logo by a whole pixel or more
      expect(Math.abs(plan.snapX)).toBeLessThan(1 / dpr + 1e-9);
      expect(Math.abs(plan.snapY)).toBeLessThan(1 / dpr + 1e-9);
    });

    it(`has a canvas that holds the whole region at ${dpr}x`, () => {
      const t = navTargetFor(
        { left: 632.516, top: 14, width: 174.953, height: 52 },
        dpr,
        1440,
        900,
      );
      const plan = navRasterPlan(t, dpr);
      expect(plan.w).toBeGreaterThanOrEqual(REG.w * plan.scale);
      expect(plan.h).toBeGreaterThanOrEqual(REG.h * plan.scale);
      expect(plan.uvX).toBeLessThanOrEqual(1);
      expect(plan.uvY).toBeLessThanOrEqual(1);
      // the viewBox origin sits inside the canvas by its fractional phase
      expect(plan.drawX).toBeGreaterThanOrEqual(-REG.x * plan.scale - 1);
    });
  }
});

describe("the hero texture's size", () => {
  it("is one texel to a device pixel across the art, oversampled", () => {
    const { w, h } = heroTextureSize(1008, 2, 1.25);
    expect(w).toBeGreaterThan(1008 * 2 * 1.25);
    expect(h).toBe(Math.round((REG.h * w) / REG.w));
  });

  it("caps at 4096", () => {
    expect(heroTextureSize(3000, 2, 1.25).w).toBe(4096);
  });

  it("has a floor", () => {
    expect(heroTextureSize(1, 1, 1).w).toBe(64);
  });
});

describe("the reel's corner stagger", () => {
  it("weighs the top right 0 and the bottom left 1", () => {
    expect(cornerWeight(1, 1)).toBeCloseTo(0, 9);
    expect(cornerWeight(0, 0)).toBeCloseTo(1, 9);
    expect(cornerWeight(0, 1)).toBeCloseTo(0.5, 9);
    expect(cornerWeight(1, 0)).toBeCloseTo(0.5, 9);
  });

  it("starts the top right first and ends it first", () => {
    const P = 0.3;
    expect(vertexProgress(P, 0)).toBeGreaterThan(vertexProgress(P, 0.5));
    expect(vertexProgress(P, 0.5)).toBeGreaterThan(vertexProgress(P, 1));
    expect(vertexProgress(0, 1)).toBe(0);
    expect(vertexProgress(1, 1)).toBe(1);
    expect(vertexProgress(1, 0)).toBe(1);
    expect(vertexProgress(0.7, 0)).toBe(1);
    expect(vertexProgress(0.3, 1)).toBe(0);
  });

  it("turns one way, then back, and is 0 at both ends", () => {
    expect(turnAngle(0)).toBeCloseTo(0, 12);
    expect(turnAngle(1)).toBeCloseTo(0, 12);
    expect(turnAngle(0.5)).toBeCloseTo(0, 12);
    // the table of the notes: 5.5 degrees at v = 0.2, the other way at 0.8
    expect((turnAngle(0.2) * 180) / Math.PI).toBeCloseTo(5.5, 1);
    expect((turnAngle(0.8) * 180) / Math.PI).toBeCloseTo(-5.5, 1);
  });

  it("leans 10 percent at the middle and nothing at the ends", () => {
    expect(leanOf(0)).toBe(0);
    expect(leanOf(1)).toBeCloseTo(0, 12);
    expect(leanOf(0.5)).toBeCloseTo(0.1, 9);
  });

  it("has a wave envelope that is 0 at both ends and 1 in the middle", () => {
    expect(morphEnvelope(0)).toBe(0);
    expect(morphEnvelope(1)).toBeLessThan(1e-12);
    expect(morphEnvelope(0.5)).toBeCloseTo(1, 12);
    expect(morphEnvelope(-1)).toBe(0);
    expect(morphEnvelope(2)).toBeLessThan(1e-12);
  });

  it("lets a rest ripple go as the morph starts, so the bar's logo is flat at the hand-off", () => {
    expect(waveEnvelope(0, 0.7)).toBeCloseTo(0.7, 9);
    expect(waveEnvelope(0, 0)).toBe(0);
    for (const rest of [0.3, 1]) {
      expect(waveEnvelope(HANDOFF_AT, rest)).toBeLessThan(1e-3);
      expect(waveEnvelope(1, rest)).toBeLessThan(1e-9);
      expect(waveEnvelope(0.5, rest)).toBeCloseTo(1, 9);
    }
    // never less than the morph's own envelope, never more than 1
    expect(waveEnvelope(0.1, 0.2)).toBeGreaterThanOrEqual(morphEnvelope(0.1));
    expect(waveEnvelope(0.3, 5)).toBeLessThanOrEqual(1);
  });

  it("runs a crest 2.2 wavelengths over the morph", () => {
    expect(phaseAt(0)).toBe(0);
    expect(phaseAt(1)).toBeCloseTo(2.2, 9);
  });
});

describe("the warp at the two ends", () => {
  it("is the rest rect at P = 0 for every corner", () => {
    const w = warpFor(0);
    for (const c of corners) {
      const p = at(c.lx, c.ly, w);
      expect(p.x).toBeCloseTo(w.fromX + w.fromK * c.lx, 6);
      expect(p.y).toBeCloseTo(w.fromY + w.fromK * c.ly, 6);
      expect(p.z).toBeCloseTo(0, 9);
    }
  });

  it("is the nav rect at P = 1 for every corner, to 0.01 px", () => {
    const w = warpFor(1);
    for (const c of corners) {
      const p = at(c.lx, c.ly, w);
      expect(Math.abs(p.x - (w.toX + w.toK * c.lx))).toBeLessThan(0.01);
      expect(Math.abs(p.y - (w.toY + w.toK * c.ly))).toBeLessThan(0.01);
    }
  });

  it("is the nav rect plus the device pixel snap at P = 1", () => {
    const w = warpFor(1);
    w.snapX = -0.25;
    w.snapY = 0.125;
    const p = at(0, 0, w);
    expect(p.x).toBeCloseTo(w.toX - 0.25, 6);
    expect(p.y).toBeCloseTo(w.toY + 0.125, 6);
  });

  it("puts the middle of the logo on the middle of the rect at both ends", () => {
    const a = at(0, 0, warpFor(0));
    expect(a.x).toBeCloseTo(12, 6);
    expect(a.y).toBeCloseTo(40, 6);
    const b = at(0, 0, warpFor(1));
    expect(b.x).toBeCloseTo(-1.1, 2);
    expect(b.y).toBeCloseTo(410.99, 2);
  });

  it("leaves the top right first and the bottom left last", () => {
    const P = 0.35;
    const w = warpFor(P);
    const tr = at(ART.w / 2, ART.h / 2, w);
    const bl = at(-ART.w / 2, -ART.h / 2, w);
    // distance travelled along x from the rest corner toward the nav corner, as a share
    const share = (p: Point3, lx: number): number => {
      const from = 12 + 0.37 * lx;
      const to = -1.1 + 0.058 * lx;
      return (p.x - from) / (to - from);
    };
    expect(share(tr, ART.w / 2)).toBeGreaterThan(share(bl, -ART.w / 2));
  });

  it("holds the wave at 0 when the envelope is 0 (a pure function of P, so it reverses)", () => {
    const a = at(300, 20, warpFor(0.6));
    const b = at(300, 20, warpFor(0.6));
    expect(a).toEqual(b);
  });

  it("lifts the logo in the middle of the morph and not at the ends", () => {
    let max = 0;
    for (let P = 0; P <= 1.0001; P += 0.05) {
      const w = warpFor(P);
      const flat = warpFor(P);
      flat.env = 0;
      const dy = Math.abs(at(-400, 0, w).y - at(-400, 0, flat).y);
      max = Math.max(max, dy);
      if (P === 0 || P >= 1) expect(dy).toBeLessThan(1e-6);
    }
    expect(max).toBeGreaterThan(5);
  });

  it("applies the roll and tilt only at rest, and lets go as the corner arrives", () => {
    const w = warpFor(0);
    w.roll = 0.3;
    const p = at(ART.w / 2, 0, w);
    expect(p.y - w.fromY).toBeGreaterThan(0.1 * ART.w * 0.37 * 0.5);
    const end = warpFor(1);
    end.roll = 0.3;
    end.tilt = 0.4;
    end.yaw = 0.4;
    const q = at(ART.w / 2, 0, end);
    expect(Math.abs(q.x - (end.toX + (end.toK * ART.w) / 2))).toBeLessThan(0.01);
    expect(Math.abs(q.y - end.toY)).toBeLessThan(0.01);
    expect(Math.abs(q.z)).toBeLessThan(0.01);
  });

  it("tips the top toward the camera for a positive tilt", () => {
    const w = warpFor(0);
    w.tilt = 0.5;
    const p = at(0, ART.h / 2, w);
    expect(p.z).toBeGreaterThan(0);
  });
});

describe("handing over to the DOM logo", () => {
  it("is true only at the very end", () => {
    expect(isHandedOff(0)).toBe(false);
    expect(isHandedOff(0.99)).toBe(false);
    expect(isHandedOff(HANDOFF_AT)).toBe(true);
    expect(isHandedOff(1)).toBe(true);
  });

  it("has nothing left of the wave at the hand-off progress, under a hundredth of a pixel", () => {
    const w = warpFor(HANDOFF_AT);
    const flat = warpFor(HANDOFF_AT);
    flat.env = 0;
    for (const c of corners) {
      const a = at(c.lx, c.ly, w);
      const b = at(c.lx, c.ly, flat);
      expect(Math.abs(a.x - b.x)).toBeLessThan(0.01);
      expect(Math.abs(a.y - b.y)).toBeLessThan(0.01);
    }
  });
});

describe("the sag of a carried logo", () => {
  const sag = (depth: number, wobble = 0) => ({
    depth,
    xL: SOCKETS.left.x,
    xR: SOCKETS.right.x,
    y: SOCKETS.left.y,
    wobble,
  });
  const out = { x: 0, y: 0 };

  it("leaves the two holds where they are, at any depth and wobble", () => {
    for (const depth of [0, 100, 337]) {
      for (const wobble of [-1, 0, 0.6]) {
        const s = sag(depth, wobble);
        bendPoint(SOCKETS.left.x, SOCKETS.left.y, s, out);
        expect(out.x).toBeCloseTo(SOCKETS.left.x, 6);
        expect(out.y).toBeCloseTo(SOCKETS.left.y, 6);
        bendPoint(SOCKETS.right.x, SOCKETS.right.y, s, out);
        expect(out.x).toBeCloseTo(SOCKETS.right.x, 6);
        expect(out.y).toBeCloseTo(SOCKETS.right.y, 6);
      }
    }
  });

  it("drops the middle by the depth", () => {
    const mid = (SOCKETS.left.x + SOCKETS.right.x) / 2;
    bendPoint(mid, SOCKETS.left.y, sag(200), out);
    expect(out.y).toBeCloseTo(SOCKETS.left.y - 200, 6);
    expect(out.x).toBeCloseTo(mid, 6);
  });

  it("does nothing at depth 0", () => {
    bendPoint(123, -45, sag(0), out);
    expect(out).toEqual({ x: 123, y: -45 });
  });

  it("is deeper for a looser hold, and 0 for a taut one", () => {
    expect(sagDepthFor(0)).toBe(0);
    expect(sagDepthFor(1)).toBeGreaterThan(sagDepthFor(0.5));
    expect(sagDepthFor(2)).toBe(sagDepthFor(1));
    expect(sagDepthFor(-1)).toBe(0);
  });

  it("swings the heaviest part toward the wobble's side", () => {
    const quarter = SOCKETS.left.x + 0.25 * (SOCKETS.right.x - SOCKETS.left.x);
    const three = SOCKETS.left.x + 0.75 * (SOCKETS.right.x - SOCKETS.left.x);
    const drop = (x: number, wobble: number): number => {
      bendPoint(x, SOCKETS.left.y, sag(200, wobble), out);
      return SOCKETS.left.y - out.y;
    };
    expect(drop(three, 0.6)).toBeGreaterThan(drop(three, -0.6));
    expect(drop(quarter, -0.6)).toBeGreaterThan(drop(quarter, 0.6));
  });

  it("goes on along the end tangent beyond the holds, without a kink", () => {
    const s = sag(200);
    bendPoint(SOCKETS.left.x - 1, SOCKETS.left.y, s, out);
    const a = { ...out };
    bendPoint(SOCKETS.left.x - 2, SOCKETS.left.y, s, out);
    const b = { ...out };
    bendPoint(SOCKETS.left.x + 1, SOCKETS.left.y, s, out);
    const c = { ...out };
    const slopeBefore = (a.y - b.y) / (a.x - b.x);
    const slopeAfter = (c.y - a.y) / (c.x - a.x);
    expect(Math.abs(slopeBefore - slopeAfter)).toBeLessThan(0.02);
  });
});

describe("carrying the logo between two points", () => {
  const pa = { x: -240, y: 130 };
  const pb = { x: 310, y: 60 };

  it("puts the left and right sockets on the two points", () => {
    const { rect, roll } = rectFromGrabs(SOCKETS.left, SOCKETS.right, pa, pb);
    const w = makeWarp();
    w.fromX = rect.cx;
    w.fromY = rect.cy;
    w.fromK = rectScale(rect);
    w.roll = roll;
    const l = at(SOCKETS.left.x, SOCKETS.left.y, w);
    const r = at(SOCKETS.right.x, SOCKETS.right.y, w);
    expect(l.x).toBeCloseTo(pa.x, 6);
    expect(l.y).toBeCloseTo(pa.y, 6);
    expect(r.x).toBeCloseTo(pb.x, 6);
    expect(r.y).toBeCloseTo(pb.y, 6);
  });

  it("keeps the sockets on the points with the logo sagging between them", () => {
    const { rect, roll } = rectFromGrabs(SOCKETS.left, SOCKETS.right, pa, pb);
    const w = makeWarp();
    w.fromX = rect.cx;
    w.fromY = rect.cy;
    w.fromK = rectScale(rect);
    w.roll = roll;
    w.sag = {
      depth: sagDepthFor(1),
      xL: SOCKETS.left.x,
      xR: SOCKETS.right.x,
      y: SOCKETS.left.y,
      wobble: 0.4,
    };
    const l = at(SOCKETS.left.x, SOCKETS.left.y, w);
    const r = at(SOCKETS.right.x, SOCKETS.right.y, w);
    expect(l.x).toBeCloseTo(pa.x, 5);
    expect(l.y).toBeCloseTo(pa.y, 5);
    expect(r.x).toBeCloseTo(pb.x, 5);
    expect(r.y).toBeCloseTo(pb.y, 5);
  });

  it("scales with the distance of the two points", () => {
    const a = rectFromGrabs(SOCKETS.left, SOCKETS.right, { x: -100, y: 0 }, { x: 100, y: 0 });
    const b = rectFromGrabs(SOCKETS.left, SOCKETS.right, { x: -200, y: 0 }, { x: 200, y: 0 });
    expect(b.rect.width / a.rect.width).toBeCloseTo(2, 9);
    expect(a.roll).toBeCloseTo(0, 9);
  });

  it("turns with the slope of the two points", () => {
    const level = rectFromGrabs(SOCKETS.left, SOCKETS.right, { x: -100, y: 0 }, { x: 100, y: 0 });
    const up = rectFromGrabs(SOCKETS.left, SOCKETS.right, { x: -100, y: 0 }, { x: 100, y: 50 });
    expect(up.roll).toBeGreaterThan(level.roll);
  });

  it("copes with two points on top of each other", () => {
    const { rect } = rectFromGrabs(SOCKETS.left, SOCKETS.right, { x: 5, y: 5 }, { x: 5, y: 5 });
    expect(Number.isFinite(rect.cx)).toBe(true);
    expect(rect.width).toBe(0);
  });
});

describe("the reveal", () => {
  it("runs left to right with a slant", () => {
    expect(revealCoord(0, 1)).toBe(0);
    expect(revealCoord(1, 0)).toBeCloseTo(1, 9);
    expect(revealCoord(0.5, 1)).toBeLessThan(revealCoord(0.5, 0));
  });

  it("is nothing at 0 and everything at 1 for every coordinate", () => {
    for (let s = 0; s <= 1.0001; s += 0.1) {
      expect(revealMask(s, 0)).toBe(0);
      expect(revealMask(s, 1)).toBe(1);
    }
  });

  it("grows with the front", () => {
    expect(revealMask(0.5, 0.7)).toBeGreaterThanOrEqual(revealMask(0.5, 0.5));
  });
});

describe("small helpers", () => {
  it("clamps and eases", () => {
    expect(clamp(2)).toBe(1);
    expect(clamp(-2)).toBe(0);
    expect(clamp(5, -1, 1)).toBe(1);
    expect(smoothstep(0, 1, 0.5)).toBeCloseTo(0.5, 9);
    expect(smoothstep(0.2, 0.6, 0.1)).toBe(0);
    expect(smoothstep(0.2, 0.6, 0.9)).toBe(1);
  });
});
