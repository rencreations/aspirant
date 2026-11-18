/**
 * The strip (screens 8.2 to 11.3, tail 1.2): the psychoactive hero. The film stands as the 3.7 to 1
 * strip with its words, line, dots and arcs, and answers the pointer (the film plane's own hover
 * effects); a hover of "See All" swaps the two words at the bottom left. On the scroll the frame
 * grows to the window, the small words leave and the effects overlay goes, a play button and the
 * duration come in (a press opens the whole trailer in the site's player), then the window becomes the
 * leader of an orbit of the ten films under "Official animations for The Aspirants", and in the tail
 * the whole set flies off to the bottom right. The drone follows the journey and leaves in the pull.
 *
 * The film is driven by `film-state.ts` (a pure function of the scroll, shared with the rows, which
 * hand it over at joint J3); this runtime owns the words and chrome, the player, the keyboard and the
 * drone. Only transform and opacity are written, only when they change.
 */
import { put } from "@/features/character/vexana/seams/scroll-kit";

import { ensureDrone, type DroneActor } from "../../actors/drone";
import { newRoutePlace, routeAt, type DroneRoutePlace } from "../../drone-route";
import { ensureBackdrop, type Backdrop } from "../../fx/backdrop";
import { clamp, ramp } from "../../fx/image-field/math";
import {
  FILM_ORDER,
  ensureFilm,
  expandBox,
  sceneBox,
  type Box,
  type FilmActor,
} from "../../fx/video-plane";
import { makeState, type FilmState } from "../../fx/video-plane/types";
import type { FrameInfo, SectionCtx, SectionRuntime } from "../../kernel/types";
import { filmStateAt } from "./film-state";
import { sectionScreens, sectionStart } from "../../kernel/where";
import { backdropAt } from "../backdrops";
import { storyAt } from "../story";
import { makeBeats, stripBeats, stripS, type StripBeats } from "./journey";
import { LetterGroup } from "./letters";
import { scrambleAt } from "./scramble";
import { useStripPlayer } from "./store";
import { STRIP } from "../../content";

/** The scramble of a word swap: seconds in (the digest's 0.4) and out (0.45), and how often the noise changes. */
const SWAP_IN = 0.4;
const SWAP_OUT = 0.45;
const NOISE_HZ = 22;
/**
 * Where the page goes for a control that is not on screen (a fraction of the section). The plays rest
 * on a station for a position, so each is a place inside the dwell of the station that shows the
 * control: the small frame, the window with the play button, the orbit with its button.
 */
const FOCUS_AT = { small: 0.12, window: 0.48, hold: 0.72 } as const;
/** The ranges of the scroll (fractions of the section) in which each kind of control is on screen. */
const FOCUS_RANGE = { small: [-0.17, 0.29], window: [0.3, 0.64], hold: [0.65, 0.99] } as const;
/** The corner dots sit this far outside the frame's corners at rest and at the end of the expand (px). */
const DOT_OFF = [9, 48] as const;
/** The tick marks of the window stand this far outside its corners. */
const PLUS_OFF = 14;

const ease = (x: number): number => x * x * (3 - 2 * x);

type Kind = keyof typeof FOCUS_AT;

class StripRuntime implements SectionRuntime {
  private readonly beats: StripBeats = makeBeats();
  private readonly state: FilmState = makeState();
  private readonly route: DroneRoutePlace = newRoutePlace();
  private readonly box: Box = { x: 0, y: 0, w: 0, h: 0 };
  private readonly scene: Box = { x: 0, y: 0, w: 0, h: 0 };
  private readonly rect: Box = { x: 0, y: 0, w: 0, h: 0 };

  private readonly el: HTMLElement;
  private readonly letters: Record<string, LetterGroup> = {};
  private readonly cta: HTMLElement | null;
  private readonly videoWord: HTMLElement | null;
  private readonly bottom: HTMLElement | null;
  private readonly plus: HTMLElement[];
  private readonly windowBox: HTMLElement | null;
  private readonly play: HTMLElement | null;
  private readonly scrim: HTMLElement | null;
  private readonly amb: HTMLElement | null;
  private readonly ambScrim: HTMLElement | null;
  private readonly ambButton: HTMLElement | null;
  private readonly scroll: HTMLElement | null;
  private readonly swapEls: HTMLElement[];
  private readonly links: HTMLElement[];
  private readonly line: HTMLElement | null;
  private readonly ends: Record<string, HTMLElement | null>;
  private readonly corners: Record<string, HTMLElement | null>;
  private readonly cplus: Record<string, HTMLElement | null>;
  private readonly arcs: HTMLElement | null;

