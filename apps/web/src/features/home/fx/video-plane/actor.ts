/**
 * The film plane as an actor of the home's one stage: the trailer on a rounded plane that leans in
 * the picture field's rows, stands upright as the strip, opens to the full window and becomes the
 * leader of an orbit of ten preview films, and then leaves with them to the bottom right. A section
 * drives it with one call a frame:
 *
 *   film.show({ morph, expand, pull, fly, ... })   the whole state (anything left out is the default)
 *
 * Every video is a real `<video>` kept off the page (`video.ts`); a texture follows each. Only the
 * planes a visitor can see play. The poses are a pure function of the state and the orbit's drift
 * (`scene.ts`); what is integrated here is the hover (an ease for each plane), the orbit's slow
 * drift and the clock of the shader. `docs/design/home/fx-video-plane.md` has the API, the numbers
 * and the way to look at it.
 */
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  LineSegments,
  type PerspectiveCamera,
  Scene,
  ShaderMaterial,
  type WebGLRenderer,
} from "three";

import type { ActorCtx } from "../../actors/shared/types";
import { makePixelPerspectiveCamera, pixelFov } from "../../kernel/stage";
import type { Actor, FrameInfo, HitTarget, Pass } from "../../kernel/types";
import { clamp, qMul, type Q } from "../image-field/math";
import { lowpassGain } from "../image-field/spring";
import { PREVIEWS, TRAILER_FILM, previewAspect, type PreviewFilm } from "./data";
import { TRAIL_POINTS, trailOf } from "./flyoff";
import { boundsOf, contentWindow, inQuad, planeQuad, pointerOnPlane } from "./hit";
import {
  HOVER_MODES,
  HOVER_RATE,
  TILT,
  tiltQuat,
  type HoverMode,
  type HoverWeights,
} from "./hover";
import { ORBIT_DRIFT, trainPlace } from "./orbit";
import { PlaneView, disposePlaneGeometry, type PlaneLook } from "./plane";
import { composeScene, makePoses } from "./scene";
import { TRAIL_FRAGMENT, TRAIL_VERTEX } from "./shader";
import {
  DEFAULT_STATE,
  PLANE_COUNT,
  makeState,
  type FilmState,
  type PlanePose,
  type Vp,
} from "./types";
import { WINDOW_ASPECT } from "./layout";
import { trailerStream, type StreamStatus, type TrailerStream } from "./stream";
import { FilmVideo } from "./video";

/** Above the picture field (12) and under the logo (15), the drones (25, 35), Tetra (27), the cast (30) and the marks (40). */
export const FILM_ORDER = 13;

/** The planes hidden this many frames in a row pause their videos. */
const IDLE_FRAMES = 10;
/** Frames with no time passing (a frozen probe) before the videos hold still. */
const FROZEN_FRAMES = 3;
/** How far a hovered preview comes toward the camera (px at z = 0) and how much it grows. */
const LIFT = 36;
const GROW = 0.07;
/** A plane fainter than this is not hit and not hovered. */
const HIT_OPACITY = 0.25;
/** A plane has to be at least this visible to be drawn. */
const DRAW_OPACITY = 0.003;
/**
 * The trailer's thin loading line shows only when the film has been waiting this long (ms): a short
 * stall holds the last frame and shows nothing. The line itself is real (seconds in hand over the
 * seconds it needs), this only delays when it appears.
 */
const LINE_AFTER_MS = 1200;
/** How fast the loading line comes and goes (per second). */
const LINE_RATE = 5;

/** What a press on a preview reports. */
export interface PreviewPress {
  /** 0 to 9, the film's place in the collection's list. */
  index: number;
  film: PreviewFilm;
}

/** The pass the stage draws: a thin shell over the actor, whose order may change. */
class FilmPass implements Pass {
  readonly name = "film";
  order = FILM_ORDER;
  moving = false;

  constructor(private readonly owner: FilmActor) {}

  active(): boolean {
    return this.owner.isDrawn();
  }

  render(renderer: WebGLRenderer): void {
    this.owner.draw(renderer);
  }

  resize(w: number, h: number): void {
    this.owner.resized(w, h);
  }

  rebuild(): void {
    this.owner.rebuilt();
  }

