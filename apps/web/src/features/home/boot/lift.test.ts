// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";

import { dropStage, isStageLifted, liftStage } from "./lift";

function page() {
  document.body.innerHTML = '<main id="main"><div id="host"></div></main>';
  return {
    main: document.getElementById("main")!,
    host: document.getElementById("host")!,
  };
}

afterEach(() => {
  dropStage();
  document.body.innerHTML = "";
});

describe("the stage lift", () => {
  it("lifts <main> above the loading screen (90) and makes it click through, and shows the host", () => {
    const { main, host } = page();
    host.style.visibility = "hidden";
    liftStage(host);
    expect(isStageLifted()).toBe(true);
    expect(Number(main.style.zIndex)).toBeGreaterThan(90);
    expect(Number(main.style.zIndex)).toBeLessThan(95);
    expect(main.style.pointerEvents).toBe("none");
    expect(host.style.visibility).toBe("visible");
  });

  it("gives everything back, and does it twice without harm", () => {
    const { main, host } = page();
    liftStage(host);
    dropStage();
    expect(isStageLifted()).toBe(false);
    expect(main.style.zIndex).toBe("");
    expect(main.style.pointerEvents).toBe("");
    expect(host.style.visibility).toBe("");
    expect(() => {
      dropStage();
    }).not.toThrow();
  });

  it("lifts once however many times it is asked", () => {
    const { main, host } = page();
    liftStage(host);
    main.style.zIndex = "5";
    liftStage(host);
    expect(main.style.zIndex).toBe("5");
  });

  it("writes nothing on <html> or <body>", () => {
    const { host } = page();
    liftStage(host);
    expect(document.documentElement.getAttribute("style")).toBeNull();
    expect(document.body.getAttribute("style")).toBeNull();
  });

  it("does nothing when the page has no <main>", () => {
    document.body.innerHTML = "<div></div>";
    liftStage(null);
    expect(isStageLifted()).toBe(false);
  });
});
