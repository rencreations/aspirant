import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PointerHub, TAP_MS, TAP_PX, isDomControl, isTap, nearestHit } from "./pointer";
import type { CursorApi, HitTarget } from "./types";

function target(id: string, depth: number | null, extra: Partial<HitTarget> = {}): HitTarget {
  return { id, test: () => depth, ...extra };
}

function fire(el: EventTarget, type: string, x: number, y: number, pointerType = "mouse") {
  const event = new MouseEvent(type, { clientX: x, clientY: y, bubbles: true });
  Object.defineProperty(event, "pointerType", { value: pointerType });
  el.dispatchEvent(event);
}

describe("nearestHit", () => {
  it("picks the smallest depth and ignores misses", () => {
    const hit = nearestHit([target("far", 5), target("miss", null), target("near", 1)], 0, 0);
    expect(hit?.target.id).toBe("near");
    expect(hit?.depth).toBe(1);
  });

  it("is null when nothing is under the point", () => {
    expect(nearestHit([target("a", null)], 0, 0)).toBeNull();
    expect(nearestHit([], 0, 0)).toBeNull();
  });

  it("keeps the first of two equal depths", () => {
    expect(nearestHit([target("first", 2), target("second", 2)], 0, 0)?.target.id).toBe("first");
  });
});

describe("isDomControl", () => {
  it("is true for a link, a button, a field and a marked element, also from inside them", () => {
    document.body.innerHTML = `<a href="/x"><span id="in-link"></span></a><button id="b"></button>
      <input id="i"><div data-home-hit="dom"><i id="in-marked"></i></div><p id="plain"></p>`;
    for (const id of ["in-link", "b", "i", "in-marked"]) {
      expect(isDomControl(document.getElementById(id)), id).toBe(true);
    }
    expect(isDomControl(document.getElementById("plain"))).toBe(false);
    expect(isDomControl(window)).toBe(false);
    expect(isDomControl(null)).toBe(false);
  });
});