  dispose(): void {
    if (!this.moving) this.owner.disposeGpu();
  }
}

/** The one hit target of the film: the nearest plane under the pointer. */
class FilmHit implements HitTarget {
  readonly id = "film";

  constructor(private readonly owner: FilmActor) {}

  get cursor(): string | undefined {
    return this.owner.labelOfCandidate() ?? undefined;
  }

  test(x: number, y: number): number | null {
    return this.owner.hitDepth(x, y);
  }

  leave(): void {
    this.owner.hoverLeft();
  }

  press(x: number, y: number): void {
    this.owner.pressed(x, y);
  }

  release(x: number, y: number): void {
    this.owner.released(x, y);
  }
}

export class FilmActor implements Actor {
  readonly name = "film";
  visible = false;

  private readonly scene = new Scene();
  private readonly camera: PerspectiveCamera;
  private readonly videos: FilmVideo[] = [];
  private readonly views: PlaneView[] = [];
  private readonly poses = makePoses();
  private readonly bases = makePoses();
  private readonly quads: Array<[number, number, number, number, number, number, number, number]> =
    [];
  private readonly quadOk: boolean[] = [];
  private readonly looks: PlaneLook[] = [];
  private readonly hover = new Float64Array(PLANE_COUNT);
  private readonly trailGeometry: BufferGeometry;
  private readonly trailMaterial: ShaderMaterial;
  private readonly trails: LineSegments;
  private readonly trailPoints = new Float32Array(TRAIL_POINTS * 2);
  private readonly pass: FilmPass;
  private removePass: () => void;
  private readonly removeHit: () => void;
  private readonly stream: TrailerStream;

  private vp: Vp = { w: 1, h: 1 };
  private readonly state: FilmState = makeState();
  private weights: HoverWeights = { ...HOVER_MODES.signature };
  private lens = 1000;
  private time = 0;
  private drift = 0;
  private updated = false;
  private idleFrames = 0;
  private frozenFrames = 0;
  private hasQuads = false;
  private disposed = false;
  private interactive = true;
  private hoverIdx = -1;
  private candidate = -1;
  private pressIdx = -1;
  private pressX = 0;
  private pressY = 0;
  private labelShown: string | null = null;
  private heroLabel: string | null = null;
  private previewLabel: ((i: number, film: PreviewFilm) => string | null) | null = (_i, film) =>
    film.title;
  private heroClick: (() => void) | null = null;
  private previewClick: ((press: PreviewPress) => void) | null = null;
  private readonly local: [number, number] = [0, 0];
  private readonly win: [number, number, number, number] = [0.5, 0.5, 1, 1];
  private readonly tilt: Q = [0, 0, 0, 1];
  private readonly qOut: Q = [0, 0, 0, 1];
  private readonly rect = { x: 0, y: 0, w: 0, h: 0 };
  private updateMs = 0;
  private drawMs = 0;
  /** The trailer's loading line: how visible it is, and how long the film has been waiting (ms). */
  private line = 0;
  private waitingMs = 0;

