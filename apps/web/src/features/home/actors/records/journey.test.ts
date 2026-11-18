import {
  SEG_A_SECONDS,
  SEG_B_SECONDS,
  arcPoint,
  carryLegs,
  ease,
  journeyPhase,
  phasesAt,
  stepJourney,
  type CarryLegs,
  type Phases,
} from "./journey";

const DT = 1 / 60;

function run(p: number, target: number, seconds: number): number {
  let at = p;
  for (let t = 0; t < seconds; t += DT) at = stepJourney(at, target, DT);
  return at;
}

describe("stepJourney", () => {
  it("takes the pick in about its own time and stops exactly", () => {
    expect(run(0, 1, SEG_A_SECONDS - 0.1)).toBeLessThan(1);
    expect(run(0, 1, SEG_A_SECONDS + 0.1)).toBe(1);
  });

  it("takes the putting on in its own time", () => {
    expect(run(1, 2, SEG_B_SECONDS - 0.1)).toBeLessThan(2);
    expect(run(1, 2, SEG_B_SECONDS + 0.1)).toBe(2);
  });

  it("plays the whole way to a far target, crossing the joint at the right pace", () => {
    const half = run(0, 2, SEG_A_SECONDS);
    expect(half).toBeGreaterThan(0.98);
    expect(half).toBeLessThan(1.1);
    expect(run(0, 2, SEG_A_SECONDS + SEG_B_SECONDS + 0.2)).toBe(2);
  });

  it("turns back along the same way", () => {
    const mid = run(0, 1, 0.8);
    const back = run(mid, 0, 0.8);
    expect(back).toBeCloseTo(0, 1);
    expect(run(2, 0, SEG_A_SECONDS + SEG_B_SECONDS + 0.2)).toBe(0);
  });

  it("does nothing for no time or when it is there", () => {
    expect(stepJourney(0.4, 1, 0)).toBe(0.4);
    expect(stepJourney(1, 1, 1)).toBe(1);
    expect(stepJourney(0.4, 1, -1)).toBe(0.4);
  });

  it("survives a very long frame", () => {
    expect(stepJourney(0, 2, 60)).toBe(2);
    expect(stepJourney(2, 0, 60)).toBe(0);
  });
});

describe("phases", () => {
  const out: Phases = { lift: 0, slide: 0, fly: 0, drop: 0, carry: 0 };

  it("starts at rest and ends delivered", () => {
    phasesAt(0, out);
    expect(out).toEqual({ lift: 0, slide: 0, fly: 0, drop: 0, carry: 0 });
    phasesAt(1, out);
    expect(out).toEqual({ lift: 1, slide: 1, fly: 1, drop: 1, carry: 0 });
    phasesAt(2, out);
    expect(out.carry).toBe(1);
    expect(out.fly).toBe(1);
  });

  it("runs the sub steps in order: out of the crate, out of the sleeve, flight, sleeve back", () => {
    phasesAt(0.3, out);
    expect(out.lift).toBe(1);
    expect(out.slide).toBe(0);
    phasesAt(0.55, out);
    expect(out.slide).toBe(1);
    expect(out.fly).toBe(0);
    phasesAt(0.62, out);
    expect(out.drop).toBe(0);
    expect(out.fly).toBeGreaterThan(0);
  });

  it("only rises along the journey", () => {
    const last: Phases = { lift: 0, slide: 0, fly: 0, drop: 0, carry: 0 };
    for (let p = 0; p <= 2; p += 0.01) {
      phasesAt(p, out);
      for (const key of Object.keys(out) as Array<keyof Phases>) {
        expect(out[key]).toBeGreaterThanOrEqual(last[key] - 1e-12);
        last[key] = out[key];
      }
    }
  });
});

describe("journeyPhase", () => {
  it("names what the record is doing", () => {
    expect(journeyPhase(0, 0)).toBe("idle");
    expect(journeyPhase(0.4, 1)).toBe("picking");
    expect(journeyPhase(1, 1)).toBe("held");
    expect(journeyPhase(1.4, 2)).toBe("placing");
    expect(journeyPhase(2, 2)).toBe("seated");
    expect(journeyPhase(1.4, 0)).toBe("returning");
    expect(journeyPhase(0.4, 0)).toBe("returning");
    expect(journeyPhase(0.4, 2)).toBe("picking");
  });
});

describe("ease and arc", () => {
  it("eases between 0 and 1 and clamps", () => {
    expect(ease(-1)).toBe(0);
    expect(ease(0.5)).toBe(0.5);
    expect(ease(3)).toBe(1);
  });

  it("rises over the line at the middle and meets both ends", () => {
    const o = { x: 0, y: 0, z: 0 };
    const a = { x: 0, y: 0, z: 0 };
    const b = { x: 10, y: 4, z: -2 };
    expect(arcPoint(o, a, b, 0, 3)).toEqual({ x: 0, y: 0, z: 0 });
    expect(arcPoint(o, a, b, 1, 3)).toEqual({ x: 10, y: 4, z: -2 });
    arcPoint(o, a, b, 0.5, 3);
    expect(o.x).toBeCloseTo(5, 9);
    expect(o.y).toBeCloseTo(2 + 3, 9);
    expect(o.z).toBeCloseTo(-1, 9);
  });
});

describe("carryLegs", () => {
  const out: CarryLegs = { approach: 0, glide: 0, turn: 0 };

  it("starts with the approach, then glides in, and ends at both 1", () => {
    carryLegs(0, out);
    expect(out).toEqual({ approach: 0, glide: 0, turn: 0 });
    carryLegs(0.55, out);
    expect(out.approach).toBe(1);
    expect(out.glide).toBe(0);
    carryLegs(1, out);
    expect(out).toEqual({ approach: 1, glide: 1, turn: 1 });
  });

  it("lies flat before it starts to glide", () => {
    carryLegs(0.55, out);
    expect(out.turn).toBe(1);
  });

  it("only rises", () => {
    let last = { approach: 0, glide: 0, turn: 0 };
    for (let c = 0; c <= 1; c += 0.01) {
      carryLegs(c, out);
      expect(out.approach).toBeGreaterThanOrEqual(last.approach - 1e-12);
      expect(out.glide).toBeGreaterThanOrEqual(last.glide - 1e-12);
      expect(out.turn).toBeGreaterThanOrEqual(last.turn - 1e-12);
      last = { ...out };
    }
  });
});
