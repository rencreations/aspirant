/**
 * Where the page goes (in screens from the start of the section) when a control of a section the
 * page is not at takes the keyboard focus. A control may say where it shows itself with
 * `data-home-focus-at="<screens>"` (the strip's "See All" shows only at the very start of its
 * section, its last button only at the end). Without it the section's own `focus` (a fraction of
 * its length) is used, and without that the middle.
 */
export function focusScreens(
  sectionScreens: number,
  sectionFocus: number | undefined,
  controlAttr: string | undefined,
): number {
  if (controlAttr !== undefined && controlAttr.trim() !== "") {
    const own = Number(controlAttr);
    if (Number.isFinite(own) && own >= 0 && own <= sectionScreens) return own;
  }
  return sectionScreens * (sectionFocus ?? 0.5);
}