  constructor(private readonly ctx: ActorCtx) {
    const { stage } = ctx;
    const vp = ctx.viewport();
    this.vp = { w: vp.w, h: vp.h };
    const anisotropy = Math.min(8, stage.renderer.capabilities.getMaxAnisotropy());
    this.camera = makePixelPerspectiveCamera(vp.w, vp.h);
    this.stream = trailerStream();

    const hero = new FilmVideo(
      {
        path: TRAILER_FILM.key,
        w: TRAILER_FILM.w,
        h: TRAILER_FILM.h,
        bytes: TRAILER_FILM.bytes,
        background: false,
      },
      anisotropy,
      this.stream,
    );
    this.videos.push(hero);
    for (const film of PREVIEWS) {
      this.videos.push(
        new FilmVideo(
          { path: film.path, w: 560, h: 286, bytes: film.bytes, background: true },
          anisotropy,
        ),
      );
    }
    for (let k = 0; k < PLANE_COUNT; k++) {
      const color = k === 0 ? "#1d1b2b" : PREVIEWS[k - 1]!.color;
      const view = new PlaneView(
        this.videos[k]!.texture,
        color,
        k === 0 ? "film-hero" : `film-${k}`,
      );
      this.views.push(view);
      this.scene.add(view.mesh);
      this.quads.push([0, 0, 0, 0, 0, 0, 0, 0]);
      this.quadOk.push(false);
      this.looks.push({
        win: [0.5, 0.5, 1, 1],
        ready: 0,
        hover: 0,
        pointerX: 0,
        pointerY: 0,
        lens: 0,
        split: 0,
        time: 0,
        phase: k * 1.7,
        light: 0.28,
        shadow: 0,
        load: 0,
        loadFraction: 0,
      });
    }

    // The trails: the path of each item in flight, as faint segments (a trail is made of the line it rides).
    const segs = PLANE_COUNT * (TRAIL_POINTS - 1);
    this.trailGeometry = new BufferGeometry();
    this.trailGeometry.setAttribute("position", new BufferAttribute(new Float32Array(segs * 6), 3));
    this.trailGeometry.setAttribute("aA", new BufferAttribute(new Float32Array(segs * 2), 1));
    this.trailMaterial = new ShaderMaterial({
      // Ink blue on the light page (the trails were pale on the dark one).
      uniforms: { uColor: { value: new Color(0.1, 0.16, 0.36) }, uAlpha: { value: 0.32 } },
      vertexShader: TRAIL_VERTEX,
      fragmentShader: TRAIL_FRAGMENT,
      transparent: true,
      premultipliedAlpha: true,
      depthTest: false,
      depthWrite: false,
    });
    this.trailMaterial.toneMapped = false;
    this.trails = new LineSegments(this.trailGeometry, this.trailMaterial);
    this.trails.frustumCulled = false;
    this.trails.renderOrder = 10;
    this.trails.visible = false;
    this.scene.add(this.trails);

    this.pass = new FilmPass(this);
    this.removePass = stage.addPass(this.pass);
    this.removeHit = ctx.pointer.add(new FilmHit(this));
    stage.renderer.compile(this.scene, this.camera);
    // The trailer loads as soon as the actor exists (its list waits for it); the previews behind it.
    for (const v of this.videos) v.start();
  }

  // ---------------------------------------------------------------------------------------------
  // What a section sets

  /**
   * The state of the film for this frame. Everything left out takes its default, so a section never
   * leaves something of an earlier frame behind. Also shows the film (the kernel hides every actor
   * before the sections run). Passing no state shows the strip at rest.
   */
  show(partial?: Partial<FilmState>): void {
    Object.assign(this.state, DEFAULT_STATE);
    this.state.heroBox = null;
    if (partial) Object.assign(this.state, partial);
    this.visible = true;
  }

  /** Which hover effects are on: a named mode, or the three amounts. */
  setHover(mode: HoverMode | HoverWeights): void {
    this.weights = typeof mode === "string" ? { ...HOVER_MODES[mode] } : { ...mode };
  }

  /** Hover, press and the cursor label. Off while something covers the film (the player, a preview). */
  setInteractive(on: boolean): void {
    this.interactive = on;
  }

  /** The word the site's cursor shows over the trailer (null for none). */
  setHeroCursor(label: string | null): void {
    this.heroLabel = label;
  }

  /**
   * The word the site's cursor shows over a preview. A function of the preview's place and film
   * (the default is the film's title), a plain word, or null for none.
   */
  setPreviewCursor(label: string | ((i: number, film: PreviewFilm) => string | null) | null): void {
    this.previewLabel = typeof label === "string" ? () => label : label;
  }

  /** A press on the trailer. */
  onHeroClick(handler: (() => void) | null): void {
    this.heroClick = handler;
  }

  /** A press on a preview. */
  onPreviewClick(handler: ((press: PreviewPress) => void) | null): void {
    this.previewClick = handler;
  }

  /** Move the pass: `FILM_ORDER` (over the field, under the logo and the drones) or any other. */
  setOrder(order: number): void {
    if (order === this.pass.order || this.disposed) return;
    this.pass.moving = true;
    this.removePass();
    this.pass.moving = false;
    this.pass.order = order;
    this.removePass = this.ctx.stage.addPass(this.pass);
  }

