import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/media-store", () => ({
  mediaUrl: (file: string) => `blob:mock${file}`,
}));

import { giveSource, mayPlay } from "./autoplay";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("a muted picture that runs by itself", () => {
  it("runs unless data saving is on, whatever the performance level says", () => {
    expect(mayPlay()).toBe(true);
    vi.stubGlobal("navigator", { connection: { saveData: true } });
    expect(mayPlay()).toBe(false);
  });

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
