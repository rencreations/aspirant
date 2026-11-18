/**
 * The logo as an actor of the home's one stage: the Aspirants logo as a finely cut quad, drawn in
 * its own pass (`LOGO_ORDER`, above the flat field at ortho 10, below the drones at perspective 20
 * and the lit cast at 30). A section drives it with a few setters every frame it shows the logo:
 *
 *   place(rect, pose)      the big logo, in a rect, with an optional pose, wave, sag and reveal
 *   carryBetween(a, b)     the big logo held at two points of the screen (two drones)
 *   morph(P, navTarget)    the reel's corner stagger and a travelling wave, ending on the nav logo
 *   handoff(P)             true from P = 1: show the DOM logo and hide this actor in the same frame
 *
 * The actor reads neither the scroll nor the DOM. What moves by itself (the sag's spring, the ripple,
 * the wave's drift) is integrated in `update`. `docs/design/home/fx-logo.md` has the whole story.
 */
import { Group, Object3D } from "three";

import type { ActorCtx } from "../../actors/shared/types";
import type { Actor, FrameInfo } from "../../kernel/types";
import { LogoMesh } from "./mesh";
import {
  ART,
  ART_CENTRE,
  HANDOFF_AT,
  REG,
  SOCKETS,
  clamp,
  heroRect,
  heroTextureSize,
  heroArtWidth,
  isHandedOff,
  makeWarp,
  navRasterPlan,
  phaseAt,
  rectFromGrabs,
  rectHeight,
  rectScale,
  sagDepthFor,
  sameNavTarget,
  smoothstep,
  warpPoint,
  waveEnvelope,
  type LogoRect,
  type NavRaster,
  type NavTarget,
  type Point3,
  type SocketName,
} from "./math";
import { heroCanvasFor, MASK_H, MASK_W, OVERSAMPLE, rasterMask, rasterNav } from "./raster";

/** The pass of the logo: after the flat field, before the drones and the cast. */
export const LOGO_ORDER = 15;

/** How the big logo stands. Every field is optional and means "none" when left out. */
export interface LogoPose {
  /** Turn in the picture plane, radians (counter clockwise). */
  roll?: number;
  /** Tip about the horizontal axis, radians (the top comes toward the camera when positive). */
  tilt?: number;
  /** Turn about the vertical axis, radians (the right side goes away when positive). */
  yaw?: number;
  /** A calm travelling ripple at rest, 0 to 1 (0 is none). */
  wave?: number;
  /** 0 hidden to 1 drawn: the logo rises into place under a front that crosses it. Default 1. */
  reveal?: number;
  /** How taut it is held between its two ends: 1 is flat, 0 hangs loose and heavy. Default 1. */
  tension?: number;
  /** -1 to 1: the heaviest part swings to one side (drive it from the carriers' bob). Default 0. */
  wobble?: number;
  /** 0 to 1: the whole logo's opacity (the fade after a hand-off that does not match to the pixel). Default 1. */
  opacity?: number;
}

/** What a socket reports: where a hand may hold the logo, and which way the logo runs there. */
const SOCKET_NAMES = Object.keys(SOCKETS) as SocketName[];

/** The spring of the sag: a little under critical, so a pull makes it bounce. */
const SAG_OMEGA = 10;
const SAG_ZETA = 0.38;
/** A step in the sag target bigger than this snaps (a jump must not leave the spring flying). */
const SAG_SNAP = 0.75;
/** Pointer ripple: strength while hovered, how fast it follows, how fast it dies. */
const RIPPLE_HOVER = 0.55;
const RIPPLE_FOLLOW = 7;
const RIPPLE_DECAY = 2.4;
/** Wave drift in cycles per second: calm at rest, quicker while the progress moves. */
const DRIFT_REST = 0.3;
const DRIFT_MOVING = 0.9;
/** The distance, in logo units, along the logo over which a socket's heading is measured. */
const HEADING_SPAN = 60;

