import { GR_MODEL, GR_MODEL_BYTES } from "./facts";
import { gramophoneItems } from "./preload";

describe("gramophoneItems", () => {
  it("lists the script and the model, deferred by default", () => {
    const items = gramophoneItems();
    expect(items.map((i) => i.id)).toEqual(["chunk:home-gramophone", `media:${GR_MODEL}`]);
    expect(items.every((i) => i.deferred === true)).toBe(true);
    expect(items.every((i) => i.priority === 45)).toBe(true);
  });

  it("can be waited for", () => {
    const items = gramophoneItems({ deferred: false });
    expect(items.every((i) => i.deferred !== true)).toBe(true);
  });

  it("weights the model by its bytes", () => {
    const model = gramophoneItems().find((i) => i.id.startsWith("media:"));
    expect(model?.weight).toBe(Math.max(1, Math.round(GR_MODEL_BYTES / 1_000_000)));
  });
});
