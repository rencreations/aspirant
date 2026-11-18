import { describe, expect, it } from "vitest";

import { newRoutePlace, routeAt } from "../drone-route";
import { heroRect } from "../fx/logo/math";
import {
  CUES,
  DROP_AT,
  CARRY_ARRIVE,
  GRIP_SPAN,
  INTRO_SECONDS,
  LOGO_REST_WAVE,
  SETTLE_SECONDS,
  T,
  carriedWidth,
  cuesBetween,
  duoBall,
  introAt,
  loaderPlace,
  markTop,
  newIntroState,
  pullRectFor,
  type IntroCue,
  type IntroGeo,
} from "./timeline";

const SIZES: IntroGeo[] = [
  { w: 1440, h: 900 },
  { w: 1706, h: 950 },
  { w: 390, h: 844 },
];

const DT = 1 / 60;

describe("the intro's length", () => {
  it("is between 7 and 8.5 seconds (the owner found the first one, 13.2 s, too long)", () => {
    expect(INTRO_SECONDS).toBeGreaterThanOrEqual(7);
    expect(INTRO_SECONDS).toBeLessThanOrEqual(8.5);
  });

  it("keeps every beat of the owner's story, in order", () => {
    const order = [
      T.enter,
      T.shock,
      DROP_AT,
      T.helpFly[0],
      T.help[0],
      T.toMiddle[0],
      T.putDown[0],
      T.helpBack[0],
      T.grow[0],
      T.thanks,
      T.leave[0],
      T.leave[1],
      INTRO_SECONDS,
    ];
    for (let i = 1; i < order.length; i += 1) {
      expect(order[i] ?? 0, `beat ${i}`).toBeGreaterThan(order[i - 1] ?? 0);
    }
  });

  it("lets no struggle, drop or lift last more than 3 seconds", () => {
    expect(T.helpFly[0] - T.enter).toBeLessThan(3);
    expect(T.toMiddle[1] - T.helpFly[0]).toBeLessThan(3);
  });

  it("keeps a calm moment at the end, after the pair have gone", () => {
    expect(INTRO_SECONDS - T.leave[1]).toBeGreaterThanOrEqual(SETTLE_SECONDS - 1e-9);
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
      expect(s.logoWave).toBeCloseTo(LOGO_REST_WAVE, 6);
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

describe("the loader's drone stands clear of the loading screen's mark", () => {
  it("knows where the mark is (measured: 47.5 px above the middle at 1440 wide, 36.8 at 390)", () => {
    expect(markTop(1440)).toBeCloseTo(47.5, 0);
    expect(markTop(390)).toBeCloseTo(36.8, 0);
  });

  it("keeps a clear gap above it and its top on the screen, at every window shape", () => {
    const out = { x: 0, y: 0, height: 0 };
    for (const w of [360, 390, 600, 900, 1024, 1280, 1440, 1706, 1920, 2560]) {
      for (const h of [500, 640, 700, 844, 900, 1080, 1440]) {
        loaderPlace({ w, h }, out);
        const chin = out.y - 0.53 * out.height;
        const crown = out.y + 0.53 * out.height;
        expect(chin, `${w}x${h}`).toBeGreaterThanOrEqual(markTop(w) + 14);
        expect(crown, `${w}x${h}`).toBeLessThanOrEqual(h / 2);
        expect(out.height, `${w}x${h}`).toBeGreaterThan(55);
        expect(out.height, `${w}x${h}`).toBeLessThanOrEqual(0.26 * h + 1e-9);
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
      expect(s.ui).toBe(0);
    });

    it(`the pair and the logo come in from outside the screen at ${geo.w} x ${geo.h}`, () => {
      const t = T.enter - 0.2;
      const s = introAt(t, geo, newIntroState());
      expect(s.duoOn).toBe(true);
      const ball = duoBall(geo);
      // The right drone, its glove and the right end of the logo are all left of the screen.
      const right = s.carry.x + s.carry.width / 2 + 2.4 * ball;
      expect(right).toBeLessThan(-geo.w / 2);
    });
  }
});

describe("the pair and the logo between them stay on the screen while they carry", () => {
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
    it(`at ${geo.w} x ${geo.h}, from the moment they are in to the moment they take the corners`, () => {
      const s = newIntroState();
      for (let t = T.enter + CARRY_ARRIVE; t < T.pull; t += 1 / 30) {
        introAt(t, geo, s);
        const half = s.carry.width / 2 + (REACH * duoBall(geo)) / 2;
        expect(Math.abs(s.carry.x) + half, `t ${t.toFixed(2)}`).toBeLessThanOrEqual(geo.w / 2);
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

  it("the pair carry, then pull, then bow, then leave", () => {
    expect(at(T.enter + 1).duoMode).toBe("carry");
    expect(at(T.pull + 0.5).duoMode).toBe("pull");
    expect(at((T.bow[0] + T.leave[0]) / 2).duoMode).toBe("bow");
    expect(at(T.leave[0] + 0.1).duoMode).toBe("leave");
    expect(at(T.leave[1]).poseW).toBe(1);
  });

  it("they struggle: it hangs loose and the strain is high until the drone helps", () => {
    const early = at(T.enter + 0.3);
    const heavy = at(DROP_AT - 0.3);
    expect(early.carry.tension).toBeLessThan(0.6);
    expect(heavy.carry.struggle).toBeGreaterThan(0.8);
    const helped = at(T.help[1] + 0.2);
    expect(helped.carry.struggle).toBeLessThan(0.3);
    expect(helped.help).toBeGreaterThan(0.99);
  });

  it("they drop the logo once, and the lift falls", () => {
    const before = at(DROP_AT - 0.3).carry.lift;
    const after = at(DROP_AT + 0.2).carry.lift;
    expect(after).toBeLessThan(before - 0.5);
    expect(CUES.filter((c) => c.kind === "dropBang")).toHaveLength(1);
  });

  it("the drone sees them first (shock), then goes under the logo, then back to its corner", () => {
    const shock = CUES.find((c) => c.kind === "shock");
    expect(shock?.at).toBeLessThan(T.helpFly[0]);
    const near = at(T.helpFly[1] + 0.3);
    const logoBottom = near.carry.y - carriedWidth(geo) / 4.013 / 2;
    // Under the middle of the logo, its head touching it.
    expect(near.drone.x).toBeCloseTo(near.carry.x, 3);
    expect(near.drone.y).toBeLessThan(logoBottom + 0.2 * near.drone.height);
    expect(near.drone.y).toBeGreaterThan(logoBottom - near.drone.height);
    const corner = at(T.helpBack[1] + 0.1);
    const route = routeAt(0, geo, newRoutePlace());
    expect(corner.drone.x).toBeCloseTo(route.x, 3);
    expect(corner.dronePose).toBe("peek");
  });

  it("the logo grows from a third of the screen to the hero width while they pull", () => {
    const before = at(T.grow[0] - 0.01).logo.width;
    const after = at(T.grow[1] + 0.8).logo.width;
    const rest = heroRect(geo.w, geo.h).width;
    expect(before).toBeCloseTo(carriedWidth(geo), 3);
    expect(before / geo.w).toBeLessThan(0.35);
    expect(after).toBeCloseTo(rest, 3);
  });

  it("the thanks have icons only and come after the logo has grown", () => {
    const icons = CUES.filter(
      (c): c is Extract<IntroCue, { kind: "bubble" }> => c.kind === "bubble",
    );
    expect(icons.map((c) => c.icon)).toEqual(["heart", "sparkle", "smile"]);
    for (const c of icons) expect(c.at).toBeGreaterThan(T.grow[1]);
    expect(at(T.thanks + 0.3).dronePose).toBe("thanks");
  });

  it("the pull keeps the hands on the two corners of the logo", () => {
    const s = at(T.grow[1] - 0.5);
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

describe("the intro has no jump", () => {
  for (const geo of SIZES) {
    it(`every actor moves smoothly at ${geo.w} x ${geo.h}`, () => {
      const a = newIntroState();
      const b = newIntroState();
      const diag = Math.hypot(geo.w, geo.h);
      introAt(0, geo, a);
      for (let t = DT; t <= INTRO_SECONDS + 1e-9; t += DT) {
        introAt(t, geo, b);
        expect(Math.hypot(b.drone.x - a.drone.x, b.drone.y - a.drone.y)).toBeLessThan(0.02 * diag);
        expect(Math.abs(b.drone.height - a.drone.height)).toBeLessThan(0.01 * geo.h);
        expect(Math.abs(b.logo.width - a.logo.width)).toBeLessThan(0.025 * geo.w);
        expect(Math.abs(b.carry.x - a.carry.x)).toBeLessThan(0.03 * geo.w);
        expect(Math.abs(b.logoTension - a.logoTension)).toBeLessThan(0.1);
        expect(Math.abs(b.carry.lift - a.carry.lift)).toBeLessThan(0.3);
        expect(Math.abs(b.logoCarried - a.logoCarried)).toBeLessThan(0.1);
        expect(Math.abs(b.poseW - a.poseW)).toBeLessThan(0.1);
        a.drone.x = b.drone.x;
        a.drone.y = b.drone.y;
        a.drone.height = b.drone.height;
        a.logo.width = b.logo.width;
        a.carry.x = b.carry.x;
        a.logoTension = b.logoTension;
        a.carry.lift = b.carry.lift;
        a.logoCarried = b.logoCarried;
        a.poseW = b.poseW;
      }
    });
  }

  it("the logo stands by itself before the pair take its corners", () => {
    const geo = SIZES[0]!;
    const s = introAt(T.putDown[1] + 0.01, geo, newIntroState());
    expect(s.logoCarried).toBeCloseTo(0, 6);
    expect(s.duoMode).toBe("carry");
    // The carry has reached the middle by then, so the placed logo is where it was carried.
    expect(Math.abs(s.carry.x)).toBeLessThan(0.005 * geo.w);
    expect(s.logo.cx).toBe(0);
  });
});

describe("the same time gives the same state", () => {
  it("is pure", () => {
    const geo = SIZES[1]!;
    for (const t of [0, 1.3, 3.4, 5.5, 6.1, 7.1, 7.7]) {
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
    expect(introAt(2, geo, out)).toBe(out);
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
    const fired: IntroCue[] = [];
    for (let t = 0; t < INTRO_SECONDS + 0.1; t += DT) cuesBetween(t, t + DT, (c) => fired.push(c));
    expect(fired).toHaveLength(CUES.length);
  });

  it("fire in a burst when a long step crosses several", () => {
    let n = 0;
    cuesBetween(0, INTRO_SECONDS, () => (n += 1));
    expect(n).toBe(CUES.length);
  });

  it("the bubbles do not crowd each other (0.49 s apart at least)", () => {
    const icons = CUES.filter((c) => c.kind === "bubble").map((c) => c.at);
    for (let i = 1; i < icons.length; i += 1) {
      expect((icons[i] ?? 0) - (icons[i - 1] ?? 0)).toBeGreaterThanOrEqual(0.49);
    }
  });
});

describe("the logo between two hands", () => {
  it("is where the shared helper says, without allocating", async () => {
    const { rectFromGrabs, SOCKETS } = await import("../fx/logo/math");
    const { carriedRect } = await import("./timeline");
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

  it("holds two level hands the grip span apart at the width of the art", async () => {
    const { carriedRect, GRIP_SPAN } = await import("./timeline");
    const out = { cx: 0, cy: 0, width: 0, roll: 0 };
    const span = 500;
    carriedRect({ x: -span / 2, y: 0 }, { x: span / 2, y: 0 }, out);
    expect(out.roll).toBeCloseTo(0, 9);
    expect(out.width).toBeCloseTo(span / GRIP_SPAN, 6);
  });
});

describe("the pair stay on the screen while they are thanked", () => {
  for (const geo of SIZES) {
    it(`at ${geo.w} x ${geo.h}`, () => {
      const s = introAt((T.bow[1] + T.leave[0]) / 2, geo, newIntroState());
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

  it("the logo hangs loose while they strain and is taut again once it stands", () => {
    const geo = SIZES[0]!;
    const heavy = introAt(DROP_AT + 0.3, geo, newIntroState());
    expect(heavy.logoTension).toBeLessThan(0.5);
    const set = introAt(T.putDown[1] + 0.6, geo, newIntroState());
    expect(set.logoTension).toBeCloseTo(1, 2);
  });
});
