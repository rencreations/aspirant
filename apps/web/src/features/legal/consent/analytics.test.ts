import { describe, expect, it } from "vitest";

import { analyticsCookieNames, cookieDomains, expiryLines } from "./analytics";

describe("analyticsCookieNames", () => {
  it("finds the two Google Analytics cookies and nothing else", () => {
    expect(analyticsCookieNames("a=1; _ga=GA1.1.2.3; _ga_7BHES29TV4=GS2.1.s1; theme=x")).toEqual([
      "_ga",
      "_ga_7BHES29TV4",
    ]);
  });

  it("finds none in an empty string or in other cookies", () => {
    expect(analyticsCookieNames("")).toEqual([]);
    expect(analyticsCookieNames("gaming=1; _gat=2; xga=3")).toEqual([]);
  });
});

describe("cookieDomains", () => {
  it("gives the host and every parent but the top level name", () => {
    expect(cookieDomains("aspirant.cc")).toEqual(["aspirant.cc"]);
    expect(cookieDomains("www.aspirant.cc")).toEqual(["www.aspirant.cc", "aspirant.cc"]);
  });

  it("gives none for localhost or an address", () => {
    expect(cookieDomains("localhost")).toEqual([]);
    expect(cookieDomains("127.0.0.1")).toEqual([]);
    expect(cookieDomains("[::1]")).toEqual([]);
  });
});

describe("expiryLines", () => {
  it("removes each cookie on the host and on the parent domain", () => {
    const lines = expiryLines("_ga=1; _ga_X=2", "aspirant.cc");
    expect(lines).toHaveLength(4);
    expect(lines.every((line) => line.includes("expires=Thu, 01 Jan 1970"))).toBe(true);
    expect(
      lines.some((line) => line.startsWith("_ga=") && line.includes("domain=aspirant.cc")),
    ).toBe(true);
    expect(lines.some((line) => line.startsWith("_ga_X=") && !line.includes("domain="))).toBe(true);
  });

  it("does nothing when there is no cookie of Google Analytics", () => {
    expect(expiryLines("theme=x", "aspirant.cc")).toEqual([]);
  });
});