  /** Pause every video (a section that leaves). They resume by themselves when the film is shown. */
  pause(): void {
    for (const v of this.videos) v.pause();
  }

  // ---------------------------------------------------------------------------------------------
  // What a section asks

  /** The film's id and where it opens in the collection, for preview `i` (0 to 9). */
  filmId(i: number): string | null {
    return PREVIEWS[i]?.id ?? null;
  }

  film(i: number): PreviewFilm | null {
    return PREVIEWS[i] ?? null;
  }

  /** The index of the preview under the pointer (0 to 9), or -1 (the trailer is not a preview). */
  get hoveredPreview(): number {
    return this.hoverIdx - 1;
  }

  /** The trailer's first frame is in the texture (a section may hold `expectReady` until then). */
  get heroReady(): boolean {
    return this.videos[0]!.ready;
  }

  get heroHovered(): boolean {
    return this.hoverIdx === 0;
  }

  /** Where the trailer is on the screen: the box of its quad, CSS px from the top left. Null when it is not drawn. */
  heroRect(out: { x: number; y: number; w: number; h: number } = this.rect): typeof out | null {
    return this.rectOf(0, out);
  }

  /** Where preview `i` (0 to 9) is on the screen. */
  previewRect(
    i: number,
    out: { x: number; y: number; w: number; h: number } = this.rect,
  ): typeof out | null {
    return this.rectOf(i + 1, out);
  }

  private rectOf(
    k: number,
    out: { x: number; y: number; w: number; h: number },
  ): typeof out | null {
    if (!this.quadOk[k] || this.poses[k]!.opacity < DRAW_OPACITY) return null;
    return boundsOf(this.quads[k]!, out);
  }

  /** The pose of plane `k` (0 the trailer) as last drawn, for probes and tests. Do not write it. */
  poseOf(k: number): Readonly<PlanePose> {
    return this.poses[k]!;
  }

  /** The lens the film was last drawn through. */
  get lensDistance(): number {
    return this.lens;
  }

  /** What the probes read: the videos, the frame costs, the state. Plain data. */
  debug(): Record<string, unknown> {
    return {
      trailer: TRAILER_FILM.key,
      stream: {
        ...this.stream.status,
        retries: this.stream.retries,
        events: [...this.stream.events],
      },
      line: this.line,
      lens: this.lens,
      hover: this.hoverIdx,
      drift: this.drift,
      state: { ...this.state },
      updateMs: this.updateMs,
      drawMs: this.drawMs,
      videos: this.videos.map((v, k) => {
        const q = v.el.getVideoPlaybackQuality();
        return {
          k,
          ready: v.ready,
          playing: v.playing,
          time: Number(v.el.currentTime.toFixed(2)),
          readyState: v.el.readyState,
          frames: v.frames,
          dropped: q.droppedVideoFrames,
          decoded: q.totalVideoFrames,
          version: v.texture.version,
        };
      }),
    };
  }

  // ---------------------------------------------------------------------------------------------
  // The frame

