/**
 * The footer (screens 59.1 to 60.3): the card of hairlines stands, the drone rests in its ring (joint
 * J15), bows, and the hairline under the owner's line fills as the end of the page comes. Near the
 * end the drone leaves to the right, at the height and size where About's opening drone comes in from
 * the right (`route.ts`), so the two read as one drone changing page. This is the scroll's way out;
 * `setExitHook` is the other (the button and the N key from anywhere): the page change waits for a
 * short dart of the drone off the screen.
 *
 * The drone's place is `droneAt` (the same function the archive's runtime uses for its part): the
 * archive writes it up to 58.6 and this runtime from there, so the order they run in cannot matter.
 * What is glued to the page's own flow (the ring in the footer's card, which rises and then sticks)
 * is read from the scene `S`: the kernel moves the card to where the scene is (the page can be a
 * little ahead of the scene on a hard scroll), so the two never part.
 */
import { put } from "@/features/character/vexana/seams/scroll-kit";

import { ensureDrone, type DroneActor } from "../../actors/drone";
import { SIZE_PER_HEIGHT } from "../../actors/drone/model";
import type { FrameInfo, SectionCtx, SectionRuntime } from "../../kernel/types";
import { stripGeo, type StripGeo } from "../archive/geometry";
import {
  AT,
  aboutEntry,
  droneAt,
  footFor,
  hairAt,
  setFoot,
  toStage,
  type Spot,
} from "../archive/route";

import { exitBridge } from "./exit-bridge";

/** The dart that answers the button and the N key. */
const DART_MS = 450;
/** The dart never holds the page change longer than this (a hidden tab draws no frames). */
const SAFETY_MS = 1400;
/** The scene is this close to the end of the page (screens): the scroll's way to About may go. */
const SETTLED_WITHIN = 0.04;
/** From here the scroll's own exit has already taken the drone away: nothing to wait for. */
const GONE_AT = AT.end - 0.06;

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
const mix = (a: number, b: number, k: number): number => a + (b - a) * k;

class FooterRuntime implements SectionRuntime {
  private readonly stageEl: HTMLElement;
  private readonly ring: HTMLElement | null;
  private readonly fill: HTMLElement | null;
  private readonly observer: ResizeObserver | null;
  private readonly onResize = (): void => {
    this.measure();
  };

  private strip: StripGeo;
  private w = 0;
  private h = 0;
  private running = false;
  private lastS = 0;
  private seenHair = Number.NaN;

  private readonly spot: Spot = { x: 0, y: 0, height: 0 };
  private readonly stage: Spot = { x: 0, y: 0, height: 0 };
  /** The drone's last place of the scroll's route (screen frame), where a dart starts from. */
  private readonly last: Spot = { x: 0, y: 0, height: 0 };

  private dart: { t0: number; from: Spot } | null = null;
  private dartDone: (() => void) | null = null;
  private dartTimer = 0;

  constructor(
    private readonly ctx: SectionCtx,
    private readonly drone: DroneActor | null,
  ) {
    this.stageEl = ctx.dom.text;
    this.ring = this.stageEl.querySelector<HTMLElement>("[data-footer-ring]");
    this.fill = this.stageEl.querySelector<HTMLElement>("[data-footer-fill]");
    const vp = ctx.viewport();
    this.strip = stripGeo(vp.w, vp.h);
    this.measure();
    window.addEventListener("resize", this.onResize);
    this.observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(this.onResize);
    this.observer?.observe(this.stageEl);
    void document.fonts?.ready.then(this.onResize);
    exitBridge.run = () => this.exit();
    exitBridge.settled = () => !this.running || this.lastS >= AT.end - SETTLED_WITHIN;
  }

  /** Where the ring is, relative to the footer's stage. The stage moves with the scroll, so only the difference counts. */
  private measure(): void {
    const ring = this.ring;
    if (!ring) return;
    const s = this.stageEl.getBoundingClientRect();
    const r = ring.getBoundingClientRect();
    if (r.width < 1) return;
    setFoot({ x: r.left + r.width / 2, offY: r.top + r.height / 2 - s.top, size: r.width });
  }

  enter(): void {
    this.running = true;
    this.dart = null;
  }