export class LogoActor implements Actor {
  readonly name = "logo";
  visible = false;
  readonly object = new Group();

  private readonly mesh: LogoMesh;
  private readonly warp = makeWarp();
  private readonly sockets = new Map<SocketName, Object3D>();
  private readonly removeHit: () => void;
  private readonly mask: Uint8Array;

  private rest: LogoRect | null = null;
  private pose: Required<LogoPose> = {
    roll: 0,
    tilt: 0,
    yaw: 0,
    wave: 0,
    reveal: 1,
    tension: 1,
    wobble: 0,
    opacity: 1,
  };
  private P = 0;
  private target: NavTarget | null = null;

  // What the actor integrates by itself.
  private sag = 0;
  private sagV = 0;
  private sagTarget = 0;
  private drift = 0;
  private lastP = 0;
  private activity = 0;
  private ripple = 0;
  private ripTime = 0;
  private ripX = 0;
  private ripY = 0;
  private hovered = false;
  private hoverX = 0;
  private hoverY = 0;

  // What the textures were made for.
  private heroW = 0;
  private heroDpr = 0;
  private navPlan: NavRaster | null = null;
  private navFor: NavTarget | null = null;
  private navDpr = 0;
  private vw = 1;
  private vh = 1;
  private readonly scratch: Point3 = { x: 0, y: 0, z: 0 };
  private readonly scratch2: Point3 = { x: 0, y: 0, z: 0 };
  private readonly scratch3: Point3 = { x: 0, y: 0, z: 0 };

  constructor(private readonly ctx: ActorCtx) {
    const { stage } = ctx;
    const vp = ctx.viewport();
    this.vw = vp.w;
    this.vh = vp.h;
    const heroCanvas = heroCanvasFor(heroArtWidth(vp.w, vp.h), vp.dpr);
    this.heroW = heroCanvas.width;
    this.heroDpr = vp.dpr;
    // A 1 by 1 canvas stands in for the nav texture until a target arrives.
    const blank = document.createElement("canvas");
    blank.width = 1;
    blank.height = 1;
    this.mesh = new LogoMesh(heroCanvas, blank, this.anisotropy());
    this.mask = rasterMask();

    this.object.name = "logo";
    this.object.add(this.mesh.mesh);
    for (const name of SOCKET_NAMES) {
      const socket = new Object3D();
      socket.name = `logo-socket-${name}`;
      this.sockets.set(name, socket);
      this.object.add(socket);
    }
    stage.scenePass("logo", "perspective", LOGO_ORDER).scene.add(this.object);
    this.object.visible = false;

    this.removeHit = ctx.pointer.add({
      id: "logo",
      test: (x, y) => this.hitTest(x, y),
      enter: () => {
        this.hovered = true;
      },
      leave: () => {
        this.hovered = false;
      },
      move: (x, y) => {
        this.hoverAt(x, y);
      },
      press: (x, y) => {
        this.hoverAt(x, y);
        this.ripple = Math.max(this.ripple, 1);
      },
    });
  }

  // ---------------------------------------------------------------------------------------------
  // What a section sets

  /**
   * Put the big logo in a rect (stage frame, the art's centre and width) with a pose, and stand it
   * at rest (`P` = 0). Call it first, then `morph` if the logo travels. Everything left out of the
   * pose is "none", so a section that sets the logo every frame never leaves a pose behind.
   */
  place(rect: LogoRect, pose: LogoPose = {}): void {
    this.rest = { cx: rect.cx, cy: rect.cy, width: rect.width };
    const p = this.pose;
    p.roll = pose.roll ?? 0;
    p.tilt = pose.tilt ?? 0;
    p.yaw = pose.yaw ?? 0;
    p.wave = clamp(pose.wave ?? 0);
    p.reveal = clamp(pose.reveal ?? 1);
    p.tension = clamp(pose.tension ?? 1);
    p.wobble = clamp(pose.wobble ?? 0, -1, 1);
    p.opacity = clamp(pose.opacity ?? 1);
    this.P = 0;
  }

