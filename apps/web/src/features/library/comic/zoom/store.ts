/**
 * The change of page into a comic that is running, if any. A press on "Read the comic" of an official
 * comic starts a dive into its first panel; a press on a fan comic starts a halftone wipe. The layer
 * in the root layout (`ComicLayer`) draws it and survives the change of page. One at a time: a start
 * while one runs is refused.
 */
import { create } from "zustand";

import { audio } from "@/lib/audio";
import { routeItems } from "@/lib/route-preloads";
import { runPreload } from "@/lib/preload";

import type { ComicItem, StagePanel } from "../types";

interface JobBase {
  readonly id: number;
  /** The comic's own address. */
  readonly href: string;
  readonly comic: ComicItem;
}

export type ComicJob =
  /** The stage of an official comic zooms into its first panel and the reader takes its place. */
  | (JobBase & {
      readonly kind: "dive";
      /** The section that holds the stage, the stage itself and the picture of its first panel. */
      readonly section: HTMLElement;
      readonly stage: HTMLElement;
      readonly img: HTMLImageElement;
      readonly panel: StagePanel;
    })
  /** A fan comic: a wipe of halftone dots from the press, then back out from the middle. */
  | (JobBase & { readonly kind: "wipe"; readonly x: number; readonly y: number });

type WithoutId<T> = T extends unknown ? Omit<T, "id"> : never;

export type ComicRequest = WithoutId<ComicJob>;

interface ComicState {
  readonly job: ComicJob | null;
}

export const useComicJob = create<ComicState>()(() => ({ job: null }));

let nextId = 1;

/** Start a change of page. False when one is already running. */
export function startComicJob(request: ComicRequest): boolean {
  if (useComicJob.getState().job) return false;
  audio.blip("click");
  useComicJob.setState({ job: { ...request, id: nextId++ } as ComicJob });
  return true;
}

export function endComicJob(id: number): void {
  if (useComicJob.getState().job?.id === id) useComicJob.setState({ job: null });
}

/** The layer's code, fetched ahead (the room asks for it) so a press starts at once. */
export const loadComicLayer = () => import("./overlay");

const warmed = new Set<string>();

/**
 * Warm what a comic's page needs (its data, the reader's code and its first pages) before anyone
 * presses, so the change of page is not waiting for them. The layer's code comes with it.
 */
export function warmComic(href: string): void {
  void loadComicLayer();
  if (warmed.has(href)) return;
  warmed.add(href);
  void runPreload(routeItems(href), () => undefined);
}
