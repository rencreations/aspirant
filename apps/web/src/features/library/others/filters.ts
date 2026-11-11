import { CHARACTER_NAMES, isCharacterSlug } from "@/lib/slugs";

import type { OthersGroupId, OthersItem, SkillItem } from "./types";

/** The sections of the page, in the order they are drawn. */
export const SECTION_ORDER: readonly OthersGroupId[] = [
  "emotes",
  "gameplay",
  "skills",
  "site",
  "more",
];

/** Short names for the section chips. The long titles are in the data file. */
export const SECTION_CHIP_LABEL: Readonly<Record<OthersGroupId, string>> = {
  emotes: "Emotes",
  gameplay: "Gameplay",
  skills: "Skill icons",
  site: "Site art",
  more: "More",
};

export function isSection(value: string): value is OthersGroupId {
  return (SECTION_ORDER as readonly string[]).includes(value);
}

/**
 * The 3D models left this room for `/collection/models` and their ids changed from
 * `others-3d-<name>` to `models-<name>`. The new id for an old one, or null for any other id.
 */
export function modelIdOfOldLink(id: string): string | null {
  return id.startsWith("others-3d-") ? `models-${id.slice("others-3d-".length)}` : null;
}

/** Everything a search can match in an item, lower case. */
function searchText(item: OthersItem): string {
  const who = item.chars.map((c) => (isCharacterSlug(c) ? CHARACTER_NAMES[c] : c)).join(" ");
  const parts: string[] = [item.title, item.tags.join(" "), who, item.note ?? ""];
  if (item.kind === "skill") parts.push(item.label);
  if (item.kind === "gameplay") parts.push(item.caption);
  if (item.kind === "site") parts.push(item.setLabel);
  if (item.kind === "link") parts.push(item.line);
  return parts.join(" ").toLowerCase();
}

/** True when every word of the query is somewhere in the item. An empty query matches everything. */
export function matches(item: OthersItem, query: string): boolean {
  const words = query.toLowerCase().split(/\s+/u).filter(Boolean);
  if (words.length === 0) return true;
  const text = searchText(item);
  return words.every((w) => text.includes(w));
}

type ByGroup = Record<OthersGroupId, OthersItem[]>;

/** The items that match the query, sorted into their sections (the data order is kept). */
export function itemsByGroup(items: readonly OthersItem[], query: string): ByGroup {
  const out: ByGroup = { emotes: [], gameplay: [], skills: [], site: [], more: [] };
  for (const item of items) {
    if (matches(item, query)) out[item.group].push(item);
  }
  return out;
}

/**
 * The sections to draw. One chosen section shows alone. With a search, only the sections that
 * have a match. With neither, every section.
 */
export function visibleSections(
  by: ByGroup,
  section: OthersGroupId | "",
  query: string,
): OthersGroupId[] {
  if (section) return [section];
  const searching = query.trim() !== "";
  return SECTION_ORDER.filter((id) => !searching || by[id].length > 0);
}

/** The skill icons grouped by character, in the order the data lists them. */
export function skillsByCharacter(
  items: readonly SkillItem[],
): Array<{ slug: string; name: string; items: SkillItem[] }> {
  const out: Array<{ slug: string; name: string; items: SkillItem[] }> = [];
  for (const item of items) {
    const slug = item.chars[0] ?? "";
    let row = out.find((r) => r.slug === slug);
    if (!row) {
      row = { slug, name: isCharacterSlug(slug) ? CHARACTER_NAMES[slug] : slug, items: [] };
      out.push(row);
    }
    row.items.push(item);
  }
  return out;
}

/** The images of "Made for this site" grouped by set, in data order. */
export function siteBySet<T extends { set: string; setLabel: string }>(
  items: readonly T[],
): Array<{ set: string; label: string; items: T[] }> {
  const out: Array<{ set: string; label: string; items: T[] }> = [];
  for (const item of items) {
    let row = out.find((r) => r.set === item.set);
    if (!row) {
      row = { set: item.set, label: item.setLabel, items: [] };
      out.push(row);
    }
    row.items.push(item);
  }
  return out;
}

/** 1536 gives "1.5 KB", 4300000 gives "4.1 MB". */
export function humanBytes(n: number): string {
  if (n < 1024) return `${Math.round(n)} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10 * 1024 ? 1 : 0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/** Seconds as "0:07". */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** A stable small tilt in degrees for sticker number `i` (the wall looks hand placed, never random per load). */
export function stickerTilt(i: number): number {
  const steps = [-3.2, 2.4, -1.4, 3.1, -2.6, 1.6, -3.6, 2.9, -0.8];
  return steps[((i % steps.length) + steps.length) % steps.length] ?? 0;
}
