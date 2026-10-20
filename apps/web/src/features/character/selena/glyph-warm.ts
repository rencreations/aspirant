/**
 * Shapes text that the drawers will show, ahead of time, a few characters at a time.
 *
 * The first time the browser lays out a character that the web fonts do not have (the Japanese
 * titles of the voice lines, curly quotes), it looks for a system font that has it, and that
 * takes 15 to 25 ms per group of characters. Done all at once when a drawer opens, it was a frame
 * of a third of a second on a slow machine. Done here, while she idles, each step is too small to
 * see, and the drawer then opens with the fonts already found.
 *
 * The probe is invisible, out of the page's flow and contained, and removed when done.
 */
export function warmGlyphs(texts: readonly string[], lang = "ja"): () => void {
  if (typeof document === "undefined") return () => undefined;
  const chars = Array.from(new Set(Array.from(texts.join("")))).filter(
    (c) => (c.codePointAt(0) ?? 0) > 0x7f,
  );
  const STEP = 8;
  const chunks: string[] = [];
  for (let i = 0; i < chars.length; i += STEP) chunks.push(chars.slice(i, i + STEP).join(""));

  const probe = document.createElement("div");
  probe.setAttribute("aria-hidden", "true");
  probe.lang = lang;
  probe.style.cssText =
    "position:fixed;left:-9999px;top:0;opacity:0;pointer-events:none;contain:layout paint style;" +
    "white-space:nowrap;font:600 13px var(--font-body-stack, sans-serif)";
  let at = 0;
  let timer = 0;
  let dead = false;
  const step = () => {
    if (dead || at >= chunks.length) {
      probe.remove();
      return;
    }
    if (!probe.isConnected) document.body.appendChild(probe);
    probe.textContent = chunks[at++] ?? "";
    // Reading a size makes the browser lay the text out now, which is the point.
    void probe.offsetWidth;
    timer = window.setTimeout(step, 90);
  };
  timer = window.setTimeout(step, 0);
  return () => {
    dead = true;
    window.clearTimeout(timer);
    probe.remove();
  };
}
