import { clearHomeNav, shouldClearHomeNav, useNavLock } from "./nav-lock";

const SHOWN = {
  theme: null,
  bare: false,
  fade: false,
  away: false,
  hideLogo: false,
  hideControls: false,
} as const;

beforeEach(() => {
  useNavLock.setState(SHOWN);
});

describe("the bar's lock", () => {
  it("starts with everything shown", () => {
    expect(useNavLock.getState()).toMatchObject(SHOWN);
  });

  it("keeps the home's two fields when a page sets the older ones", () => {
    useNavLock.setState({ hideLogo: true, hideControls: true });
    useNavLock.setState({ theme: "daybreak", bare: true, fade: false, away: false });
    expect(useNavLock.getState()).toMatchObject({ hideLogo: true, hideControls: true, bare: true });
    useNavLock.setState({ theme: null, bare: false, fade: false, away: false });
    expect(useNavLock.getState()).toMatchObject({ hideLogo: true, hideControls: true });
  });
});

describe("clearing the home's fields on a path change", () => {
  it("is asked for every page but the home", () => {
    for (const path of ["/about", "/about/", "/story/chapter-01/", "/character/", "/collection/"]) {
      expect(shouldClearHomeNav(path)).toBe(true);
    }
    for (const path of ["/", "", "//", "/index.html"]) {
      expect(shouldClearHomeNav(path)).toBe(false);
    }
  });

  it("shows the logo and the controls again and leaves the other fields alone", () => {
    useNavLock.setState({ theme: "storm", bare: true, hideLogo: true, hideControls: true });
    clearHomeNav();
    expect(useNavLock.getState()).toMatchObject({
      theme: "storm",
      bare: true,
      hideLogo: false,
      hideControls: false,
    });
  });

  it("changes nothing, and wakes nobody, when both are already shown", () => {
    const before = useNavLock.getState();
    let calls = 0;
    const stop = useNavLock.subscribe(() => {
      calls += 1;
    });
    clearHomeNav();
    stop();
    expect(calls).toBe(0);
    expect(useNavLock.getState()).toBe(before);
  });

  it("clears each field on its own", () => {
    useNavLock.setState({ hideLogo: true });
    clearHomeNav();
    expect(useNavLock.getState().hideLogo).toBe(false);
    useNavLock.setState({ hideControls: true });
    clearHomeNav();
    expect(useNavLock.getState().hideControls).toBe(false);
  });
});