describe("PointerHub", () => {
  let labels: Array<string | null>;
  let cursor: CursorApi;
  let hub: PointerHub;

  beforeEach(() => {
    labels = [];
    cursor = {
      set: (l) => {
        labels.push(l);
      },
    };
    hub = new PointerHub(cursor);
    hub.attach();
  });

  afterEach(() => {
    hub.detach();
    document.body.innerHTML = "";
  });

  it("finds the nearest target under the pointer and asks the cursor for its label", () => {
    hub.add(target("drone", 3, { cursor: "HELLO" }));
    hub.add(target("doll", 1, { cursor: "POKE" }));
    fire(window, "pointermove", 400, 300);
    hub.resolve(0.016);
    expect(hub.state.hit).toBe("doll");
    expect(labels).toEqual(["POKE"]);
  });

  it("calls enter and leave as the pointer moves between targets", () => {
    let over: "a" | "b" | null = "a";
    const aEnter = vi.fn();
    const aLeave = vi.fn();
    const bEnter = vi.fn();
    const a = target("a", 1, { enter: aEnter, leave: aLeave });
    const b = target("b", 1, { enter: bEnter });
    a.test = () => (over === "a" ? 1 : null);
    b.test = () => (over === "b" ? 1 : null);
    hub.add(a);
    hub.add(b);
    fire(window, "pointermove", 10, 10);
    hub.resolve(0.016);
    over = "b";
    hub.resolve(0.016);
    over = null;
    hub.resolve(0.016);
    expect(aEnter).toHaveBeenCalledTimes(1);
    expect(aLeave).toHaveBeenCalledTimes(1);
    expect(bEnter).toHaveBeenCalledTimes(1);
    expect(hub.state.hit).toBeNull();
  });

  it("lets a DOM control under the pointer win: no 3D target is asked", () => {
    document.body.innerHTML = `<button id="b">Go</button>`;
    const test = vi.fn(() => 1);
    hub.add({ id: "actor", test, cursor: "VIEW" });
    fire(document.getElementById("b")!, "pointermove", 10, 10);
    hub.resolve(0.016);
    expect(test).not.toHaveBeenCalled();
    expect(hub.state.hit).toBeNull();
  });

  it("presses and releases the target under the pointer", () => {
    const press = vi.fn();
    const release = vi.fn();
    hub.add(target("doll", 1, { press, release }));
    fire(window, "pointerdown", 50, 60);
    fire(window, "pointerup", 52, 61);
    expect(press).toHaveBeenCalledWith(50, 60);
    expect(release).toHaveBeenCalledWith(52, 61);
    expect(hub.state.down).toBe(false);
  });

  it("does not press a 3D target through a DOM control", () => {
    document.body.innerHTML = `<a href="/x" id="l">x</a>`;
    const press = vi.fn();
    hub.add(target("doll", 1, { press }));
    fire(document.getElementById("l")!, "pointerdown", 5, 5);
    expect(press).not.toHaveBeenCalled();
  });

  it("gives a touch no hover: the target is found at the press and let go at the release", () => {
    const enter = vi.fn();
    const leave = vi.fn();
    hub.add(target("doll", 1, { enter, leave }));
    fire(window, "pointermove", 5, 5, "touch");
    hub.resolve(0.016);
    expect(enter).not.toHaveBeenCalled();
    fire(window, "pointerdown", 5, 5, "touch");
    expect(enter).toHaveBeenCalledTimes(1);
    fire(window, "pointerup", 5, 5, "touch");
    expect(leave).toHaveBeenCalledTimes(1);
    expect(hub.state.hit).toBeNull();
  });

  it("presses a mouse target at pointer-down (a drag begins there)", () => {
    const press = vi.fn();
    hub.add(target("tail", 1, { press }));
    fire(window, "pointerdown", 50, 60);
    expect(press).toHaveBeenCalledTimes(1);
  });

  it("presses a touch target when the finger lifts as a tap, not at the press", () => {
    const press = vi.fn();
    const release = vi.fn();
    hub.add(target("doll", 1, { press, release }));
    fire(window, "pointerdown", 50, 60, "touch");
    expect(press).not.toHaveBeenCalled();
    fire(window, "pointerup", 52, 61, "touch");
    expect(press).toHaveBeenCalledTimes(1);
    expect(press).toHaveBeenCalledWith(52, 61);
    expect(release).toHaveBeenCalledTimes(1);
  });

  it("never presses a touch target for a swipe (a scroll that begins on an actor)", () => {
    const press = vi.fn();
    const release = vi.fn();
    hub.add(target("doll", 1, { press, release }));
    fire(window, "pointerdown", 50, 60, "touch");
    fire(window, "pointermove", 50, 140, "touch");
    fire(window, "pointerup", 50, 62, "touch");
    expect(press).not.toHaveBeenCalled();
    expect(release).not.toHaveBeenCalled();
  });

  it("never presses a touch target when the browser takes the gesture (pointercancel)", () => {
    const press = vi.fn();
    hub.add(target("doll", 1, { press }));
    fire(window, "pointerdown", 50, 60, "touch");
    fire(window, "pointercancel", 50, 60, "touch");
    expect(press).not.toHaveBeenCalled();
  });

  it("does not press a touch target twice for two taps' worth of events", () => {
    const press = vi.fn();
    hub.add(target("doll", 1, { press }));
    fire(window, "pointerdown", 50, 60, "touch");
    fire(window, "pointerup", 50, 60, "touch");
    fire(window, "pointerup", 50, 60, "touch");
    expect(press).toHaveBeenCalledTimes(1);
  });

  it("lets a target go when it is taken out", () => {
    const leave = vi.fn();
    const remove = hub.add(target("doll", 1, { leave, cursor: "POKE" }));
    fire(window, "pointermove", 5, 5);
    hub.resolve(0.016);
    remove();
    expect(leave).toHaveBeenCalledTimes(1);
    expect(labels).toEqual(["POKE", null]);
  });

  it("measures the pointer in pixels and in the -1 to 1 range", () => {
    fire(window, "pointermove", window.innerWidth / 2, window.innerHeight);
    expect(hub.state.nx).toBeCloseTo(0);
    expect(hub.state.ny).toBeCloseTo(1);
    expect(hub.state.inside).toBe(true);
  });

  it("stops listening when detached", () => {
    hub.detach();
    fire(window, "pointermove", 123, 45);
    expect(hub.state.x).not.toBe(123);
  });
});

describe("isTap", () => {
  it("is a finger that lifts where it went down, soon", () => {
    expect(isTap(0, 0, 90)).toBe(true);
    expect(isTap(3, -4, TAP_MS)).toBe(true);
  });

  it("is not a drag", () => {
    expect(isTap(0, TAP_PX + 1, 100)).toBe(false);
    expect(isTap(40, 0, 100)).toBe(false);
  });

  it("is not a long press", () => {
    expect(isTap(0, 0, TAP_MS + 1)).toBe(false);
    expect(isTap(0, 0, -1)).toBe(false);
  });

  it("counts the distance, not each axis", () => {
    // 9 and 9 is about 12.7 pixels away: past the limit.
    expect(isTap(9, 9, 100)).toBe(false);
    expect(isTap(8, 8, 100)).toBe(true);
  });
});