  update(frame: FrameInfo): void {
    if (this.disposed) return;
    const t0 = performance.now();
    const dt = Math.max(0, frame.dt);
    this.time += dt;
    // The orbit drifts only while it is there, so it starts from the same composition every time.
    this.drift = this.state.pull > 0 ? this.drift + dt * ORBIT_DRIFT : 0;
    this.idleFrames = 0;
    this.frozenFrames = dt > 0 ? 0 : this.frozenFrames + 1;
    const vp = this.vp;
    const st = this.state;
    const poses = this.poses;

    this.lens = composeScene(vp, st, this.drift, poses, this.bases);

    // Who is under the pointer (by the quads of the last frame, as the kernel's own test saw them).
    const p = this.ctx.pointer.state;
    const live = this.interactive && (p.inside || p.down) && st.fly <= 0.001;
    const idx = live && p.hit === "film" ? this.pick(p.x, p.y) : -1;
    if (idx !== this.hoverIdx) {
      this.hoverIdx = idx;
      if (p.hit === "film") this.showLabel(this.labelOf(idx));
    }

    const rate = lowpassGain(HOVER_RATE, dt);
    const w = this.weights;
    const win = this.win;
    for (let k = 0; k < PLANE_COUNT; k++) {
      const pose = poses[k]!;
      const look = this.looks[k]!;
      const video = this.videos[k]!;
      const h = (this.hover[k] =
        this.hover[k]! + ((k === this.hoverIdx ? 1 : 0) - this.hover[k]!) * rate);

      // The hover lifts a preview toward the viewer and leans the frame toward the pointer.
      let px = 0;
      let py = 0;
      if (h > 0.002) {
        if (k === this.hoverIdx && pointerOnPlane(p.x, p.y, pose, this.lens, vp, this.local)) {
          px = clamp(this.local[0], -0.5, 0.5);
          py = clamp(this.local[1], -0.5, 0.5);
        }
        const preview = k > 0;
        const lift = preview ? h : 0.0;
        pose.z += LIFT * lift;
        const grow = 1 + (preview ? GROW : 0.012) * h;
        pose.w *= grow;
        pose.h *= grow;
        if (preview) pose.order += Math.round(300 * h);
        if (w.tilt > 0) {
          // A big frame leans less: the same angle moves its edge much further toward the camera.
          tiltQuat(
            px * 2,
            py * 2,
            h * w.tilt * clamp(560 / Math.max(1, pose.w), 0.35, 1),
            this.tilt,
          );
          qMul(this.tilt, pose.q, this.qOut);
          pose.q[0] = this.qOut[0];
          pose.q[1] = this.qOut[1];
          pose.q[2] = this.qOut[2];
          pose.q[3] = this.qOut[3];
        }
      }

      // The picture's window: the trailer's frame is a 16 to 9 cover of the film (a plane wider than
      // that shows a band of it), a preview shows its clip whole.
      const aspect = pose.w / Math.max(1, pose.h);
      const zoom = 1 + TILT.zoom * h * w.tilt;
      if (k === 0) {
        // The frame that covers the picture is 16 to 9 in the strip and the film's own shape once the
        // window is open (so the whole picture shows), and it changes with the expand.
        contentWindow(
          aspect,
          WINDOW_ASPECT + (st.aspect - WINDOW_ASPECT) * st.expand,
          video.spec.w / video.spec.h,
          st.focusX,
          st.focusY,
          zoom,
          px * TILT.shift * h * w.tilt,
          -py * TILT.shift * h * w.tilt,
          win,
        );
      } else {
        // A preview shows its whole clip at its own shape.
        const own = previewAspect(PREVIEWS[k - 1]!);
        contentWindow(
          aspect,
          own,
          own,
          0.5,
          0.5,
          zoom,
          px * TILT.shift * h * w.tilt,
          -py * TILT.shift * h * w.tilt,
          win,
        );
      }
      look.win[0] = win[0];
      look.win[1] = win[1];
      look.win[2] = win[2];
      look.win[3] = win[3];

      // The picture fades in once its first frame is decoded.
      if (video.ready) video.shown = Math.min(1, video.shown + dt / 0.25);
      look.ready = video.shown;
      look.load = k === 0 ? this.line : 0;
      look.loadFraction = k === 0 ? this.stream.status.progress : 0;
      // The cards of the orbit stand on the light page with a soft shadow. The trailer wears one as it
      // becomes the orbit's leader (the pull), so the ten and the leader agree; it has none before.
      look.shadow = k === 0 ? st.pull : 1;
      look.hover = h;
      look.pointerX = px;
      look.pointerY = py;
      look.lens = w.lens * h;
      look.split = w.split * h;
      look.time = this.time;
      this.views[k]!.write(pose, look);
      this.views[k]!.mesh.visible = pose.opacity > DRAW_OPACITY && pose.w > 1;
    }

    this.updateQuads();
    this.playPolicy(dt);
    this.writeTrails();
    this.updated = true;
    this.hasQuads = true;
    this.updateMs += (performance.now() - t0 - this.updateMs) * 0.05;
  }

  /** The quads of the planes as drawn, and which are on the screen. */
  private updateQuads(): void {
    for (let k = 0; k < PLANE_COUNT; k++) {
      const pose = this.poses[k]!;
      this.quadOk[k] =
        pose.opacity > DRAW_OPACITY && planeQuad(pose, this.lens, this.vp, this.quads[k]!);
    }
  }

