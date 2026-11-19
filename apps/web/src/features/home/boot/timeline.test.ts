import { describe, expect, it } from "vitest";

import { newRoutePlace, routeAt } from "../drone-route";
import { heroRect } from "../fx/logo/math";
import {
  CUES,
  GRIP_SPAN,
  INTRO_SECONDS,
  LOADER_DRONE,
  LOGO_REST_WAVE,
  T,
  carriedRect,
  carriedWidth,
  cuesBetween,
  duoBall,
  introAt,
  loaderPlace,
  newIntroState,
  pullRectFor,
  type IntroGeo,
} from "./timeline";

const SIZES: IntroGeo[] = [
  { w: 1440, h: 900 },
  { w: 1706, h: 950 },
  { w: 390, h: 844 },
];

const DT = 1 / 60;

describe("the intro's length", () => {
  it("is two seconds at most, from the press to the first frame of the hero (the owner's call)", () => {
    expect(INTRO_SECONDS).toBeLessThanOrEqual(2);
    expect(INTRO_SECONDS).toBeGreaterThan(1.5);
  });

  it("keeps every beat of the owner's story, in order, and the beats overlap", () => {
    const order = [
      T.swoop[0],
      T.shock,
      T.dash[0],
      T.putDown[0],
      T.pull,
      T.grow[0],
      T.leave[0],
      T.leave[1],
      INTRO_SECONDS,
    ];
    for (let i = 1; i < order.length; i += 1) {
      expect(order[i] ?? 0, `beat ${i}`).toBeGreaterThan(order[i - 1] ?? 0);
    }
    // The drone is still dashing while the pair arrive, and steps back while the logo grows.
    expect(T.dash[0]).toBeLessThan(T.swoop[1]);
    expect(T.droneBack[0]).toBeLessThan(T.grow[1]);
    // The pair are already leaving as the logo reaches its size.
    expect(T.leave[0]).toBeLessThan(T.grow[1]);
  });

  it("ends right after the pair have gone", () => {
    expect(INTRO_SECONDS - T.leave[1]).toBeGreaterThanOrEqual(0.04);
    expect(INTRO_SECONDS - T.leave[1]).toBeLessThanOrEqual(0.2);
  });
});

describe("the end of the intro is the start of the hero (joint J0)", () => {
  for (const geo of SIZES) {
    it(`at ${geo.w} x ${geo.h}`, () => {
      const s = introAt(INTRO_SECONDS, geo, newIntroState());
      const route = routeAt(0, geo, newRoutePlace());
      const rest = heroRect(geo.w, geo.h);
      expect(s.drone.x).toBeCloseTo(route.x, 6);
      expect(s.drone.y).toBeCloseTo(route.y, 6);
      expect(s.drone.height).toBeCloseTo(route.height, 6);
      expect(s.dronePose).toBeNull();
      expect(s.droneFace).toBeNull();
      expect(s.lookPointer).toBe(true);
      expect(s.logoOn).toBe(true);
      expect(s.logoCarried).toBe(0);
      expect(s.logo.cx).toBeCloseTo(rest.cx, 6);
      expect(s.logo.cy).toBeCloseTo(rest.cy, 6);
      expect(s.logo.width).toBeCloseTo(rest.width, 4);
      expect(s.logoTension).toBeCloseTo(1, 6);
      expect(s.logoWave).toBe(LOGO_REST_WAVE);
      expect(s.duoOn).toBe(false);
      expect(s.ui).toBe(1);
    });
  }

  it("covers 70 percent of a wide screen's width (86 percent of a phone's)", () => {
    const wide = heroRect(1440, 900).width / 1440;
    const phone = heroRect(390, 844).width / 390;
    expect(wide).toBeCloseTo(0.7, 3);
    expect(phone).toBeCloseTo(0.86, 3);
  });
});

