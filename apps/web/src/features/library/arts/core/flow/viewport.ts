/**
 * The width of the wall before the page has drawn it: the document's width less the page's side
 * margin (`--gutter`) on both sides. A hidden probe reads the margin as the browser resolves it, so
 * the loading list plans the same rows the page does.
 */
export function wallWidth(): number {
  const probe = document.createElement("div");
  probe.style.cssText =
    "position:fixed;top:0;left:0;width:0;height:0;visibility:hidden;pointer-events:none;padding-left:var(--gutter)";
  document.body.appendChild(probe);
  const gutter = Number.parseFloat(getComputedStyle(probe).paddingLeft);
  probe.remove();
  const side = Number.isFinite(gutter) ? gutter : 0;
  return Math.max(1, document.documentElement.clientWidth - 2 * side);
}
