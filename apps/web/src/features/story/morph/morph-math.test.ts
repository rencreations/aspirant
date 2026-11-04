import { describe, expect, it } from "vitest";

import {
  applyFlip,
  clipLayers,
  composeLayers,
  crossing,
  cubicBezier,
  mixPlacement,
  mixRect,
  parseFocus,
  stageFit,
  timeAt,
  windowFrames,
  wordFlip,
  type Box,
  type Placement,
  type Rect,
} from "./morph-math";

const FULL: Box = { w: 1425, h: 900 };
const CARD: Rect = { x: 208, y: 402, w: 1008, h: 360 };

function near(a: number, b: number, digits = 6) {
  expect(a).toBeCloseTo(b, digits);
}

function sameRect(a: Rect, b: Rect) {
  near(a.x, b.x);
  near(a.y, b.y);
  near(a.w, b.w);
  near(a.h, b.h);
}

function samePlacement(a: Placement, b: Placement) {
  near(a.x, b.x);
  near(a.y, b.y);
  near(a.s, b.s);
}

describe("the focus of a picture", () => {
  it("reads percentages and keywords", () => {
    expect(parseFocus("60% 40%")).toEqual({ x: 0.6, y: 0.4 });
    expect(parseFocus("center")).toEqual({ x: 0.5, y: 0.5 });
    expect(parseFocus("left bottom")).toEqual({ x: 0, y: 1 });
    expect(parseFocus("top")).toEqual({ x: 0.5, y: 0 });
    expect(parseFocus("")).toEqual({ x: 0.5, y: 0.5 });
    expect(parseFocus(undefined)).toEqual({ x: 0.5, y: 0.5 });
  });
});

describe("the stage of the card", () => {
  it("fills the card with a uniformly scaled title card, centered on the focus", () => {
    const fit = stageFit(CARD, FULL, { x: 0.5, y: 0.5 });
    near(fit.s, Math.max(CARD.w / FULL.w, CARD.h / FULL.h));
    // It covers the card on both axes.
    expect(fit.x).toBeLessThanOrEqual(0);
    expect(fit.y).toBeLessThanOrEqual(0);
    expect(fit.x + FULL.w * fit.s).toBeGreaterThanOrEqual(CARD.w - 1e-9);
    expect(fit.y + FULL.h * fit.s).toBeGreaterThanOrEqual(CARD.h - 1e-9);
    // The focus point sits in the middle of the band the card shows.
    near(fit.y + 0.5 * FULL.h * fit.s, CARD.h / 2);
  });

  it("never lets the band leave the picture", () => {
    const top = stageFit(CARD, FULL, { x: 0.5, y: 0 });
    near(top.y, 0);
    const bottom = stageFit(CARD, FULL, { x: 0.5, y: 1 });
    near(bottom.y + FULL.h * bottom.s, CARD.h);
  });

  it("centers a tall card on the focus sideways", () => {
    const tall: Box = { w: 300, h: 600 };
    const fit = stageFit(tall, FULL, { x: 0.2, y: 0.5 });
    near(fit.s, 600 / 900);
    near(fit.x + 0.2 * FULL.w * fit.s, 150);
  });
});

describe("the window", () => {
  const stage: Placement = { x: CARD.x - 40, y: CARD.y - 120, s: CARD.w / FULL.w };
  const screen: Rect = { x: 0, y: 0, w: FULL.w, h: FULL.h };
  const one: Placement = { x: 0, y: 0, s: 1 };

  it("shows the card at the start and the whole screen at the end", () => {
    sameRect(composeLayers(clipLayers(CARD, stage, FULL), FULL).win, CARD);
    samePlacement(composeLayers(clipLayers(CARD, stage, FULL), FULL).content, stage);
    sameRect(composeLayers(clipLayers(screen, one, FULL), FULL).win, screen);
    samePlacement(composeLayers(clipLayers(screen, one, FULL), FULL).content, one);
  });

  it("is never stretched: the content keeps one scale and its place at every step", () => {
    for (let i = 0; i <= 30; i += 1) {
      const t = i / 30;
      const win = mixRect(CARD, screen, t);
      const content = mixPlacement(stage, one, t);
      const shown = composeLayers(clipLayers(win, content, FULL), FULL);
      sameRect(shown.win, win);
      samePlacement(shown.content, content);
    }
  });

  it("is linear in the eased progress, so two keyframes are exact in between", () => {
    const layersA = clipLayers(CARD, stage, FULL);
    const layersB = clipLayers(screen, one, FULL);
    for (let i = 0; i <= 10; i += 1) {
      const t = i / 10;
      // What the browser draws between the keyframes: each layer interpolated on its own.
      const between = {
        outer: {
          x: layersA.outer.x + (layersB.outer.x - layersA.outer.x) * t,
          y: layersA.outer.y + (layersB.outer.y - layersA.outer.y) * t,
        },
        inner: {
          x: layersA.inner.x + (layersB.inner.x - layersA.inner.x) * t,
          y: layersA.inner.y + (layersB.inner.y - layersA.inner.y) * t,
        },
        counter: {
          x: layersA.counter.x + (layersB.counter.x - layersA.counter.x) * t,
          y: layersA.counter.y + (layersB.counter.y - layersA.counter.y) * t,
        },
        content: mixPlacement(layersA.content, layersB.content, t),
      };
      const shown = composeLayers(between, FULL);
      sameRect(shown.win, mixRect(CARD, screen, t));
      samePlacement(shown.content, mixPlacement(stage, one, t));
    }
  });

  it("writes two keyframes per layer, the card first", () => {
    const frames = windowFrames(CARD, stage, screen, one, FULL);
    expect(frames.outer[0]).toBe("translate(208px, 402px)");
    expect(frames.outer[1]).toBe("translate(0px, 0px)");
    expect(frames.inner[0]).toBe(`translate(${CARD.w - FULL.w}px, ${CARD.h - FULL.h}px)`);
    expect(frames.content[1]).toBe("translate(0px, 0px) scale(1)");
    expect(frames.shade[0]).toBe("translate(208px, 402px) scale(1, 1)");
  });
});

describe("a word that moves", () => {
  it("sits on the card's word at the start, with the ratio of the font sizes", () => {
    const from: Rect = { x: 240, y: 610, w: 120, h: 40 };
    const to: Rect = { x: 72, y: 560, w: 240, h: 80 };
    const box = { x: 70, y: 566 };
    const k = 0.5;
    const flip = wordFlip(from, to, box, k);
    const a = applyFlip(flip, box, { x: to.x, y: to.y });
    near(a.x, from.x);
    near(a.y, from.y);
    const b = applyFlip(flip, box, { x: to.x + to.w, y: to.y + to.h });
    near(b.x, from.x + from.w);
    near(b.y, from.y + from.h);
  });
});

describe("easing", () => {
  it("is a monotonic cubic bezier with its CSS string, and can be inverted", () => {
    const ease = cubicBezier(0.62, 0, 0.18, 1);
    expect(ease.css).toBe("cubic-bezier(0.62, 0, 0.18, 1)");
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
    let last = 0;
    for (let i = 1; i <= 50; i += 1) {
      const v = ease(i / 50);
      expect(v).toBeGreaterThanOrEqual(last);
      last = v;
    }
    near(ease(timeAt(ease, 0.8)), 0.8, 4);
  });

  it("finds where a moving edge crosses a line", () => {
    expect(crossing(400, 0, 80)).toBeCloseTo(0.8);
    expect(crossing(0, 900, 80)).toBeCloseTo(80 / 900);
    expect(crossing(10, 10, 80)).toBe(0);
  });
});