  /**
   * Hold the logo at two points of the screen (the two hands of two drones), its `left` and `right`
   * sockets on them. The scale and the turn follow from the distance and the slope of the two
   * points. `pose.tension` and `pose.wobble` shape the hang between them.
   */
  carryBetween(
    left: { x: number; y: number },
    right: { x: number; y: number },
    pose: LogoPose = {},
  ): void {
    const grab = rectFromGrabs(SOCKETS.left, SOCKETS.right, left, right);
    this.place(grab.rect, { ...pose, roll: grab.roll + (pose.roll ?? 0) });
  }

  /**
   * The morph: `P` 0 is the rect given to `place`, 1 is the nav logo (`target`, from
   * `readNavTarget`). The corners leave one after the other, a wave runs along the logo, and the
   * last frame is the bar's logo to the pixel. Reversible: it is a pure function of `P`.
   */
  morph(P: number, target: NavTarget): void {
    this.P = clamp(P);
    this.target = target;
  }

  /**
   * True from `P` = 1. The section shows the DOM logo (`hideLogo: false`) and sets `visible = false`
   * in the same frame; both ways, because below 1 the actor draws exactly what the bar would.
   */
  handoff(P: number): boolean {
    return isHandedOff(P);
  }

  /** A knock: the sag swings (a drone stumbles, the logo is let go). `amount` about -1 to 1. */
  jolt(amount: number): void {
    this.sagV += amount * 3;
  }

  /** A ripple from a point of the screen (stage frame). */
  poke(x: number, y: number, strength = 1): void {
    const l = this.logoPoint(x + this.vw / 2, this.vh / 2 - y);
    this.ripX = l.x;
    this.ripY = l.y;
    this.ripple = Math.max(this.ripple, clamp(strength));
  }

  /**
   * A point of the logo that something holds: it follows the bend, the sag and the pose, and its
   * rotation is the heading of the logo there. It is in the logo's own scene: copy its world
   * position and rotation to a drone each frame, never `attach` another actor's root to it (the
   * root would leave its own pass and be drawn by this one).
   */
  socket(name: SocketName): Object3D {
    const s = this.sockets.get(name);
    if (!s) throw new Error(`no socket ${name}`);
    return s;
  }

  /** The rect the logo was last placed in (the default hero rect before the first `place`). */
  currentRect(): LogoRect {
    return this.rest ?? heroRect(this.vw, this.vh);
  }

  /**
   * Does the last frame of `morph` equal the bar's logo to the pixel? True when the canvas and the
   * page share a pixel grid (the stage's ratio is the page's). When it is false (a phone at 3x, a
   * 4K screen at 200 percent, where the stage's budget lowers its ratio) the actor is the same shape
   * in the same place but a little softer, so a section fades it out (`pose.opacity`, about 140 ms)
   * under the bar's logo instead of swapping in one frame.
   */
  matchesDom(target: NavTarget): boolean {
    return Math.abs(target.domDpr - this.ctx.viewport().dpr) < 0.01;
  }

  /** Numbers for the probes: the textures and the warp as they are. */
  info(): {
    hero: { w: number; h: number };
    nav: { w: number; h: number } | null;
    P: number;
    env: number;
    sag: number;
    handoffAt: number;
  } {
    const size = heroTextureSize(heroArtWidth(this.vw, this.vh), this.heroDpr, OVERSAMPLE);
    return {
      hero: size,
      nav: this.navPlan ? { w: this.navPlan.w, h: this.navPlan.h } : null,
      P: this.P,
      env: this.warp.env,
      sag: this.sag,
      handoffAt: HANDOFF_AT,
    };
  }

  // ---------------------------------------------------------------------------------------------
  // Each frame