  /** The two words at the bottom left: which set is asked for, and the scramble that is running. */
  private swapShown = ["", ""];
  private swapTime = 1e9;
  private swapDur = SWAP_IN;
  private swapGoal = 0;
  private release: (() => void) | null = null;
  private playerOpen = false;
  private readonly cleanups: Array<() => void> = [];

  constructor(
    private readonly ctx: SectionCtx,
    private readonly film: FilmActor,
    private readonly drone: DroneActor | null,
    private readonly backdrop: Backdrop | null,
  ) {
    const text = ctx.dom.text;
    const below = ctx.dom.below;
    this.el = text.querySelector<HTMLElement>("[data-strip]") ?? text;
    const q = <T extends HTMLElement>(sel: string, root: ParentNode = text) =>
      root.querySelector<T>(sel);

    const groups = [
      "brand",
      "agency",
      "video",
      "coordl",
      "coordr",
      "wl",
      "wd",
      "ambl",
      "ambb",
      "ambt",
    ];
    groups.forEach((g, i) => (this.letters[g] = new LetterGroup(text, g, i + 1)));
    this.cta = q("[data-strip-cta]");
    this.videoWord = q('[data-strip-g="video"]');
    this.bottom = q('[data-strip-g="bottom"]');
    this.plus = Array.from(text.querySelectorAll<HTMLElement>("[data-strip-plus]"));
    this.windowBox = q("[data-strip-window]");
    this.play = q("[data-strip-play]");
    this.scrim =
      this.windowBox?.firstElementChild instanceof HTMLElement
        ? this.windowBox.firstElementChild
        : null;
    this.amb = q("[data-strip-amb]");
    this.ambScrim = q("[data-strip-amb-scrim]");
    this.ambButton = q("[data-strip-button]");
    this.scroll = q("[data-strip-scroll]");
    this.swapEls = Array.from(text.querySelectorAll<HTMLElement>("[data-strip-swap]"));
    this.links = Array.from(text.querySelectorAll<HTMLElement>("[data-strip-film]"));
    this.line = q("[data-strip-line]", below);
    this.ends = { l: q('[data-strip-end="l"]', below), r: q('[data-strip-end="r"]', below) };
    this.corners = {};
    this.cplus = {};
    for (const c of ["tl", "tr", "bl", "br"]) {
      this.corners[c] = q(`[data-strip-corner="${c}"]`, below);
      this.cplus[c] = q(`[data-strip-cplus="${c}"]`, below);
    }
    this.arcs = q("[data-strip-arcs]", below);
    this.swapShown = [STRIP.bottomLeft.rest[0], STRIP.bottomLeft.rest[1]];

    this.listen();
  }

  // ---------------------------------------------------------------------------------------------
  // The page

  update(v: number, frame: FrameInfo): void {
    const s = stripS(v);
    const S = storyAt("strip", s);
    const vp = frame.viewport;
    const b = stripBeats(s, this.beats);

    // Until the first play is over the rows' play is still running in step with it and draws the
    // film and the drone: this section only brings its words in.
    if (v >= 1) {
      this.driveFilm(S, b);
      this.driveDrone(S, vp);
    }
    const back = backdropAt(S);
    this.backdrop?.set(back.kind, back.options);
    this.writeSmall(b, vp);
    this.writeWindow(b, vp);
    this.writeSecond(b);
    this.stepSwap(frame.dt, b);
  }

  private driveFilm(S: number, b: StripBeats): void {
    const film = this.film;
    // Gone to the bottom right: nothing to draw, nothing for the pointer to find.
    if (b.fly >= 0.9999) return;
    filmStateAt(S, 0, this.state);
    film.show(this.state);
    film.setOrder(FILM_ORDER);
    film.setHover("signature");
    // The window is the one state in which the film can be played: the small frame and the orbit cannot.
    const grown = b.expand > 0.985 && b.pull < 0.02;
    film.setInteractive(!this.playerOpen);
    film.setHeroCursor(grown ? "PLAY" : null);
    film.onHeroClick(grown ? this.openPlayer : null);
    film.onPreviewClick(this.openFilm);
  }

