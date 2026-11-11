import { metricsFor, type FlowMetrics } from "./math";

/**
 * The large viewport height: what `100lvh` is. A phone's address bar does not change it, so the
 * rows are planned for one height whether the bar is shown or not. A hidden probe measures it
 * (a browser without `lvh` gets the window's height). The page and the loading list both use it,
 * so they plan the same rows.
 */
export function largeViewportHeight(): number {
  const probe = document.createElement("div");
  probe.style.cssText =
    "position:fixed;top:0;left:0;width:0;height:100lvh;visibility:hidden;pointer-events:none";
  document.body.appendChild(probe);
  const h = probe.offsetHeight;
  probe.remove();
  return h > 0 ? h : window.innerHeight;
}

/** The metrics of the screen as it is now, for a loading list that plans the rows before the page does. */
export function currentMetrics(): FlowMetrics {
  return metricsFor(document.documentElement.clientWidth, largeViewportHeight());
}
