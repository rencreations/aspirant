const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** 0 before `a`, 1 after `b`, linear between. */
export const seg = (v: number, a: number, b: number) => clamp01((v - a) / (b - a));

export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/** Writes a style only when it changed (most values rest most frames). */
const last = new WeakMap<HTMLElement | SVGElement, Map<string, string>>();
export function put(el: HTMLElement | SVGElement | null | undefined, prop: string, value: string) {
  if (!el) return;
  let m = last.get(el);
  if (!m) {
    m = new Map();
    last.set(el, m);
  }
  if (m.get(prop) === value) return;
  m.set(prop, value);
  el.style.setProperty(prop, value);
}

/**
 * The height of the largest viewport in pixels (what `100lvh` is in the stylesheets). Scroll
 * distances are in screens of this height, so the triggers agree with the layout on phones whose
 * address bar comes and goes.
 */
export function lvh(): number {
  if (typeof document === "undefined") return 800;
  const probe = document.createElement("div");
  probe.style.cssText =
    "position:fixed;top:0;left:0;width:0;height:100vh;height:100lvh;visibility:hidden;pointer-events:none";
  document.body.appendChild(probe);
  const h = probe.offsetHeight;
  probe.remove();
  return h || window.innerHeight;
}