  private driveDrone(S: number, vp: { readonly w: number; readonly h: number }): void {
    const drone = this.drone;
    if (!drone) return;
    const r = routeAt(S, vp, this.route);
    drone.visible = r.visible;
    drone.layer("back");
    drone.setInteractive(true);
    drone.look("pointer");
    drone.place(r);
  }

  // ---------------------------------------------------------------------------------------------
  // The small frame's words and chrome

  private writeSmall(b: StripBeats, vp: { readonly w: number; readonly h: number }): void {
    const L = this.letters;
    const enter = b.enter;
    const out = b.leave;
    const a = (from: number, to: number, o0: number, o1: number): number =>
      ramp(enter, from, to) * (1 - ramp(out, o0, o1));
    L.brand!.set(a(0.15, 0.85, 0.1, 0.55));
    L.agency!.set(a(0.2, 0.9, 0, 0.5));
    L.video!.set(a(0.35, 1, 0, 0.4));
    L.coordl!.set(a(0.1, 0.6, 0, 0.35));
    L.coordr!.set(a(0.1, 0.6, 0, 0.35));

    // The button and the two big words slide in from the sides and leave the other way (the reference's).
    const inCta = 1 - ease(ramp(enter, 0.25, 0.85));
    const outE = ease(out);
    put(this.cta, "transform", `translate3d(${(inCta * 175 + outE * 260).toFixed(2)}%,0,0)`);
    const ctaOpacity = ramp(enter, 0.25, 0.7) * (1 - ramp(out, 0, 0.45));
    put(this.cta, "opacity", ctaOpacity.toFixed(3));
    put(this.cta, "pointer-events", ctaOpacity > 0.5 ? "" : "none");
    put(this.videoWord, "transform", `translate3d(${(outE * 175).toFixed(2)}%,0,0)`);
    put(this.videoWord, "opacity", (1 - ramp(out, 0, 0.45)).toFixed(3));
    const inBottom = 1 - ease(ramp(enter, 0.25, 0.85));
    put(
      this.bottom,
      "transform",
      `translate3d(${(-(inBottom * 175 + outE * 175)).toFixed(2)}%,0,0)`,
    );
    put(this.bottom, "opacity", (ramp(enter, 0.2, 0.6) * (1 - ramp(out, 0, 0.45))).toFixed(3));
    const plus = ramp(enter, 0.35, 0.8) * (1 - ramp(out, 0, 0.3));
    for (const p of this.plus) {
      put(p, "transform", `scale(${plus.toFixed(3)})`);
      put(p, "opacity", plus.toFixed(3));
    }

    const scrollOn = ramp(enter, 0.5, 1) * (1 - ramp(out, 0, 0.4));
    put(this.scroll, "opacity", scrollOn.toFixed(3));
    put(this.scroll, "pointer-events", scrollOn > 0.5 ? "" : "none");

    this.writeChrome(b, vp);
  }

