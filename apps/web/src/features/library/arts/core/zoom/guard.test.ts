import { afterEach, describe, expect, it, vi } from "vitest";

import { installGuard } from "./guard";

let release: (() => void) | null = null;

afterEach(() => {
  release?.();
  release = null;
  document.body.innerHTML = "";
});

function setup(scroller: HTMLElement | null = null) {
  const onEscape = vi.fn();
  const onStep = vi.fn();
  release = installGuard({ scroller: () => scroller, onEscape, onStep });
  return { onEscape, onStep };
}

function fire(target: EventTarget, event: Event): Event {
  target.dispatchEvent(event);
  return event;
}

describe("the guard", () => {
  it("stops the wheel before the page sees it, and cancels it", () => {
    setup();
    const page = vi.fn();
    document.addEventListener("wheel", page);
    const wheel = fire(document.body, new WheelEvent("wheel", { cancelable: true, bubbles: true }));
    expect(wheel.defaultPrevented).toBe(true);
    expect(page).not.toHaveBeenCalled();
    document.removeEventListener("wheel", page);
  });

  it("lets the wheel scroll the strip, and still hides it from the page", () => {
    const strip = document.createElement("div");
    document.body.append(strip);
    Object.defineProperty(strip, "scrollHeight", { value: 5000 });
    Object.defineProperty(strip, "clientHeight", { value: 900 });
    setup(strip);
    const page = vi.fn();
    document.addEventListener("wheel", page);
    const wheel = fire(strip, new WheelEvent("wheel", { cancelable: true, bubbles: true }));
    expect(wheel.defaultPrevented).toBe(false);
    expect(page).not.toHaveBeenCalled();
    document.removeEventListener("wheel", page);
  });

  it("does not hold a strip that has nothing to scroll", () => {
    const strip = document.createElement("div");
    document.body.append(strip);
    Object.defineProperty(strip, "scrollHeight", { value: 900 });
    Object.defineProperty(strip, "clientHeight", { value: 900 });
    setup(strip);
    const wheel = fire(strip, new WheelEvent("wheel", { cancelable: true, bubbles: true }));
    expect(wheel.defaultPrevented).toBe(true);
  });

  it("cancels the touch drag outside a strip", () => {
    setup();
    const touch = fire(document.body, new Event("touchmove", { cancelable: true, bubbles: true }));
    expect(touch.defaultPrevented).toBe(true);
  });

  it("takes Escape and the side arrows for the viewer", () => {
    const { onEscape, onStep } = setup();
    const page = vi.fn();
    window.addEventListener("keydown", page);
    fire(
      document.body,
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
    );
    fire(
      document.body,
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true }),
    );
    fire(
      document.body,
      new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true, cancelable: true }),
    );
    expect(onEscape).toHaveBeenCalledTimes(1);
    expect(onStep.mock.calls).toEqual([[1], [-1]]);
    expect(page).not.toHaveBeenCalled();
    window.removeEventListener("keydown", page);
  });

  it("cancels the scroll keys, except Space on a button", () => {
    setup();
    const button = document.createElement("button");
    document.body.append(button);
    const down = fire(
      document.body,
      new KeyboardEvent("keydown", { key: "PageDown", cancelable: true, bubbles: true }),
    );
    const arrow = fire(
      button,
      new KeyboardEvent("keydown", { key: "ArrowDown", cancelable: true, bubbles: true }),
    );
    const space = fire(
      button,
      new KeyboardEvent("keydown", { key: " ", cancelable: true, bubbles: true }),
    );
    expect(down.defaultPrevented).toBe(true);
    expect(arrow.defaultPrevented).toBe(true);
    expect(space.defaultPrevented).toBe(false);
  });

  it("lets the keys scroll a strip that has the focus", () => {
    const strip = document.createElement("div");
    document.body.append(strip);
    Object.defineProperty(strip, "scrollHeight", { value: 5000 });
    Object.defineProperty(strip, "clientHeight", { value: 900 });
    setup(strip);
    const key = fire(
      strip,
      new KeyboardEvent("keydown", { key: "PageDown", cancelable: true, bubbles: true }),
    );
    expect(key.defaultPrevented).toBe(false);
  });

  it("lets go once, and then the page is its own again", () => {
    setup();
    release?.();
    release?.();
    release = null;
    const wheel = fire(document.body, new WheelEvent("wheel", { cancelable: true, bubbles: true }));
    expect(wheel.defaultPrevented).toBe(false);
  });
});
