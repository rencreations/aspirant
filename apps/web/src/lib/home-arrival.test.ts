import vm from "node:vm";

import { bootScript } from "./boot-script";
import {
  decideHomeArrival,
  homeArrivalExpression,
  INTRO_KEY,
  isHomePath,
  type HomeArrivalInput,
} from "./home-arrival";

const base: HomeArrivalInput = {
  pathname: "/",
  basePath: "",
  navType: "navigate",
  introOff: false,
};

/** One table of cases, run through the plain function and through the boot script's text. */
const CASES: ReadonlyArray<[string, Partial<HomeArrivalInput>, boolean]> = [
  ["a visit from outside", {}, true],
  ["a reload", { navType: "reload" }, true],
  ["back or forward to a document", { navType: "back_forward" }, true],
  ["a browser with no navigation entry", { navType: null }, true],
  ["a page that was only prerendered", { navType: "prerender" }, false],
  ["intro off (tests and probes)", { introOff: true }, false],
  ["another route is the landing page", { pathname: "/about/" }, false],
  ["a deep route", { pathname: "/story/chapter-01/" }, false],
  [
    "the home without its trailing slash on a base path",
    { pathname: "/aspirant", basePath: "/aspirant" },
    true,
  ],
  [
    "the home on a base path with its slash",
    { pathname: "/aspirant/", basePath: "/aspirant/" },
    true,
  ],
  ["another route on a base path", { pathname: "/aspirant/about/", basePath: "/aspirant" }, false],
  [
    "the root when the site lives under a base path",
    { pathname: "/", basePath: "/aspirant" },
    false,
  ],
  ["index.html (what Lighthouse audits)", { pathname: "/index.html" }, true],
  ["index.html on a base path", { pathname: "/aspirant/index.html", basePath: "/aspirant" }, true],
  ["a path that only starts like the home", { pathname: "/index.html.bak" }, false],
];

interface Stubs {
  pathname: string;
  navType: string | null;
  timingThrows?: boolean;
  introOff: boolean;
  storageThrows?: boolean;
}

function stubs(i: Stubs) {
  const sessionStorage = {
    getItem: (key: string) => {
      if (i.storageThrows) throw new Error("blocked");
      return key === INTRO_KEY && i.introOff ? "off" : null;
    },
  };
  const performance = {
    getEntriesByType: () => {
      if (i.timingThrows) throw new Error("no timing");
      return i.navType === null ? [] : [{ type: i.navType }];
    },
  };
  return { location: { pathname: i.pathname }, sessionStorage, performance };
}

function runExpression(basePath: string, s: ReturnType<typeof stubs>): unknown {
  return vm.runInNewContext(homeArrivalExpression(basePath), { ...s });
}

describe("isHomePath", () => {
  it("knows the home with and without slashes, index.html and a base path", () => {
    expect(isHomePath("/")).toBe(true);
    expect(isHomePath("")).toBe(true);
    expect(isHomePath("/index.html")).toBe(true);
    expect(isHomePath("/about")).toBe(false);
    expect(isHomePath("/aspirant/", "/aspirant")).toBe(true);
    expect(isHomePath("/aspirant/index.html", "/aspirant/")).toBe(true);
    expect(isHomePath("/", "/aspirant")).toBe(false);
  });
});

describe("the home arrival decision", () => {
  it.each(CASES)("function: %s", (_name, change, expected) => {
    expect(decideHomeArrival({ ...base, ...change })).toBe(expected);
  });

  it.each(CASES)("boot script expression: %s", (_name, change, expected) => {
    const input = { ...base, ...change };
    const out = runExpression(
      input.basePath,
      stubs({ pathname: input.pathname, navType: input.navType, introOff: input.introOff }),
    );
    expect(out).toBe(expected);
  });

  it("never throws and falls back to a plain visit when the browser gives nothing", () => {
    expect(
      runExpression(
        "",
        stubs({ pathname: "/", navType: "navigate", timingThrows: true, introOff: false }),
      ),
    ).toBe(true);
    expect(
      runExpression(
        "",
        stubs({ pathname: "/", navType: "navigate", introOff: false, storageThrows: true }),
      ),
    ).toBe(true);
  });
});

