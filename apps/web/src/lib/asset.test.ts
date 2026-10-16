import { asset, createAsset, createWithBase } from "./asset";

describe("asset()", () => {
  it("leaves paths alone without a base path", () => {
    const a = createAsset("");
    expect(a("/img/layla/splash.webp")).toBe("/img/layla/splash.webp");
    expect(a("img/layla/splash.webp")).toBe("/img/layla/splash.webp");
    expect(a("")).toBe("/");
  });

  it("prefixes the base path and normalises slashes", () => {
    const a = createAsset("/aspirant/");
    expect(a("/img/a.webp")).toBe("/aspirant/img/a.webp");
    expect(a("img/a.webp")).toBe("/aspirant/img/a.webp");
    expect(createAsset("aspirant")("/data/story/index.json")).toBe(
      "/aspirant/data/story/index.json",
    );
  });

  it("is safe to call twice", () => {
    const a = createAsset("/aspirant");
    expect(a(a("/video/trailer.mp4"))).toBe("/aspirant/video/trailer.mp4");
    expect(a("/aspirant")).toBe("/aspirant");
  });

  it("does not touch a path that only starts with the same letters", () => {
    expect(createAsset("/aspirant")("/aspirants/x.png")).toBe("/aspirant/aspirants/x.png");
  });

  it("passes external and inline URLs through", () => {
    const a = createAsset("/aspirant");
    for (const url of [
      "https://example.com/a.png",
      "http://example.com",
      "//cdn.example.com/x.js",
      "data:image/png;base64,AAAA",
      "blob:http://localhost/123",
      "mailto:hello@example.com",
    ]) {
      expect(a(url)).toBe(url);
    }
  });

  it("uses NEXT_PUBLIC_BASE_PATH (empty in tests)", () => {
    expect(asset("/img/x.webp")).toBe(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/img/x.webp`);
  });
});

describe("withBase()", () => {
  it("adds the base path and the export's trailing slash to routes", () => {
    const w = createWithBase("/aspirant");
    expect(w("/story")).toBe("/aspirant/story/");
    expect(w("/character/layla/")).toBe("/aspirant/character/layla/");
    expect(w("/")).toBe("/aspirant/");
    expect(w("/story?x=1#top")).toBe("/aspirant/story/?x=1#top");
  });

  it("does not add a slash to files, hashes or external links", () => {
    const w = createWithBase("/aspirant");
    expect(w("/sitemap.xml")).toBe("/aspirant/sitemap.xml");
    expect(w("#main")).toBe("#main");
    expect(w("https://example.com/a")).toBe("https://example.com/a");
  });
});
