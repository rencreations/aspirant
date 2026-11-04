/**
 * The chapter morph that is running, if any. The card, the Before link and the pulls start one;
 * the layer in the root layout (`MorphLayer`) draws it and survives the change of page. One at a
 * time: a second start while one runs is ignored.
 */
import type { Route } from "next";
import { create } from "zustand";

import type { ChapterEntry } from "@/content/story-types";

import type { ReaderTheme } from "../reader/prefs";

interface JobBase {
  readonly id: number;
  /** Where the morph goes. */
  readonly href: Route;
  readonly theme: ReaderTheme;
  readonly textScale: number;
  /** Started from the keyboard: the heading it lands on shows its focus ring. */
  readonly keyboard: boolean;
}

export type MorphJob =
  /** The card at the foot of a chapter opens into the next chapter's title card. */
  | (JobBase & {
      readonly kind: "forward";
      readonly entry: ChapterEntry;
      readonly door: HTMLElement;
    })
  /** The card after the last chapter opens into the end page. */
  | (JobBase & { readonly kind: "end"; readonly from: ChapterEntry; readonly door: HTMLElement })
  /** The pull up at the top: this chapter's title card closes into the card of the chapter before. */
  | (JobBase & { readonly kind: "back"; readonly entry: ChapterEntry })
  /** The Before link: the title card of the chapter before unrolls from the top. */
  | (JobBase & { readonly kind: "blind"; readonly entry: ChapterEntry });

type WithoutId<T> = T extends unknown ? Omit<T, "id"> : never;

export type MorphRequest = WithoutId<MorphJob>;

interface MorphState {
  readonly job: MorphJob | null;
}

export const useMorph = create<MorphState>()(() => ({ job: null }));

let nextId = 1;

/** Start a morph. False when one is already running. */
export function startMorph(request: MorphRequest): boolean {
  if (useMorph.getState().job) return false;
  useMorph.setState({ job: { ...request, id: nextId++ } as MorphJob });
  return true;
}

export function endMorph(id: number): void {
  if (useMorph.getState().job?.id === id) useMorph.setState({ job: null });
}

export function isMorphing(): boolean {
  return useMorph.getState().job !== null;
}

/** The overlay's code, fetched ahead (a card on the page asks for it) so a morph starts at once. */
export const loadOverlay = () => import("./overlay");
