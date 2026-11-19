import { describe, expect, it } from "vitest";

import { isRovingKey, rovingNext, rovingStart } from "./roving";

const ALL = [true, true, true, true];

describe("the credit plates' arrow keys", () => {
  it("step to the next and the previous plate and stop at the ends", () => {
    expect(rovingNext("ArrowRight", 0, ALL)).toBe(1);
    expect(rovingNext("ArrowDown", 2, ALL)).toBe(3);
    expect(rovingNext("ArrowLeft", 2, ALL)).toBe(1);
    expect(rovingNext("ArrowUp", 1, ALL)).toBe(0);
    expect(rovingNext("ArrowRight", 3, ALL)).toBeNull();
    expect(rovingNext("ArrowLeft", 0, ALL)).toBeNull();
  });

  it("step over a plate that has no link", () => {
    const has = [true, false, false, true];
    expect(rovingNext("ArrowRight", 0, has)).toBe(3);
    expect(rovingNext("ArrowLeft", 3, has)).toBe(0);
  });

  it("send Home and End to the first and the last plate that has a link", () => {
    const has = [false, true, true, false];
    expect(rovingNext("Home", 2, has)).toBe(1);
    expect(rovingNext("End", 1, has)).toBe(2);
    expect(rovingNext("Home", 1, has)).toBeNull();
  });

  it("does nothing with no plates", () => {
    expect(rovingNext("Home", 0, [])).toBeNull();
    expect(rovingNext("ArrowRight", 0, [])).toBeNull();
  });

  it("knows its keys", () => {
    expect(isRovingKey("Home")).toBe(true);
    expect(isRovingKey("Tab")).toBe(false);
    expect(isRovingKey("a")).toBe(false);
  });
});

describe("the plate that holds the tab stop", () => {
  it("is the one asked for when it has a link, else the first that has one", () => {
    expect(rovingStart(2, ALL)).toBe(2);
    expect(rovingStart(1, [false, false, true])).toBe(2);
    expect(rovingStart(0, [false, false])).toBe(0);
  });
});
