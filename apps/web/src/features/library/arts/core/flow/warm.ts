/** Pictures that arrived and showed once: a tile that stands again fades in no more. */
const LIMIT = 3000;
const shown = new Set<string>();

export function noteShown(url: string): void {
  if (shown.size >= LIMIT) shown.clear();
  shown.add(url);
}

export function wasShown(url: string): boolean {
  return shown.has(url);
}
