import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/media-store", () => ({
  mediaUrl: (file: string) => `blob:mock${file}`,
}));

import { giveSource } from "./autoplay";

describe("a video source", () => {
  it("asks for the file when the copy in memory has gone bad", () => {
    const video = document.createElement("video");
    giveSource(video, "/video/vexana/x.mp4");
    expect(video.src.startsWith("blob:")).toBe(true);
    video.dispatchEvent(new Event("error"));
    expect(video.src.startsWith("blob:")).toBe(false);
    expect(video.src).toContain("/video/vexana/x.mp4");
  });

  it("does not loop on a file that is itself bad", () => {
    const video = document.createElement("video");
    giveSource(video, "/video/vexana/y.mp4");
    video.dispatchEvent(new Event("error"));
    const after = video.src;
    video.dispatchEvent(new Event("error"));
    expect(video.src).toBe(after);
  });
});
