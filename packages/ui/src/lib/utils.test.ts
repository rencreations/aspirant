import { cn } from "./utils";

describe("cn", () => {
  it("merges class names and drops falsy values", () => {
    expect(cn("px-2", false, undefined, "py-1")).toBe("px-2 py-1");
  });

  it("resolves conflicting Tailwind utilities, last one wins", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });
});
