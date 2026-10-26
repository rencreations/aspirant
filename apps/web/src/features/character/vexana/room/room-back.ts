/**
 * The way back out of the room, to the section before it (Guinevere's last screen). The room's Back
 * button calls `roomBack.go()`. The default scrolls the page there smoothly; the transition between
 * the two sections replaces `go` with its scene (and the room sets `scrollTo` to the page's smooth
 * scroll, so the default does not fight it).
 */
export const roomBack: { go: () => void; scrollTo: (top: number) => void } = {
  go: () => {
    const el = document.getElementById("guinevere");
    if (!el) return;
    const r = el.getBoundingClientRect();
    roomBack.scrollTo(r.bottom + window.scrollY - window.innerHeight);
  },
  scrollTo: (top) => {
    window.scrollTo({ top, behavior: "smooth" });
  },
};