describe("the loader's drone stands small in the middle of the screen", () => {
  it("is 12 percent of the window's height, centred", () => {
    const out = { x: 1, y: 1, height: 0 };
    loaderPlace({ w: 1440, h: 900 }, out);
    expect(out.x).toBe(0);
    expect(out.y).toBe(0);
    expect(out.height).toBeCloseTo(LOADER_DRONE * 900, 6);
    expect(LOADER_DRONE).toBeCloseTo(0.12, 6);
  });

  it("is on the screen and never wider than a third of it, at every window shape", () => {
    const out = { x: 0, y: 0, height: 0 };
    for (const w of [320, 360, 390, 600, 900, 1024, 1280, 1440, 1706, 1920, 2560]) {
      for (const h of [400, 500, 640, 700, 844, 900, 1080, 1440]) {
        loaderPlace({ w, h }, out);
        expect(out.x, `${w}x${h}`).toBe(0);
        expect(out.y, `${w}x${h}`).toBe(0);
        expect(out.height, `${w}x${h}`).toBeGreaterThanOrEqual(48);
        expect(out.height, `${w}x${h}`).toBeLessThanOrEqual(Math.max(48, 0.12 * h + 1e-9));
        expect(1.1 * out.height, `${w}x${h}`).toBeLessThan(w / 2);
        expect(0.6 * out.height, `${w}x${h}`).toBeLessThan(h / 2);
      }
    }
  });
});

describe("the start: the pair are off screen and the drone is where the loader keeps it", () => {
  for (const geo of SIZES) {
    it(`at ${geo.w} x ${geo.h}`, () => {
      const s = introAt(0, geo, newIntroState());
      const place = loaderPlace(geo, { x: 0, y: 0, height: 0 });
      expect(s.drone.x).toBeCloseTo(place.x, 6);
      expect(s.drone.y).toBeCloseTo(place.y, 6);
      expect(s.drone.height).toBeCloseTo(place.height, 6);
      expect(s.duoOn).toBe(false);
      expect(s.logoOn).toBe(false);
      expect(s.ui).toBe(0);
    });

    it(`the pair and the logo come in from outside the screen at ${geo.w} x ${geo.h}`, () => {
      const s = introAt(0.001, geo, newIntroState());
      expect(s.duoOn).toBe(true);
      const ball = duoBall(geo);
      // The right drone, its glove and the right end of the logo are all left of the screen.
      const right = s.carry.x + s.carry.width / 2 + 2.4 * ball;
      expect(right).toBeLessThan(-geo.w / 2);
    });
  }
});

describe("the pair and the logo between them stay on the screen once they are in", () => {
  // Each ball stands a reach (at most 2.22 radii) outside its grip, and a glove or an ear goes about
  // 1.7 radii past the ball: 3.92 radii from a grip to the farthest part of a drone.
  const REACH = 3.92;
  const SHAPES: IntroGeo[] = [
    { w: 360, h: 640 },
    { w: 390, h: 844 },
    { w: 430, h: 932 },
    { w: 600, h: 900 },
    { w: 768, h: 1024 },
    { w: 820, h: 1180 },
    { w: 1024, h: 768 },
    { w: 1440, h: 900 },
    { w: 1706, h: 950 },
    { w: 1920, h: 1080 },
  ];

  for (const geo of SHAPES) {
    it(`at ${geo.w} x ${geo.h}, from the moment they stop to the moment they take the corners`, () => {
      const s = newIntroState();
      for (let t = T.swoop[1]; t < T.pull; t += 1 / 30) {
        introAt(t, geo, s);
        const half = s.carry.width / 2 + (REACH * duoBall(geo)) / 2;
        expect(Math.abs(s.carry.x) + half, `t ${t.toFixed(2)}`).toBeLessThanOrEqual(
          geo.w / 2 + 1e-6,
        );
      }
    });
  }

  it("keeps the balls big enough to read on the smallest phone", () => {
    expect(duoBall({ w: 360, h: 640 })).toBeGreaterThan(40);
  });
});