  update(frame: FrameInfo): void {
    const { w, h, dpr } = frame.viewport;
    this.vw = w;
    this.vh = h;
    const dt = frame.dt;

    this.syncHero(w, h, dpr);
    this.syncNav(dpr);
    this.integrate(dt);

    const rest = this.rest ?? heroRect(w, h);
    const warp = this.warp;
    const target = this.target;
    const P = this.P;
    warp.P = P;
    warp.fromX = rest.cx;
    warp.fromY = rest.cy;
    warp.fromK = rectScale(rest);
    if (target && P > 0) {
      warp.toX = target.rect.cx;
      warp.toY = target.rect.cy;
      warp.toK = rectScale(target.rect);
    } else {
      warp.toX = warp.fromX;
      warp.toY = warp.fromY;
      warp.toK = warp.fromK;
    }
    warp.roll = this.pose.roll;
    warp.tilt = this.pose.tilt;
    warp.yaw = this.pose.yaw;
    warp.env = waveEnvelope(P, this.pose.wave);
    warp.phase = phaseAt(P) + this.drift;
    // The bend is not weighted by the corner stagger, so it lets go as the morph starts: the
    // nav logo is never bent, whatever the spring was doing.
    warp.sag.depth = sagDepthFor(this.sag) * (1 - smoothstep(0, 0.2, P));
    warp.sag.xL = SOCKETS.left.x;
    warp.sag.xR = SOCKETS.right.x;
    warp.sag.y = SOCKETS.left.y;
    warp.sag.wobble = clamp(this.pose.wobble, -1, 1);
    const plan = this.navPlan;
    const exact = target !== null && plan !== null && Math.abs(target.domDpr - this.navDpr) < 0.01;
    warp.snapX = exact ? plan.snapX : 0;
    warp.snapY = exact ? plan.snapY : 0;
    warp.ripX = this.ripX;
    warp.ripY = this.ripY;
    warp.rip = this.ripple * (1 - smoothstep(0.02, 0.2, P));
    warp.ripT = this.ripTime;
    warp.reveal = this.pose.reveal;
    warp.opacity = this.pose.opacity;

    this.mesh.apply(warp);
    this.moveSockets();
  }

  dispose(): void {
    this.removeHit();
    this.mesh.dispose();
    this.object.removeFromParent();
    this.sockets.clear();
  }

  // ---------------------------------------------------------------------------------------------
  // Inside

  private anisotropy(): number {
    return Math.min(8, this.ctx.stage.renderer.capabilities.getMaxAnisotropy());
  }

  /** The hero texture is made for the largest the logo is placed at: re-made only when that changes. */
  private syncHero(w: number, h: number, dpr: number): void {
    const want = heroTextureSize(heroArtWidth(w, h), dpr, OVERSAMPLE).w;
    if (dpr === this.heroDpr && Math.abs(want - this.heroW) / this.heroW <= 0.1) return;
    const canvas = heroCanvasFor(heroArtWidth(w, h), dpr);
    this.mesh.setHero(canvas, this.anisotropy());
    this.heroW = canvas.width;
    this.heroDpr = dpr;
  }

  /** The nav texture is made when a target arrives and again when the bar or the pixel ratio changes. */
  private syncNav(dpr: number): void {
    const target = this.target;
    if (!target || this.P < 0.4) return;
    if (sameNavTarget(this.navFor, target) && dpr === this.navDpr) return;
    const plan = navRasterPlan(target, dpr);
    this.mesh.setNav(rasterNav(plan), plan);
    this.navPlan = plan;
    this.navFor = target;
    this.navDpr = dpr;
  }