interface Page extends Stubs {
  entered: boolean;
  basePath?: string;
}

/** Runs the whole boot script against a stand-in page and reports what it did. */
function runBoot(page: Page) {
  const s = stubs(page);
  const dataset: Record<string, string> = {};
  const added: string[] = [];
  const timers: Array<{ fn: () => void; ms: number }> = [];
  const listeners: string[] = [];
  const win: { __aspirantsGate?: boolean } = {};
  const sessionStorage = {
    getItem: (key: string) =>
      key === "aspirants:entered" ? (page.entered ? "1" : null) : s.sessionStorage.getItem(key),
    setItem: () => undefined,
  };
  const document = {
    documentElement: { classList: { add: (c: string) => added.push(c) }, dataset },
  };
  vm.runInNewContext(bootScript(page.basePath ?? ""), {
    document,
    matchMedia: () => ({ matches: true }),
    sessionStorage,
    location: s.location,
    performance: s.performance,
    addEventListener: (type: string) => listeners.push(type),
    setTimeout: (fn: () => void, ms: number) => timers.push({ fn, ms }),
    navigator: { onLine: true },
    window: win,
  });
  return { dataset, added, timers, listeners, win };
}

describe("the boot script", () => {
  const fresh = { navType: "navigate", introOff: false } as const;

  it("is valid code and marks JS, the pointer and the error failsafe", () => {
    const r = runBoot({ ...fresh, pathname: "/about/", entered: true });
    expect(r.added).toEqual(["js"]);
    expect(r.dataset.pointer).toBe("fine");
    expect(r.listeners).toContain("error");
  });

  it("paints the cover for a first visit to any page, and does not mark an arrival", () => {
    const r = runBoot({ ...fresh, pathname: "/about/", entered: false });
    expect(r.dataset.gate).toBe("on");
    expect(r.dataset.arrival).toBeUndefined();
    expect(r.dataset.gateKind).toBeUndefined();
  });

  it("gives an entered tab on another page the cover only after 1.5 s if the scripts are slow", () => {
    const r = runBoot({ ...fresh, pathname: "/about/", entered: true });
    expect(r.dataset.gate).toBeUndefined();
    expect(r.timers).toHaveLength(1);
    expect(r.timers[0]?.ms).toBe(1500);
    r.timers[0]?.fn();
    expect(r.dataset.gate).toBe("on");
  });

  it("leaves the cover down when the loader has mounted before the 1.5 s are up", () => {
    const r = runBoot({ ...fresh, pathname: "/about/", entered: true });
    r.win.__aspirantsGate = true;
    r.timers[0]?.fn();
    expect(r.dataset.gate).toBeUndefined();
  });

  it("paints the cover at once for a document load of the home, entered or not, with no timer", () => {
    for (const entered of [false, true]) {
      const r = runBoot({ ...fresh, pathname: "/", entered });
      expect(r.dataset.gate).toBe("on");
      expect(r.dataset.arrival).toBe("home");
      expect(r.dataset.gateKind).toBe("home");
      expect(r.timers).toHaveLength(0);
    }
  });

  it("treats a reload of the home like a visit", () => {
    const r = runBoot({ ...fresh, navType: "reload", pathname: "/", entered: true });
    expect(r.dataset.arrival).toBe("home");
  });

  it("does not run the home opening when intro is off, and keeps the old rules", () => {
    const entered = runBoot({ ...fresh, introOff: true, pathname: "/", entered: true });
    expect(entered.dataset.arrival).toBeUndefined();
    expect(entered.dataset.gate).toBeUndefined();
    expect(entered.timers[0]?.ms).toBe(1500);
    const first = runBoot({ ...fresh, introOff: true, pathname: "/", entered: false });
    expect(first.dataset.arrival).toBeUndefined();
    expect(first.dataset.gate).toBe("on");
  });

  it("finds the home on a base path", () => {
    const r = runBoot({ ...fresh, pathname: "/aspirant/", basePath: "/aspirant", entered: false });
    expect(r.dataset.arrival).toBe("home");
  });
});
