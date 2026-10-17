import "@testing-library/jest-dom/vitest";

// jsdom does not implement IntersectionObserver (set piece hosts and in-view hooks use it).
if (typeof window !== "undefined" && !("IntersectionObserver" in window)) {
  class IntersectionObserverStub {
    readonly root = null;
    readonly rootMargin = "0px";
    readonly thresholds = [0];
    observe = () => undefined;
    unobserve = () => undefined;
    disconnect = () => undefined;
    takeRecords() {
      return [];
    }
  }
  (window as unknown as { IntersectionObserver: unknown }).IntersectionObserver =
    IntersectionObserverStub;
}

// jsdom does not implement matchMedia, which next-themes and motion rely on.
if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }) as MediaQueryList;
}
