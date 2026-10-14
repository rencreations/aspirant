import { useUiStore } from "./ui-store";

describe("ui store", () => {
  beforeEach(() => useUiStore.setState({ reducedEffects: false }));

  it("toggles reduced effects", () => {
    useUiStore.getState().toggleReducedEffects();
    expect(useUiStore.getState().reducedEffects).toBe(true);
    useUiStore.getState().toggleReducedEffects();
    expect(useUiStore.getState().reducedEffects).toBe(false);
  });

  it("sets reduced effects explicitly", () => {
    useUiStore.getState().setReducedEffects(true);
    expect(useUiStore.getState().reducedEffects).toBe(true);
  });
});
