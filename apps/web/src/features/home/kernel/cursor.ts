/**
 * The site's cursor (`components/lantern-cursor.tsx`) takes its label from the `data-cursor` of the
 * element the pointer is over. A 3D actor has no element under the pointer, so the kernel keeps one
 * invisible proxy element and, when a 3D target is under the pointer, gives the proxy the label and
 * tells the cursor the pointer is over it (the same `pointerover` the cursor listens to). When the
 * target goes, the label is taken off and the cursor is told again. The proxy has no size, takes no
 * pointer events and is hidden from assistive technology.
 */
import type { CursorApi } from "./types";

export class CursorProxy implements CursorApi {
  private readonly el: HTMLElement;
  private label: string | null = null;

  /** `theme` is the ring colour the proxy asks for (the cursor reads the nearest `data-theme`). */
  constructor(host: HTMLElement, theme: "daybreak" | "storm" = "daybreak") {
    this.el = document.createElement("span");
    this.el.setAttribute("aria-hidden", "true");
    this.el.dataset.homeCursor = "";
    this.el.dataset.theme = theme;
    this.el.style.cssText =
      "position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;pointer-events:none;";
    host.appendChild(this.el);
  }

  setTheme(theme: "daybreak" | "storm"): void {
    if (this.el.dataset.theme !== theme) this.el.dataset.theme = theme;
  }

  set(label: string | null): void {
    if (label === this.label) return;
    this.label = label;
    if (label === null) this.el.removeAttribute("data-cursor");
    else this.el.dataset.cursor = label;
    this.announce();
  }

  dispose(): void {
    if (this.label !== null) this.set(null);
    this.el.remove();
  }

  private announce(): void {
    const init = { bubbles: true, cancelable: false, pointerType: "mouse" as const };
    const event =
      typeof PointerEvent === "function"
        ? new PointerEvent("pointerover", init)
        : new MouseEvent("pointerover", { bubbles: true });
    this.el.dispatchEvent(event);
  }
}