describe("the beats come in the owner's order", () => {
  const geo = SIZES[0]!;
  const at = (t: number) => introAt(t, geo, newIntroState());

  it("the pair carry, then pull, then leave", () => {
    expect(at(0.3).duoMode).toBe("carry");
    expect(at(T.pull + 0.1).duoMode).toBe("pull");
    expect(at(T.leave[0] + 0.05).duoMode).toBe("leave");
    expect(at(T.leave[1]).poseW).toBe(1);
  });

  it("the logo swoops in from the left and stops in the middle", () => {
    const early = at(0.05);
    const there = at(T.swoop[1]);
    expect(early.carry.x).toBeLessThan(-geo.w / 2);
    expect(there.carry.x).toBeCloseTo(0, 6);
  });

  it("the drone sees them first (one shock mark), then dashes under the logo, then goes back to its place", () => {
    const shocks = CUES.filter((c) => c.kind === "shock");
    expect(shocks).toHaveLength(1);
    expect(shocks[0]?.at).toBeLessThan(T.dash[0] + 0.1);
    const near = at(T.dash[1] + 0.05);
    const logoBottom = near.carry.y - carriedWidth(geo) / 4.013 / 2;
    // Under the logo, close to its middle, its head touching it.
    expect(Math.abs(near.drone.x - near.carry.x)).toBeLessThan(0.1 * geo.w);
    expect(near.drone.y).toBeLessThan(logoBottom + 0.2 * near.drone.height);
    expect(near.drone.y).toBeGreaterThan(logoBottom - near.drone.height);
    const corner = at(T.droneBack[1] + 0.1);
    const route = routeAt(0, geo, newRoutePlace());
    expect(corner.drone.x).toBeCloseTo(route.x, 3);
    expect(corner.lookPointer).toBe(true);
  });

  it("the logo grows from a third of the screen to the hero width while they pull, with no overshoot", () => {
    const before = at(T.grow[0] - 0.01).logo.width;
    const rest = heroRect(geo.w, geo.h).width;
    expect(before).toBeCloseTo(carriedWidth(geo), 3);
    expect(before / geo.w).toBeLessThan(0.35);
    let last = before;
    for (let t = T.grow[0]; t <= INTRO_SECONDS + 1e-9; t += DT) {
      const width = at(t).logo.width;
      expect(width).toBeGreaterThanOrEqual(last - 1e-9);
      expect(width).toBeLessThanOrEqual(rest + 1e-6);
      last = width;
    }
    expect(last).toBeCloseTo(rest, 3);
  });

  it("the pull keeps the hands on the two corners of the logo", () => {
    const s = at(T.grow[1] - 0.2);
    const box = pullRectFor(0, heroRect(geo.w, geo.h).cy, s.logo.width, {
      cx: 0,
      cy: 0,
      w: 0,
      h: 0,
    });
    expect(s.pull.cx).toBeCloseTo(box.cx, 6);
    expect(s.pull.w).toBeCloseTo(box.w, 6);
    expect(s.pull.h).toBeGreaterThan(0);
    // The two sockets are about 95 percent of the logo's width apart.
    expect(GRIP_SPAN).toBeGreaterThan(0.9);
    expect(GRIP_SPAN).toBeLessThan(1);
  });
});

describe("the logo is stiff", () => {
  for (const geo of SIZES) {
    it(`taut, no wobble, no wave and no struggle for the whole intro at ${geo.w} x ${geo.h}`, () => {
      const s = newIntroState();
      for (let t = 0; t <= INTRO_SECONDS + 1e-9; t += DT) {
        introAt(t, geo, s);
        expect(s.logoTension).toBe(1);
        expect(s.logoWobble).toBe(0);
        expect(s.logoWave).toBe(0);
        expect(s.carry.struggle).toBe(0);
      }
    });
  }

  it("is held level: the hands do not rise and fall against each other", () => {
    const s = introAt(0.3, SIZES[0]!, newIntroState());
    expect(s.carry.lift).toBeGreaterThanOrEqual(0);
    expect(s.carry.lift).toBeLessThanOrEqual(0.3 + 1e-9);
    expect(s.carry.tension).toBeGreaterThan(0.5);
  });

  it("stands by itself before the pair take its corners", () => {
    const geo = SIZES[0]!;
    const s = introAt(T.putDown[1] + 0.01, geo, newIntroState());
    expect(s.logoCarried).toBeCloseTo(0, 6);
    expect(s.duoMode).toBe("pull");
    expect(s.logo.cx).toBe(0);
  });
});

describe("the intro has no jump", () => {
  for (const geo of SIZES) {
    it(`every actor moves smoothly at ${geo.w} x ${geo.h}`, () => {
      const a = newIntroState();
      const b = newIntroState();
      const diag = Math.hypot(geo.w, geo.h);
      introAt(0, geo, a);
      for (let t = DT; t <= INTRO_SECONDS + 1e-9; t += DT) {
        introAt(t, geo, b);
        // The swoop is fast on purpose: up to a fifth of the diagonal in a frame is still no jump.
        expect(Math.hypot(b.drone.x - a.drone.x, b.drone.y - a.drone.y)).toBeLessThan(0.05 * diag);
        expect(Math.abs(b.drone.height - a.drone.height)).toBeLessThan(0.01 * geo.h);
        expect(Math.abs(b.logo.width - a.logo.width)).toBeLessThan(0.05 * geo.w);
        expect(Math.abs(b.carry.x - a.carry.x)).toBeLessThan(0.1 * geo.w);
        expect(Math.abs(b.carry.lift - a.carry.lift)).toBeLessThan(0.1);
        expect(Math.abs(b.logoCarried - a.logoCarried)).toBeLessThan(0.2);
        expect(Math.abs(b.poseW - a.poseW)).toBeLessThan(0.2);
        a.drone.x = b.drone.x;
        a.drone.y = b.drone.y;
        a.drone.height = b.drone.height;
        a.logo.width = b.logo.width;
        a.carry.x = b.carry.x;
        a.carry.lift = b.carry.lift;
        a.logoCarried = b.logoCarried;
        a.poseW = b.poseW;
      }
    });
  }
});

