/**
 * The black cover of `/character` (see `roster-cover.tsx`). It is in the page's own markup so the
 * visitor sees black from the first paint, and it is let go as soon as the intro's canvas is up and
 * showing black itself, or at once when the intro will not play.
 */
export function hideCover(): void {
  if (typeof document === "undefined") return;
  const el = document.querySelector<HTMLElement>("[data-roster-cover]");
  if (el) el.style.display = "none";
}