  /**
   * The trailer waits for more picture (its stream ran out, or is being fetched again) or has no
   * first frame yet. The plane keeps the last good frame; the thin line shows only if this lasts.
   */
  private stepLine(dt: number, heroPlays: boolean): void {
    const waiting = heroPlays && (this.stream.status.stalled || !this.videos[0]!.ready);
    this.waitingMs = waiting ? this.waitingMs + dt * 1000 : 0;
    const goal = this.waitingMs > LINE_AFTER_MS ? 1 : 0;
    this.line += (goal - this.line) * lowpassGain(LINE_RATE, dt);
    if (this.line < 0.002 && goal === 0) this.line = 0;
  }

  /** What the trailer's stream knows now, for a section that wants a word of its own about it. */
  get heroBuffer(): Readonly<StreamStatus> {
    return this.stream.status;
  }

  /** Play what is on the screen, pause the rest. A frozen scene holds its video still too. */
  private playPolicy(dt: number): void {
    const frozen = this.frozenFrames >= FROZEN_FRAMES;
    const st = this.state;
    for (let k = 0; k < PLANE_COUNT; k++) {
      const v = this.videos[k]!;
      const pose = this.poses[k]!;
      let want = !frozen && this.quadOk[k]! && pose.opacity > 0.02;
      if (want && k > 0 && st.pull <= 0) want = false;
      if (want) {
        const b = boundsOf(this.quads[k]!, this.rect);
        want = b.x < this.vp.w && b.y < this.vp.h && b.x + b.w > 0 && b.y + b.h > 0;
      }
      if (want) v.play();
      else if (v.playing || v.wantsPlay) v.pause();
      if (k === 0) this.stepLine(dt, want);
    }
    // The stream looks at its own playback a few times a second (a stall, the loop, a stuck download).
    this.stream.update(performance.now());
  }

  private writeTrails(): void {
    const f = this.state.fly;
    if (f <= 0.001 || f >= 0.999) {
      this.trails.visible = false;
      return;
    }
    const pos = this.trailGeometry.getAttribute("position") as BufferAttribute;
    const alpha = this.trailGeometry.getAttribute("aA") as BufferAttribute;
    const pa = pos.array as Float32Array;
    const aa = alpha.array as Float32Array;
    const per = TRAIL_POINTS - 1;
    let any = false;
    for (let k = 0; k < PLANE_COUNT; k++) {
      const n = trailOf(this.vp, trainPlace(k), this.bases[k]!, f, this.trailPoints, 0);
      for (let j = 0; j < per; j++) {
        const s = (k * per + j) * 6;
        const a = (k * per + j) * 2;
        if (n === 0) {
          pa[s] = pa[s + 1] = pa[s + 2] = pa[s + 3] = pa[s + 4] = pa[s + 5] = 0;
          aa[a] = aa[a + 1] = 0;
          continue;
        }
        any = true;
        pa[s] = this.trailPoints[j * 2]!;
        pa[s + 1] = this.trailPoints[j * 2 + 1]!;
        pa[s + 2] = 0;
        pa[s + 3] = this.trailPoints[j * 2 + 2]!;
        pa[s + 4] = this.trailPoints[j * 2 + 3]!;
        pa[s + 5] = 0;
        const a0 = 1 - j / per;
        const a1 = 1 - (j + 1) / per;
        aa[a] = a0 * a0;
        aa[a + 1] = a1 * a1;
      }
    }
    pos.needsUpdate = true;
    alpha.needsUpdate = true;
    this.trails.visible = any;
  }

  // ---------------------------------------------------------------------------------------------
  // Pointer

  /** The plane under a point (CSS px), the one in front when several overlap, or -1. */
  private pick(x: number, y: number): number {
    if (!this.hasQuads || !this.interactive) return -1;
    let best = -1;
    let bestOrder = -Infinity;
    let bestZ = -Infinity;
    for (let k = 0; k < PLANE_COUNT; k++) {
      const pose = this.poses[k]!;
      if (!this.quadOk[k] || pose.opacity < HIT_OPACITY) continue;
      if (pose.order < bestOrder || (pose.order === bestOrder && pose.z <= bestZ)) continue;
      if (inQuad(this.quads[k]!, x, y, k === this.hoverIdx ? 4 : 0)) {
        best = k;
        bestOrder = pose.order;
        bestZ = pose.z;
      }
    }
    return best;
  }

