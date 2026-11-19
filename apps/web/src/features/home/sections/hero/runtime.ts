/**
 * The hero (screens 0 to 4.2): the logo and the splash cards of premotio's hero. The cards above the
 * logo leave first and gather at the bottom while the logo morphs into the bar with a travelling
 * wave, the cards spiral into the ring and land as the wall (joint J1, `scene.ts` and `timeline.ts`
 * say how). This runtime owns the logo (the field and the drone are driven by `FieldScene`, which the
 * aspirants section runs too) and the section's own DOM: the cue, and the h1's picture.
 *
 * The logo is built when the visitor is near the top (a reload part way down never builds it: the
 * bar's own logo is shown at once) and when they scroll back up to it.
 */
import { put } from "@/features/character/vexana/seams/scroll-kit";

import { ensureDrone, type DroneActor } from "../../actors/drone";
import { ensureBackdrop, type Backdrop } from "../../fx/backdrop";
import { ensureField, type FieldActor } from "../../fx/image-field";
import {
  ART_ASPECT,
  NavTargetWatch,
  ensureLogo,
  heroRect,
  showNavLogo,
  type LogoActor,
  type LogoPose,
} from "../../fx/logo";
import type { FrameInfo, SectionCtx, SectionRuntime } from "../../kernel/types";

import { BACKDROP_KINDS_USED, backdropAt } from "../backdrops";

import { ENTRANCE_SECONDS, FieldScene } from "./scene";
import { cueOpacity, heroS, logoP, ramp, smooth } from "./timeline";

/** The logo is built at mount only when the scroll is above this (screens): the morph ends at 1.3. */
const BUILD_ABOVE = 2.5;
/** On a stage whose pixel grid is not the page's the bar's logo is shown a little early and the actor fades under it. */
const SOFT_FROM = 0.96;
/** The big logo stands perfectly still at rest (the owner's call, 19 Nov 2026). It is the intro's own (`LOGO_REST_WAVE`): the two must match. The morph keeps its wave (`waveEnvelope`). */
const REST_WAVE = 0;
/** The cue sits this far under the logo (px, at least) and moves with the screen's height. */
const CUE_GAP = 0.045;
/** Where the bar's logo is from the top of the screen (px, about): the drone's eyes aim there. */
const BAR_Y = 39;

const mix = (a: number, b: number, t: number): number => a + (b - a) * t;

class HeroRuntime implements SectionRuntime {
  private readonly nav = new NavTargetWatch();
  private readonly scene: FieldScene;
  private readonly cue: HTMLElement | null;
  private readonly content: HTMLElement | null;
  private readonly domLogo: HTMLElement | null;
  private readonly pose: LogoPose = { wave: REST_WAVE };
  private readonly gaze = { x: 0, y: 0 };
  private logo: LogoActor | null;
  private logoFailed = false;
  private logoLoading = false;
  private entranceStart: number | null = null;
  private cueW = 0;
  private cueH = 0;
  private cueAt = Number.NaN;
  private disposed = false;

  constructor(
    private readonly ctx: SectionCtx,
    field: FieldActor,
    drone: DroneActor | null,
    logo: LogoActor | null,
    private readonly backdrop: Backdrop | null,
  ) {
    this.logo = logo;
    this.scene = new FieldScene(field, drone);
    this.cue = ctx.dom.text.querySelector<HTMLElement>("[data-home-cue]");
    this.content = ctx.dom.text.querySelector<HTMLElement>("[data-home-content]");
    this.domLogo = ctx.dom.text.querySelector<HTMLElement>("[data-home-dom-logo]");
  }

  update(local: number, frame: FrameInfo): void {
    const S = heroS(local);
    const vp = frame.viewport;
    const P = logoP(S);

    // The cards burst out of the ring once, when the page opens at the top.
    if (this.entranceStart === null) {
      this.entranceStart = S < 0.1 ? frame.time : frame.time - ENTRANCE_SECONDS - 1;
      if (this.content) this.content.dataset.entered = "1";
    }
    const entrance = ramp(frame.time - this.entranceStart, 0, ENTRANCE_SECONDS);
    const look = this.updateLogo(P, vp.w, vp.h);
    this.scene.update({ S, viewport: vp, entrance, look });
    const back = backdropAt(S);
    this.backdrop?.set(back.kind, back.options);
    this.updateCue(S, vp.w, vp.h);
  }

