import { describe, expect, it } from "vitest";

import { designPath, slugFromPath, withoutId } from "./route";

describe("the address of a post", () => {
  it("reads the slug of a post and nothing for the room", () => {
    expect(slugFromPath("/collection/design/the-voice-cast-is-announced/")).toBe(
      "the-voice-cast-is-announced",
    );
    expect(slugFromPath("/collection/design/the-voice-cast-is-announced")).toBe(
      "the-voice-cast-is-announced",
    );
    expect(slugFromPath("/collection/design/")).toBe("");
    expect(slugFromPath("/collection/design")).toBe("");
    expect(slugFromPath("/collection/lore/a/")).toBe("");
    expect(slugFromPath("/collection/design/a/b/")).toBe("");
  });

  it("makes the address of a post or of the room, keeping the search", () => {
    expect(designPath("pick-a-post")).toBe("/collection/design/pick-a-post/");
    expect(designPath("pick-a-post", "?pair=ruby-angela")).toBe(
      "/collection/design/pick-a-post/?pair=ruby-angela",
    );
    expect(designPath("")).toBe("/collection/design/");
    expect(designPath("", "?q=draw")).toBe("/collection/design/?q=draw");
  });

  it("takes the id of an old link out of the search", () => {
    expect(withoutId("?i=design-X")).toBe("");
    expect(withoutId("?q=draw&i=design-X&year=2022")).toBe("?q=draw&year=2022");
    expect(withoutId("")).toBe("");
  });
});