  private integrate(dt: number): void {
    const p = this.pose;
    // The sag: a spring toward the hang the tension asks for. A big step snaps.
    const target = 1 - p.tension;
    if (Math.abs(target - this.sagTarget) > SAG_SNAP) {
      this.sag = target;
      this.sagV = 0;
    }
    this.sagTarget = target;
    if (dt > 0) {
      const a = -SAG_OMEGA * SAG_OMEGA * (this.sag - target) - 2 * SAG_ZETA * SAG_OMEGA * this.sagV;
      this.sagV += a * dt;
      this.sag += this.sagV * dt;
      this.sag = clamp(this.sag, -0.25, 1.25);
    }

    // The wave drifts a little by itself, quicker while the progress moves.
    if (dt > 0) {
      const speed = Math.abs(this.P - this.lastP) / dt;
      this.activity += (clamp(speed * 1.5) - this.activity) * (1 - Math.exp(-8 * dt));
      this.drift += dt * (DRIFT_REST + DRIFT_MOVING * this.activity);
      this.ripTime += dt;
    }
    this.lastP = this.P;

    // The pointer's ripple: follows the pointer while it is over the logo, dies when it leaves.
    if (dt > 0) {
      if (this.hovered) {
        const follow = 1 - Math.exp(-RIPPLE_FOLLOW * dt);
        this.ripX += (this.hoverX - this.ripX) * follow;
        this.ripY += (this.hoverY - this.ripY) * follow;
        this.ripple += (RIPPLE_HOVER - this.ripple) * follow;
      } else {
        this.ripple *= Math.exp(-RIPPLE_DECAY * dt);
        if (this.ripple < 0.002) this.ripple = 0;
      }
    }
  }

  /** The sockets follow the warp. Their heading is the direction of the logo there. */
  private moveSockets(): void {
    const warp = this.warp;
    const a = this.scratch;
    const b = this.scratch2;
    const c = this.scratch3;
    for (const name of SOCKET_NAMES) {
      const at = SOCKETS[name];
      const socket = this.sockets.get(name);
      if (!socket) continue;
      warpPoint(at.x, at.y, warp, a);
      warpPoint(at.x - HEADING_SPAN, at.y, warp, b);
      warpPoint(at.x + HEADING_SPAN, at.y, warp, c);
      socket.position.set(a.x, a.y, a.z);
      socket.rotation.z = Math.atan2(c.y - b.y, c.x - b.x);
    }
  }

  // ---------------------------------------------------------------------------------------------
  // The pointer

  /** The pointer's place on the logo, in logo units from the art's centre (y up), ignoring the bend. */
  private logoPoint(clientX: number, clientY: number): { x: number; y: number } {
    const rest = this.rest ?? heroRect(this.vw, this.vh);
    const sx = clientX - this.vw / 2 - rest.cx;
    const sy = this.vh / 2 - clientY - rest.cy;
    const cs = Math.cos(-this.pose.roll);
    const sn = Math.sin(-this.pose.roll);
    const k = rectScale(rest);
    return { x: (sx * cs - sy * sn) / k, y: (sx * sn + sy * cs) / k };
  }

  private hoverAt(clientX: number, clientY: number): void {
    const l = this.logoPoint(clientX, clientY);
    this.hoverX = l.x;
    this.hoverY = l.y;
  }

  private hitTest(x: number, y: number): number | null {
    if (!this.visible || this.P > 0.3 || this.pose.reveal < 0.6) return null;
    const rest = this.rest ?? heroRect(this.vw, this.vh);
    const l = this.logoPoint(x, y);
    if (
      Math.abs(l.x) > ART.w / 2 + 24 ||
      Math.abs(l.y) > rectHeight(rest) / rectScale(rest) / 2 + 24
    ) {
      return null;
    }
    const u = (l.x + ART_CENTRE.x - REG.x) / REG.w;
    const v = (ART_CENTRE.y - l.y - REG.y) / REG.h;
    if (u < 0 || u >= 1 || v < 0 || v >= 1) return null;
    const hit = this.mask[Math.floor(v * MASK_H) * MASK_W + Math.floor(u * MASK_W)];
    // Far behind everything else: a drone or a card in front always wins.
    return hit ? 900 : null;
  }
}
