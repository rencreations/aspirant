import type { AnchorBox, FaceName } from "../choreo/path";

/**
 * Reading the page for the drone's path: the anchors, the bar and the gutter. Only reads, no
 * writes. It runs on mount, on a resize and when the page's height changes, never per frame.
 *
 * An anchor inside a sticky box (the perch in the film's stage, the middle of the statement) does
 * not stay where the document puts it, so its rectangle depends on the scroll at the moment it is
 * measured. It is measured in a way that does not: its place inside the sticky box (which never
 * changes), and the stretch of scroll over which the box is held, worked out from the box's
 * containing block. The path then knows where the anchor is on the screen for any scroll.
 */

const FACES: ReadonlySet<string> = new Set<FaceName>([
  "normal",
  "happy",
  "squint",
  "scan",
  "alert",
  "sleepy",
  "angry",
  "ecg",
  "dead",
]);

const px = (v: string) => Number.parseFloat(v) || 0;

/** The margin between two boxes that follow each other, as CSS collapses it. */
function collapsed(a: number, b: number): number {
  if (a >= 0 && b >= 0) return Math.max(a, b);
  if (a < 0 && b < 0) return Math.min(a, b);
  return a + b;
}

/** The nearest box, the element itself or one around it, that is sticky. */
function stickyBox(el: HTMLElement, root: HTMLElement): HTMLElement | null {
  for (let at: HTMLElement | null = el; at && at !== root; at = at.parentElement) {
    if (getComputedStyle(at).position === "sticky") return at;
  }
  return null;
}

/** The box before `el` that takes room in the flow, if any. */
function before(el: HTMLElement): HTMLElement | null {
  for (let at = el.previousElementSibling; at; at = at.previousElementSibling) {
    if (!(at instanceof HTMLElement)) continue;
    const style = getComputedStyle(at);
    if (style.display === "none" || style.position === "absolute" || style.position === "fixed") {
      continue;
    }
    return at;
  }
  return null;
}

/** The stretch of scroll over which a sticky box is held, and where its top is in the flow. */
function heldRange(box: HTMLElement, scrollY: number): { top: number; from: number; to: number } {
  const style = getComputedStyle(box);
  const rect = box.getBoundingClientRect();
  const stickAt = px(style.top);
  const parent = box.parentElement;
  if (!parent) return { top: rect.top + scrollY, from: Infinity, to: Infinity };
  const parentStyle = getComputedStyle(parent);
  const parentRect = parent.getBoundingClientRect();
  // Where the box lies before it sticks: under the box before it, or at the top of its parent.
  const prev = before(box);
  let top = prev
    ? prev.getBoundingClientRect().bottom +
      collapsed(px(getComputedStyle(prev).marginBottom), px(style.marginTop))
    : parentRect.top +
      px(parentStyle.borderTopWidth) +
      px(parentStyle.paddingTop) +
      px(style.marginTop);
  // Not held yet: then it is simply where it is.
  if (rect.top > stickAt + 0.5) top = rect.top;
  top += scrollY;
  const floor =
    parentRect.bottom +
    scrollY -
    px(parentStyle.borderBottomWidth) -
    px(parentStyle.paddingBottom) -
    px(style.marginBottom);
  const from = top - stickAt;
  return { top, from, to: Math.max(from, floor - rect.height - stickAt) };
}

/** Every anchor of the page, measured. `root` is the page's root element. */
export function measureAnchors(root: HTMLElement): AnchorBox[] {
  const scrollX = window.scrollX;
  const scrollY = window.scrollY;
  const out: AnchorBox[] = [];
  for (const el of root.querySelectorAll<HTMLElement>("[data-drone-anchor]")) {
    const id = el.dataset.droneAnchor;
    const rect = el.getBoundingClientRect();
    if (!id || rect.width <= 0) continue;
    const anchor: AnchorBox = {
      id,
      x: rect.left + rect.width / 2 + scrollX,
      y: rect.top + rect.height / 2 + scrollY,
      w: rect.width,
    };
    const box = stickyBox(el, root);
    if (box) {
      const held = heldRange(box, scrollY);
      const inside = rect.top + rect.height / 2 - box.getBoundingClientRect().top;
      anchor.y = held.top + inside;
      if (Number.isFinite(held.from)) anchor.stick = { from: held.from, to: held.to };
    }
    const face = el.dataset.droneFace;
    if (face && FACES.has(face)) anchor.face = face as FaceName;
    const turn = Number.parseFloat(el.dataset.droneTurn ?? "");
    if (Number.isFinite(turn)) anchor.turn = (turn * Math.PI) / 180;
    out.push(anchor);
  }
  return out;
}