  /** The line, the dots, the arcs and the tick marks in the scene (under the film). */
  private writeChrome(b: StripBeats, vp: { readonly w: number; readonly h: number }): void {
    const sc = sceneBox(vp.w, vp.h, this.scene);
    const enterE = ease(ramp(b.enter, 0, 0.6));
    const out = ease(b.leave);
    const alive = enterE * (1 - out);
    put(this.line, "transform", `scaleX(${alive.toFixed(4)})`);
    // The two dots of the line travel apart with the frame and come together as it goes.
    const half = sc.w / 2;
    const shift = (half * (1 - alive)).toFixed(2);
    put(this.ends.l, "transform", `translate3d(${shift}px,0,0)`);
    put(this.ends.r, "transform", `translate3d(${(sc.w - half * (1 - alive)).toFixed(2)}px,0,0)`);
    put(this.ends.l, "opacity", enterE.toFixed(3));
    put(this.ends.r, "opacity", enterE.toFixed(3));

    // The four dots hang outside the frame's corners and drift outward as it grows, then go.
    const box = expandBox(vp.w, vp.h, b.expand, undefined, this.box);
    const off = DOT_OFF[0] + (DOT_OFF[1] - DOT_OFF[0]) * b.expand;
    const dotOpacity = enterE * (1 - ramp(b.expand, 0.55, 0.95));
    this.place(this.corners.tl, box.x - off - sc.x, box.y - off - sc.y, dotOpacity);
    this.place(this.corners.tr, box.x + box.w + off - sc.x, box.y - off - sc.y, dotOpacity);
    this.place(this.corners.bl, box.x - off - sc.x, box.y + box.h + off - sc.y, dotOpacity);
    this.place(this.corners.br, box.x + box.w + off - sc.x, box.y + box.h + off - sc.y, dotOpacity);

    // The window's own tick marks come in as it is opened and go as it is pulled into the orbit.
    const plus = b.windowIn * (1 - ramp(b.pull, 0, 0.2));
    this.place(this.cplus.tl, box.x - PLUS_OFF - sc.x, box.y - PLUS_OFF - sc.y, plus);
    this.place(this.cplus.tr, box.x + box.w + PLUS_OFF - sc.x, box.y - PLUS_OFF - sc.y, plus);
    this.place(this.cplus.bl, box.x - PLUS_OFF - sc.x, box.y + box.h + PLUS_OFF - sc.y, plus);
    this.place(
      this.cplus.br,
      box.x + box.w + PLUS_OFF - sc.x,
      box.y + box.h + PLUS_OFF - sc.y,
      plus,
    );

    // The faint arcs turn as they come in and as they leave.
    put(this.arcs, "opacity", (0.18 * alive * (1 - ramp(b.leave, 0, 0.34))).toFixed(3));
    put(this.arcs, "transform", `rotate(${(30 - (1 - enterE) * 60 + out * 120).toFixed(2)}deg)`);
  }

  private place(el: HTMLElement | null | undefined, x: number, y: number, opacity: number): void {
    put(el, "transform", `translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,0)`);
    put(el, "opacity", clamp(opacity).toFixed(3));
  }

  // ---------------------------------------------------------------------------------------------
  // The window and the second screen

  private writeWindow(b: StripBeats, vp: { readonly w: number; readonly h: number }): void {
    void vp;
    const L = this.letters;
    const up = b.windowIn * b.play;
    L.wl!.set(up);
    L.wd!.set(up);
    put(this.windowBox, "opacity", b.windowIn > 0 && b.play > 0 ? "1" : "0");
    put(this.scrim, "opacity", (0.9 * up).toFixed(3));
    put(this.play, "opacity", up.toFixed(3));
    put(this.play, "transform", `scale(${(0.7 + 0.3 * b.play * b.windowIn).toFixed(3)})`);
    put(this.play, "pointer-events", up > 0.5 ? "" : "none");
  }

  private writeSecond(b: StripBeats): void {
    const L = this.letters;
    const t = b.textIn;
    L.ambl!.set(t, 0.5);
    L.ambb!.set(t, 0.5);
    L.ambt!.set(ramp(t, 0.2, 0.6), 0.9);
    const button = ramp(t, 0.35, 0.85);
    put(this.ambButton, "opacity", button.toFixed(3));
    put(this.ambButton, "pointer-events", button > 0.6 ? "" : "none");
    put(this.amb, "opacity", t > 0 ? "1" : "0");
    put(this.ambScrim, "opacity", t.toFixed(3));
  }

  // ---------------------------------------------------------------------------------------------
  // The two words that swap on a hover of "See All"

  private setSwap(to: number): void {
    if (to === this.swapGoal) return;
    this.swapGoal = to;
    this.swapTime = 0;
    this.swapDur = to === 1 ? SWAP_IN : SWAP_OUT;
  }

  /** Runs the scramble with the frame's own time (a frozen frame holds it) and writes the words that changed. */
  private stepSwap(dt: number, b: StripBeats): void {
    // Out of the small state the words are at rest, so they are right when the visitor scrolls back.
    if (b.leave > 0.5 && this.swapGoal !== 0) {
      this.swapGoal = 0;
      this.swapTime = 1e9;
    }
    this.swapTime += Math.max(0, dt);
    const progress = clamp(this.swapTime / this.swapDur);
    const goal = this.swapGoal === 1 ? STRIP.bottomLeft.hover : STRIP.bottomLeft.rest;
    const tick = Math.floor(this.swapTime * NOISE_HZ);
    for (let slot = 0; slot < 2; slot++) {
      const el = this.swapEls[slot];
      if (!el) continue;
      const text = scrambleAt(goal[slot]!, progress, tick + slot * 7);
      if (text === this.swapShown[slot]) continue;
      this.swapShown[slot] = text;
      el.textContent = text;
    }
  }

