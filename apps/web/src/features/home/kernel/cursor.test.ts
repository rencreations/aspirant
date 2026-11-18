import { afterEach, describe, expect, it, vi } from "vitest";

import { CursorProxy } from "./cursor";

describe("CursorProxy", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("tells the site's cursor that the pointer is over an element that carries the label", () => {
    const seen: Array<{ label: string | null; theme: string | undefined }> = [];
    const onOver = (e: Event) => {
      const el = e.target as HTMLElement;
      seen.push({ label: el.getAttribute("data-cursor"), theme: el.dataset.theme });
    };
    document.addEventListener("pointerover", onOver);
    const cursor = new CursorProxy(document.body, "storm");
    cursor.set("VIEW");
    cursor.set(null);
    document.removeEventListener("pointerover", onOver);
    expect(seen).toEqual([
      { label: "VIEW", theme: "storm" },
      { label: null, theme: "storm" },
    ]);
  });

  it("says nothing when the label did not change", () => {
    const onOver = vi.fn();
    document.addEventListener("pointerover", onOver);
    const cursor = new CursorProxy(document.body);
    cursor.set("PLAY");
    cursor.set("PLAY");
    cursor.set(null);
    cursor.set(null);
    document.removeEventListener("pointerover", onOver);
    expect(onOver).toHaveBeenCalledTimes(2);
  });

  it("is invisible, takes no pointer events and is hidden from assistive technology", () => {
    new CursorProxy(document.body);
    const el = document.querySelector<HTMLElement>("[data-home-cursor]");
    expect(el?.getAttribute("aria-hidden")).toBe("true");
    expect(el?.style.pointerEvents).toBe("none");
    expect(el?.style.opacity).toBe("0");
  });

  it("follows the theme of the section", () => {
    const cursor = new CursorProxy(document.body);
    cursor.setTheme("storm");
    expect(document.querySelector<HTMLElement>("[data-home-cursor]")?.dataset.theme).toBe("storm");
  });

  it("clears its label and leaves the page when disposed", () => {
    const onOver = vi.fn();
    document.addEventListener("pointerover", onOver);
    const cursor = new CursorProxy(document.body);
    cursor.set("VIEW");
    cursor.dispose();
    document.removeEventListener("pointerover", onOver);
    expect(onOver).toHaveBeenCalledTimes(2);
    expect(document.querySelector("[data-home-cursor]")).toBeNull();
  });
});
