import { CHARACTER_NAMES, isCharacterSlug } from "@/lib/slugs";

import type { ModelItem } from "./types";

/** 1536 gives "1.5 KB", 4300000 gives "4.1 MB". */
export function humanBytes(n: number): string {
  if (n < 1024) return `${Math.round(n)} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10 * 1024 ? 1 : 0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/** A thousands separated count: 31620 gives "31,620". */
export function count(n: number): string {
  return n.toLocaleString("en-US");
}

/** Two digits: 3 gives "03". */
export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** The camera's angle round the model as whole degrees, 0 to 359 (0 is the front). */
export function azimuthDegrees(radians: number): number {
  const deg = Math.round((radians * 180) / Math.PI);
  return ((deg % 360) + 360) % 360;
}

/** The name of the Aspirant a model shows ("Vexana"), or its title when it names nobody. */
export function whoOf(item: Pick<ModelItem, "chars" | "title">): string {
  const slug = item.chars[0] ?? "";
  return isCharacterSlug(slug) ? CHARACTER_NAMES[slug] : item.title;
}

/** The index of the model with this id, or 0 (the first) when the id is empty or unknown. */
export function indexOfId(items: ReadonlyArray<{ id: string }>, id: string): number {
  const at = items.findIndex((i) => i.id === id);
  return at < 0 ? 0 : at;
}

/** The index `step` places on from `from`, round the ends (the picker has no end). */
export function stepIndex(from: number, step: number, length: number): number {
  if (length <= 0) return 0;
  return (((from + step) % length) + length) % length;
}

/**
 * The order the models are fetched in behind the first screen: the one on show first, then the
 * ones next to it in the picker, nearest first (after it, then before it), so the model a visitor
 * is most likely to pick next is the one that arrives first.
 */
export function fetchOrder(length: number, start: number): number[] {
  const order: number[] = [];
  for (let k = 0; order.length < length; k += 1) {
    for (const i of k === 0 ? [start] : [start + k, start - k]) {
      if (i >= 0 && i < length && !order.includes(i)) order.push(i);
    }
  }
  return order;
}

/** The fraction (0 to 1) a download has reached, never above `cap` until it is done. */
export function fractionOf(received: number, total: number, cap = 0.99): number {
  return total > 0 ? Math.min(cap, received / total) : 0;
}
