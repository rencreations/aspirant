import { isPhone, isShort, navHeight, type Box, type Obstacles } from "./layout";

/**
 * The shelf's HTML controls that the focused cover and the open Video cover must keep clear of,
 * measured from the DOM: a box in CSS px from the top left of `stage`. Offsets are used where they
 * can be (they ignore the entrance's 8 px slide and the hover nudge); the Continue button is fixed
 * outside the stage, so it is read from its rectangle. Called when the layout changes, never per frame.
 */

/** The box of `el` on the stage, or null when it is not drawn. */
function boxOf(stage: HTMLElement, el: HTMLElement | null): Box | null {
  if (!el || el.offsetWidth === 0 || el.offsetHeight === 0) return null;
  let left = 0;
  let top = 0;
  let node: HTMLElement | null = el;
  while (node && node !== stage) {
    left += node.offsetLeft;
    top += node.offsetTop;
    node = node.offsetParent instanceof HTMLElement ? node.offsetParent : null;
  }
  if (node !== stage) {
    const r = el.getBoundingClientRect();
    const s = stage.getBoundingClientRect();
    return {
      left: r.left - s.left,
      right: r.right - s.left,
      top: r.top - s.top,
      bottom: r.bottom - s.top,
    };
  }
  return { left, top, right: left + el.offsetWidth, bottom: top + el.offsetHeight };
}

function present(boxes: Array<Box | null>): Box[] {
  return boxes.filter((b): b is Box => b !== null);
}

/** `--nav-h` in px (the token is in rem). */
function navHeightOf(stage: HTMLElement, w: number): number {
  const token = getComputedStyle(stage).getPropertyValue("--nav-h").trim();
  const n = parseFloat(token);
  if (!Number.isFinite(n)) return navHeight(w);
  if (token.endsWith("rem")) {
    return n * (parseFloat(getComputedStyle(document.documentElement).fontSize) || 16);
  }
  return token.endsWith("px") ? n : navHeight(w);
}

export function measureObstacles(stage: HTMLElement): Obstacles {
  const w = stage.clientWidth;
  const h = stage.clientHeight;
  const phone = isPhone(w);
  const short = isShort(h);
  const top = boxOf(stage, stage.querySelector<HTMLElement>("[data-shelf-top]"));
  const next = boxOf(stage, document.querySelector<HTMLElement>("[data-shelf-continue]"));
  const index = boxOf(stage, stage.querySelector<HTMLElement>("[data-shelf-index]"));
  const bar = stage.querySelectorAll<HTMLElement>("[data-shelf-bartext] > *");
  return {
    short,
    navH: navHeightOf(stage, w),
    focusAbove: present([top, next]),
    // A phone has its name bar under the cover; a wide screen its index row, which steps aside
    // while a cover is focused on a short one.
    focusBelow: phone
      ? present(Array.from(bar, (el) => boxOf(stage, el)))
      : short
        ? []
        : present([index]),
    // A phone hides the tagline and Search while the Video cover is open; Continue stays.
    splitAbove: phone ? present([next]) : present([top, next]),
  };
}
