/**
 * The change of the words when another disc comes to the front: the old lines slide up out of
 * their masks and the rules shrink away to the right; once the field has settled, the new lines
 * rise into place one after the other and the rules draw themselves from the left. Web Animations
 * of `transform` only, so the browser runs them on the compositor.
 *
 * Marked in the markup: `data-line` (a text inside an element that clips it), `data-rule` (a
 * hairline), `data-rise` (a control that fades as it moves, with nothing clipping it, so a list it
 * opens is not cut), and `data-group` on the blocks that start a little after the one before.
 */
const EASE = "cubic-bezier(0.32, 0.72, 0, 1)";
const OUT_MS = 400;
const OUT_STAGGER = 16;
const IN_MS = 700;
const IN_STAGGER = 35;
const GROUP_GAP = 60;

function parts(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>("[data-line], [data-rule], [data-rise]"));
}

function groupOf(el: HTMLElement, root: HTMLElement): HTMLElement | null {
  const g = el.closest<HTMLElement>("[data-group]");
  return g && root.contains(g) ? g : null;
}

/** Stop what runs on an element and keep the place it had reached. */
function freeze(el: HTMLElement): string {
  const now = getComputedStyle(el).transform;
  el.getAnimations().forEach((a) => {
    a.cancel();
  });
  return now === "none" ? "" : now;
}

/** Take the words away. Resolves when they are gone. */
export function hideWords(root: HTMLElement | null): Promise<void> {
  if (!root) return Promise.resolve();
  const runs = parts(root).map((el, i) => {
    const from = freeze(el);
    const rule = el.hasAttribute("data-rule");
    el.style.transformOrigin = rule ? "right center" : "";
    const frames = rule
      ? [{ transform: from || "scaleX(1)" }, { transform: "scaleX(0)" }]
      : el.hasAttribute("data-rise")
        ? [
            { transform: from || "translateY(0)", opacity: getComputedStyle(el).opacity },
            { transform: "translateY(-40%)", opacity: 0 },
          ]
        : [{ transform: from || "translateY(0)" }, { transform: "translateY(-120%)" }];
    return el.animate(frames, {
      duration: OUT_MS,
      delay: i * OUT_STAGGER,
      easing: EASE,
      fill: "both",
    }).finished;
  });
  return Promise.all(runs).then(
    () => undefined,
    () => undefined,
  );
}

/** Bring the words in, the new lines rising and the rules drawing from the left. */
export function showWords(root: HTMLElement | null): void {
  if (!root) return;
  let at = 0;
  let group: HTMLElement | null | undefined;
  parts(root).forEach((el) => {
    const g = groupOf(el, root);
    if (group !== undefined && g !== group) at += GROUP_GAP;
    group = g;
    freeze(el);
    const rule = el.hasAttribute("data-rule");
    el.style.transformOrigin = rule ? "left center" : "";
    const frames = rule
      ? [{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }]
      : el.hasAttribute("data-rise")
        ? [
            { transform: "translateY(70%)", opacity: 0 },
            { transform: "translateY(0)", opacity: 1 },
          ]
        : [{ transform: "translateY(120%)" }, { transform: "translateY(0)" }];
    const run = el.animate(frames, { duration: IN_MS, delay: at, easing: EASE, fill: "backwards" });
    // At rest the words carry no animation at all.
    run.finished.then(
      () => {
        run.cancel();
      },
      () => undefined,
    );
    at += IN_STAGGER;
  });
}