  /** The kernel's hit test: the depth of the plane under the point (smaller is nearer), or null. */
  hitDepth(x: number, y: number): number | null {
    if (!this.visible || !this.interactive || !this.hasQuads || this.state.fly > 0.001) {
      this.candidate = -1;
      return null;
    }
    const k = this.pick(x, y);
    this.candidate = k;
    if (k < 0) return null;
    // The same metric as the picture field's (lens minus z), with the painter's order as a small bias.
    return this.lens - this.poses[k]!.z - this.poses[k]!.order * 0.01;
  }

  private labelOf(k: number): string | null {
    if (k < 0) return null;
    if (k === 0) return this.heroLabel;
    const film = PREVIEWS[k - 1];
    return film && this.previewLabel ? this.previewLabel(k - 1, film) : null;
  }

  /** The label of the plane the kernel is about to enter (read by the hit target's cursor). */
  labelOfCandidate(): string | null {
    return this.labelOf(this.candidate);
  }

  private showLabel(label: string | null): void {
    if (label === this.labelShown) return;
    this.labelShown = label;
    this.ctx.cursor.set(label);
  }

  hoverLeft(): void {
    this.labelShown = null;
    this.candidate = -1;
  }

  pressed(x: number, y: number): void {
    this.pressIdx = this.pick(x, y);
    this.pressX = x;
    this.pressY = y;
  }

  released(x: number, y: number): void {
    const was = this.pressIdx;
    this.pressIdx = -1;
    if (was < 0) return;
    if (Math.hypot(x - this.pressX, y - this.pressY) > 12) return;
    if (this.pick(x, y) !== was) return;
    if (was === 0) this.heroClick?.();
    else {
      const film = PREVIEWS[was - 1];
      if (film) this.previewClick?.({ index: was - 1, film });
    }
  }

  // ---------------------------------------------------------------------------------------------
  // Drawing

  /** True when the stage should draw this pass. A pass that is not drawn for a while pauses its videos. */
  isDrawn(): boolean {
    if (this.visible && this.updated && !this.disposed) return true;
    if (!this.visible && ++this.idleFrames === IDLE_FRAMES) {
      this.pause();
      this.trails.visible = false;
      this.hoverIdx = -1;
      this.hover.fill(0);
    }
    return false;
  }

  draw(renderer: WebGLRenderer): void {
    const t0 = performance.now();
    this.fitCamera(this.lens);
    renderer.render(this.scene, this.camera);
    this.updated = false;
    this.drawMs += (performance.now() - t0 - this.drawMs) * 0.05;
  }

  private fitCamera(d: number): void {
    const cam = this.camera;
    const fov = pixelFov(this.vp.h, d);
    if (cam.position.z === d && cam.fov === fov && cam.aspect === this.vp.w / this.vp.h) return;
    cam.fov = fov;
    cam.aspect = this.vp.w / Math.max(1, this.vp.h);
    cam.position.z = d;
    cam.near = d * 0.01;
    cam.far = d * 40;
    cam.updateProjectionMatrix();
  }

  // ---------------------------------------------------------------------------------------------
  // The stage's calls

  resized(w: number, h: number): void {
    if (this.disposed || (w === this.vp.w && h === this.vp.h)) return;
    this.vp = { w, h };
    this.hasQuads = false;
    this.updated = false;
  }

  /** The GL context was made again: every frame has to be uploaded once more. */
  rebuilt(): void {
    if (this.disposed) return;
    for (const v of this.videos) v.rebuilt();
  }

  disposeGpu(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.removeHit();
    this.showLabel(null);
    for (const v of this.videos) v.dispose();
    for (const view of this.views) view.dispose();
    disposePlaneGeometry();
    this.trailGeometry.dispose();
    this.trailMaterial.dispose();
  }

  dispose(): void {
    if (this.disposed) return;
    this.removePass();
    this.disposeGpu();
  }
}