  leave(): void {
    this.running = false;
  }

  update(local: number, frame: FrameInfo): void {
    const S = AT.stuck + local * (AT.end - AT.stuck);
    const prev = this.lastS;
    this.lastS = S;
    const vp = frame.viewport;
    if (vp.w !== this.w || vp.h !== this.h) {
      this.w = vp.w;
      this.h = vp.h;
      this.strip = stripGeo(vp.w, vp.h);
      this.measure();
    }
    const foot = footFor(vp);

    // The hairline: full at the point where the page opens About.
    const hair = Math.round(hairAt(S) * 500) / 500;
    if (hair !== this.seenHair) {
      this.seenHair = hair;
      put(this.fill, "transform", `scaleX(${hair})`);
    }

    const drone = this.drone;
    if (!drone) return;
    droneAt(S, frame.S, 9, vp, this.strip, foot, this.spot);
    this.last.x = this.spot.x;
    this.last.y = this.spot.y;
    this.last.height = this.spot.height;
    this.flyDart(vp);
    toStage(vp, this.spot, this.stage);

    drone.visible = true;
    drone.layer("front");
    drone.setInteractive(true);
    drone.place(this.stage);
    drone.face(S >= AT.exitFrom ? "sparkle" : "happy", 1);
    // It bows when it reaches the card (a pose of the actor, made once and given back).
    const bow = S > AT.stuck + 0.04 && S < AT.stuck + 0.32;
    drone.pose(bow ? "thanks" : null);
    // It leaves with a roll: only when the scroll carries it past the start of the exit, not on a jump.
    if (prev < AT.exitFrom && S >= AT.exitFrom && S - prev < 0.3) drone.trickNow("barrel");
    const pointer = this.ctx.pointer.state;
    drone.look(pointer.inside && pointer.type === "mouse" ? "pointer" : null);
  }

  /** The dart of the exit hook: from where the route has the drone to the point where About's drone comes in. */
  private flyDart(vp: { w: number; h: number }): void {
    const dart = this.dart;
    if (!dart) return;
    const now = performance.now();
    if (dart.t0 < 0) {
      dart.t0 = now;
      dart.from.x = this.last.x;
      dart.from.y = this.last.y;
      dart.from.height = this.last.height;
    }
    const u = clamp01((now - dart.t0) / DART_MS);
    const enter = aboutEntry(vp);
    const e = u * u;
    this.spot.x = mix(dart.from.x, vp.w + 1.2 * enter.size, e);
    this.spot.y =
      mix(dart.from.y, enter.y, u * u * (3 - 2 * u)) - Math.sin(Math.PI * u) * 0.05 * vp.h;
    this.spot.height = mix(dart.from.height, enter.size / SIZE_PER_HEIGHT, u);
    if (u >= 1) this.finishDart();
  }

  private finishDart(): void {
    window.clearTimeout(this.dartTimer);
    const done = this.dartDone;
    this.dartDone = null;
    done?.();
  }

  /**
   * The exit hook: the page change waits for this. It never hangs: it resolves at once when the
   * drone is not on the footer or the scroll has already taken it out, when the dart ends, and after a
   * safety time (a hidden tab draws no frames).
   */
  private exit(): Promise<void> {
    if (!this.running || !this.drone || this.lastS < AT.handover || this.lastS >= GONE_AT) {
      return Promise.resolve();
    }
    if (this.dart) return Promise.resolve();
    this.dart = { t0: -1, from: { x: 0, y: 0, height: 0 } };
    return new Promise<void>((resolve) => {
      this.dartDone = resolve;
      this.dartTimer = window.setTimeout(() => {
        this.finishDart();
      }, SAFETY_MS);
    });
  }

  dispose(): void {
    if (exitBridge.run) exitBridge.run = null;
    exitBridge.settled = null;
    this.finishDart();
    this.observer?.disconnect();
    window.removeEventListener("resize", this.onResize);
    setFoot(null);
    this.fill?.style.removeProperty("transform");
  }
}

export async function createRuntime(ctx: SectionCtx): Promise<SectionRuntime> {
  const drone = await ensureDrone(ctx).catch(() => null);
  return new FooterRuntime(ctx, drone);
}