  // ---------------------------------------------------------------------------------------------
  // Presses

  /** A press on the grown frame or its button: the trailer opens in the site's player. */
  private readonly openPlayer = (): void => {
    if (this.playerOpen) return;
    const r = this.film.heroRect(this.rect);
    useStripPlayer.getState().show(r ? { x: r.x, y: r.y, w: r.w, h: r.h } : null);
  };

  /** A press on a preview: its real link is pressed, so the page change is the site's own. */
  private readonly openFilm = (press: { index: number }): void => {
    this.links[press.index]?.click();
  };

  private listen(): void {
    const on = <E extends EventTarget>(
      target: E | null,
      type: string,
      handler: (e: Event) => void,
    ): void => {
      if (!target) return;
      target.addEventListener(type, handler);
      this.cleanups.push(() => target.removeEventListener(type, handler));
    };

    // The words at the bottom left follow the button: a mouse by the pointer, a keyboard by the focus,
    // a finger by the press (there is no hover on touch).
    on(this.cta, "pointerenter", (e) => {
      if ((e as PointerEvent).pointerType !== "touch") this.setSwap(1);
    });
    on(this.cta, "pointerleave", () => this.setSwap(0));
    on(this.cta, "pointerdown", () => this.setSwap(1));
    on(this.cta, "pointercancel", () => this.setSwap(0));
    on(this.cta, "pointerup", (e) => {
      if ((e as PointerEvent).pointerType === "touch") this.setSwap(0);
    });
    on(this.cta, "focus", () => this.setSwap(1));
    on(this.cta, "blur", () => this.setSwap(0));

    on(this.play, "click", () => this.openPlayer());
    on(this.scroll, "click", () => this.ctx.scroll.to(this.pageAt(FOCUS_AT.window)));

    // A control the page is not at: move to where it shows. This runs before the shell's own handler
    // (which goes to the middle of the section) and stops it.
    on(this.el, "focusin", (e) => {
      const kind = this.kindOf(e.target);
      if (!kind) return;
      e.stopPropagation();
      const now = (this.ctx.scroll.raw() - sectionStart("strip")) / sectionScreens("strip");
      const [from, to] = FOCUS_RANGE[kind];
      if (now >= from && now <= to) return;
      this.ctx.scroll.to(this.pageAt(FOCUS_AT[kind]), { immediate: true });
    });

    this.cleanups.push(
      useStripPlayer.subscribe((state, previous) => {
        if (state.open && !previous.open) {
          this.playerOpen = true;
          this.release?.();
          this.release = this.ctx.scroll.hold(10 * 60_000);
        } else if (!state.open && previous.open) {
          this.playerOpen = false;
          this.release?.();
          this.release = null;
        }
      }),
    );
  }

  /** The scroll position (screens) of a fraction of the section. */
  private pageAt(share: number): number {
    return sectionStart("strip") + share * sectionScreens("strip");
  }

  /** Which part of the section a control belongs to, for the keyboard. */
  private kindOf(target: EventTarget | null): Kind | null {
    if (!(target instanceof Element)) return null;
    if (target.closest("[data-strip-cta], [data-strip-scroll]")) return "small";
    if (target.closest("[data-strip-play]")) return "window";
    if (target.closest("[data-strip-film], [data-strip-button]")) return "hold";
    return null;
  }

  leave(): void {
    useStripPlayer.getState().close();
    this.release?.();
    this.release = null;
    this.playerOpen = false;
    this.setSwap(0);
  }

  dispose(): void {
    for (const off of this.cleanups) off();
    this.cleanups.length = 0;
    useStripPlayer.getState().close();
    this.release?.();
    this.release = null;
    for (const group of Object.values(this.letters)) group.clear();
  }
}

export async function createRuntime(ctx: SectionCtx): Promise<SectionRuntime> {
  const [film, drone, backdrop] = await Promise.all([
    ensureFilm(ctx),
    ensureDrone(ctx).catch(() => null),
    ensureBackdrop(ctx).catch(() => null),
  ]);
  return new StripRuntime(ctx, film, drone, backdrop);
}