  /** Moves the logo and the bar's logo for the morph progress. Returns where the drone should look (the logo on its way up), or null. */
  private updateLogo(P: number, w: number, h: number): { x: number; y: number } | null {
    // Build the logo when it is wanted and not here (scrolled back up to it).
    if (!this.logo && !this.logoLoading && !this.logoFailed && P < 0.999) {
      this.logoLoading = true;
      ensureLogo(this.ctx).then(
        (actor) => {
          this.logoLoading = false;
          if (!this.disposed) this.logo = actor;
        },
        () => {
          this.logoLoading = false;
          this.logoFailed = true;
        },
      );
    }

    const logo = this.logo;
    const target = logo ? this.nav.get(w, h) : null;
    let handed = P >= 0.999;
    let drawn = false;
    if (logo) {
      const exact = !target || logo.matchesDom(target);
      const rect = heroRect(w, h);
      const pose = this.pose;
      // A grid the logo cannot match (a 3x phone): the bar's logo comes in over the actor's last
      // part and the actor fades under it.
      pose.opacity = exact ? 1 : 1 - smooth(P, SOFT_FROM, 0.999);
      logo.place(rect, pose);
      if (target) logo.morph(P, target);
      // Exact: the actor is the bar's logo at P = 1 and the bar takes over in the same frame. Soft: the
      // bar's logo shows from SOFT_FROM and the actor stays until it has faded away.
      handed = target ? (exact ? logo.handoff(P) : P >= SOFT_FROM) : false;
      logo.visible = !(target && (exact ? handed : P >= 0.999));
      drawn = logo.visible;
    }
    // No actor (a reload part way down, a failure): the bar's logo shows when the morph would
    // have ended, and always when the actor will never come.
    showNavLogo(logo ? handed : this.logoFailed || P >= 0.999);

    // The h1's picture is the plain page's logo: gone while the canvas draws, and once the bar has it.
    put(this.domLogo, "opacity", drawn || P >= 0.999 ? "0" : "1");

    // The drone watches the logo travel to the bar.
    if (!drawn || P < 0.02 || P > 0.98) return null;
    const rest = heroRect(w, h).cy;
    this.gaze.x = 0;
    this.gaze.y = mix(rest, h / 2 - BAR_Y, P);
    return this.gaze;
  }

  private updateCue(S: number, w: number, h: number): void {
    const cue = this.cue;
    if (!cue) return;
    if (w !== this.cueW || h !== this.cueH) {
      this.cueW = w;
      this.cueH = h;
      const rect = heroRect(w, h);
      const top = 0.47 * h + rect.width / ART_ASPECT / 2 + Math.max(24, CUE_GAP * h);
      put(cue, "top", `${top.toFixed(1)}px`);
    }
    if (Math.abs(S - this.cueAt) < 1e-5) return;
    this.cueAt = S;
    const o = cueOpacity(S);
    put(cue, "opacity", o.toFixed(3));
    put(cue, "transform", `translate3d(0, ${((1 - o) * -14).toFixed(2)}px, 0)`);
  }

  dispose(): void {
    this.disposed = true;
    this.scene.dispose();
    this.nav.dispose();
    put(this.domLogo, "opacity", "1");
    for (const prop of ["top", "opacity", "transform"]) this.cue?.style.removeProperty(prop);
    if (this.content) delete this.content.dataset.entered;
  }
}

/**
 * Build the hero: the picture field and the drone (shared with the aspirants and every section
 * after), and the logo when the visitor is near the top. The drone failing is not the hero failing.
 */
export async function createRuntime(ctx: SectionCtx): Promise<SectionRuntime> {
  const needsLogo = ctx.scroll.raw() < BUILD_ABOVE;
  const [field, drone, logo, backdrop] = await Promise.all([
    ensureField(ctx),
    ensureDrone(ctx).catch(() => null),
    needsLogo ? ensureLogo(ctx).catch(() => null) : Promise.resolve(null),
    ensureBackdrop(ctx).catch(() => null),
  ]);
  // Compile the first four kinds now, so the first frame of the backdrop is not a hitch.
  void backdrop?.warm(BACKDROP_KINDS_USED);
  return new HeroRuntime(ctx, field, drone, logo, backdrop);
}