describe("the same time gives the same state", () => {
  it("is pure", () => {
    const geo = SIZES[1]!;
    for (const t of [0, 0.3, 0.7, 1.1, 1.6, 1.9]) {
      const x = introAt(t, geo, newIntroState());
      const y = introAt(0.5, geo, newIntroState());
      void y;
      const z = introAt(t, geo, newIntroState());
      expect(z).toEqual(x);
    }
  });

  it("reuses the object it is given", () => {
    const geo = SIZES[0]!;
    const out = newIntroState();
    expect(introAt(1, geo, out)).toBe(out);
  });
});

describe("the cues", () => {
  it("are in time order and inside the intro", () => {
    let last = -1;
    for (const c of CUES) {
      expect(c.at).toBeGreaterThanOrEqual(last);
      expect(c.at).toBeGreaterThan(0);
      expect(c.at).toBeLessThanOrEqual(INTRO_SECONDS);
      last = c.at;
    }
  });

  it("fire once each over a run in small steps", () => {
    let n = 0;
    for (let t = 0; t < INTRO_SECONDS + 0.1; t += DT) cuesBetween(t, t + DT, () => (n += 1));
    expect(n).toBe(CUES.length);
  });

  it("fire in a burst when a long step crosses several", () => {
    let n = 0;
    cuesBetween(0, INTRO_SECONDS, () => (n += 1));
    expect(n).toBe(CUES.length);
  });

  it("make no comic mark but the drone's shock: no sweat, hearts, bangs, stars or bubbles", () => {
    const kinds = new Set(CUES.map((c) => c.kind));
    expect([...kinds].sort()).toEqual(["blip", "shock"]);
  });
});

describe("the logo between two hands", () => {
  it("is where the shared helper says, without allocating", async () => {
    const { rectFromGrabs, SOCKETS } = await import("../fx/logo/math");
    const out = { cx: 0, cy: 0, width: 0, roll: 0 };
    for (const [pa, pb] of [
      [
        { x: -300, y: 20 },
        { x: 250, y: 60 },
      ],
      [
        { x: -120, y: -40 },
        { x: 200, y: -10 },
      ],
    ] as const) {
      const want = rectFromGrabs(SOCKETS.left, SOCKETS.right, pa, pb);
      expect(carriedRect(pa, pb, out)).toBe(out);
      expect(out.cx).toBeCloseTo(want.rect.cx, 9);
      expect(out.cy).toBeCloseTo(want.rect.cy, 9);
      expect(out.width).toBeCloseTo(want.rect.width, 9);
      expect(out.roll).toBeCloseTo(want.roll, 9);
    }
  });

  it("holds two level hands the grip span apart at the width of the art", () => {
    const out = { cx: 0, cy: 0, width: 0, roll: 0 };
    const span = 500;
    carriedRect({ x: -span / 2, y: 0 }, { x: span / 2, y: 0 }, out);
    expect(out.roll).toBeCloseTo(0, 9);
    expect(out.width).toBeCloseTo(span / GRIP_SPAN, 6);
  });
});

describe("the pair stay on the screen when they begin to leave", () => {
  for (const geo of SIZES) {
    it(`at ${geo.w} x ${geo.h}`, () => {
      const s = introAt(T.leave[0], geo, newIntroState());
      for (const d of [s.duoA, s.duoB]) {
        expect(Math.abs(d.x) + d.height / 2).toBeLessThan(geo.w / 2);
        expect(Math.abs(d.y) + d.height / 2).toBeLessThan(geo.h / 2);
      }
      // A is below the logo, B above it, and neither covers the logo.
      const rest = heroRect(geo.w, geo.h);
      const half = rest.width / 4.013 / 2;
      expect(s.duoA.y + s.duoA.height / 2).toBeLessThan(rest.cy - half);
      expect(s.duoB.y - s.duoB.height / 2).toBeGreaterThan(rest.cy + half);
    });
  }
});
