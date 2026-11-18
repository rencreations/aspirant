/**
 * The actors of the Selena section: Selena, the dragon and the doll, set every frame from the beats
 * (`timeline.ts`). Three parts of the story:
 *
 *  - the room (the pixel view): Selena and the dragon in `city_idle`, both fully interactive, the doll
 *    hanging from the top edge by one hand (the list's last state, so the joint is the same picture);
 *  - the swing: the camera leaves the pixel view for the baked one (the lens and the pose are mixed),
 *    Selena's pose goes from the idle to the clip, the doll lets go, falls and floats over her hand;
 *  - the film: the clip `city_intercation03` by the scroll, all three drawn through the baked camera
 *    in Selena's own space. The doll floats, the dragon opens its jaw and eats her, then passes the
 *    lens while the stage goes white behind it.
 *
 * Every actor is optional: the section works (a drawer and its words on a quiet sky) before any of
 * them has arrived. Nothing is allocated in a frame.
 */
import { PerspectiveCamera, Quaternion, Vector3 } from "three";

import { depthScale } from "../../actors/doll/place";
import { ANCHOR } from "../../actors/selena/constants";
import type { DollActor, MoodStep } from "../../actors/doll";
import type { SelenaActor } from "../../actors/selena";
import type { SilverboltActor } from "../../actors/silverbolt";
import { getCast, type Cast } from "../../actors/shared/cast";
import type { MarkEvent } from "../../actors/silverbolt/marks";
import type { MarksActor } from "../../fx/comic-marks";
import type { FrameInfo, SectionCtx } from "../../kernel/types";
import type { Carry } from "../hand/carry";
import { HAND_SCREENS, LIST_SCREENS, isPortrait } from "../hand/timeline";
import { dollHang, selenaEnd, type DollHang, type Placement } from "../list/selena-frame";

import { blendLens, newLens, pixelFov, type BakedLens } from "./camera-blend";
import { DOLL_T, FILM_END, mix, seg, smooth, type Beats } from "./timeline";

/** The doll's height in the film, in metres of Selena's space (the recording shows her about this size). */
const DOLL_METRES = 0.26;
/** Where her hips are under the hand that holds her, as a share of her height (the hang pose). */
const HIPS_UNDER_HAND = { x: 0.05, y: -0.62 } as const;
/** The widest vertical field of view the baked camera may take on a phone, in degrees. */
const PORTRAIT_FOV = 112;
/** The dragon starts this many screen widths to the right of its place. */
const GLIDE = 1.15;

/** The doll's faces by the clip's seconds: shocked as she lands, scared as she floats, a scream in the jaws. */
const FILM_FACES: readonly MoodStep[] = [
  { face: "shocked", hold: 0.5 },
  { face: "scared", hold: 2.1, blend: 0.3 },
  { face: "scream", hold: 9, blend: 0.15 },
];

interface Pt {
  x: number;
  y: number;
  z: number;
}

export class SelenaScene {
  sl: SelenaActor | null = null;
  sb: SilverboltActor | null = null;
  doll: DollActor | null = null;
  marks: MarksActor | null = null;
  carry: Carry | null = null;

  private cast: Cast | null = null;
  private readonly camera = new PerspectiveCamera();
  private readonly lens = newLens();
  private readonly baked: BakedLens = { fov: 62, fullHeight: 1, offsetY: 0 };
  private readonly film = new Vector3();
  private readonly filmQ = new Quaternion();
  private readonly hover = new Vector3();
  private readonly mouth = new Vector3();
  private readonly hips0: Pt = { x: 0, y: 0, z: 0 };
  private readonly spot: Pt = { x: 0, y: 0, z: 0 };
  private readonly camPos = new Vector3(0, 0, 1000);
  private readonly place = {
    x: 0,
    y: 0,
    z: 0,
    height: 1,
    yaw: 0,
    pitch: 0,
    roll: 0,
    pivot: "hips" as "hips" | "feet",
  };
  private readonly world = { x: 0, y: 0, z: 0 };
  private endKey = "";
  private end: Placement = { x: 0, y: 0, height: 1 };
  private hang: DollHang = { x: 0, y: 0, height: 1 };
  private idleT = 0;
  private prevT = Number.NaN;
  private prevDoll = Number.NaN;
  private offMarks: (() => void) | null = null;
  private running = false;

  /** The picture is being drawn through the baked camera this frame. */
  filmDrawn = false;

  constructor(private readonly ctx: SectionCtx) {}

  setActors(parts: Partial<Pick<SelenaScene, "sl" | "sb" | "doll" | "marks" | "carry">>): void {
    Object.assign(this, parts);
    if (this.sl && !this.cast) this.cast = getCast(this.ctx.stage);
    this.bindMarks();
  }

  enter(): void {
    this.running = true;
    this.bindMarks();
  }

  leave(): void {
    this.running = false;
    this.offMarks?.();
    this.offMarks = null;
    this.restore();
  }

  /** The way pokes on the dragon become comic marks, while this section runs (`fx-marks.md`). */
  private bindMarks(): void {
    const sb = this.sb;
    const marks = this.marks;
    if (this.offMarks || !this.running || !sb || !marks) return;
    this.offMarks = sb.onMark((event) => {
      this.onDragonMark(event, marks);
    });
  }

  private onDragonMark(event: MarkEvent, marks: MarksActor): void {
    const h = this.end.height * 0.22;
    const size = Math.max(44, h);
    const at = event.at;
    const strength = event.strength;
    switch (event.kind) {
      case "sparks":
        marks.emit("spark", { at, strength, size });
        break;
      case "smoke":
        marks.emit("steam", { at, strength, size: size * 0.7 });
        break;
      case "vein":
        marks.emit("vein", { at, strength, size });
        break;
      case "sweat":
        marks.emit("sweat", { at, strength, size: size * 0.5 });
        break;
      case "stars":
        marks.emit("starburst", { at, strength, size: size * 1.2 });
        break;
      case "gust":
        marks.emit("speed", { at, strength, size });
        break;
      case "puff":
        marks.emit("poof", { at, strength, size: size * 1.4 });
        break;
      case "heart":
        marks.emit("heart", { at, strength, size: size * 0.8 });
        break;
      case "chomp":
        marks.emit("flash", { at, size: size * 1.3 });
        marks.emit("spark", { at, size });
        break;
    }
  }

  /** Give every actor its pointer back (the section is left, or the picture is not the film's). */
  restore(): void {
    this.sl?.interactive(true);
    this.sb?.interactive(true);
    this.doll?.setInteractive(true);
  }

  /** Set the whole state of the actors for the beats. */
  apply(b: Beats, frame: FrameInfo): void {
    const vp = frame.viewport;
    this.filmDrawn = false;
    const key = `${vp.w}x${vp.h}`;
    if (key !== this.endKey) {
      this.endKey = key;
      this.end = selenaEnd(vp);
      this.hang = dollHang(vp);
    }
    const sl = this.sl;
    const sb = this.sb;
    const doll = this.doll;

    if (!b.actors) {
      this.restore();
      this.prevT = Number.NaN;
      this.prevDoll = Number.NaN;
      return;
    }
    sl?.interactive(b.live);
    sb?.interactive(b.live);
    doll?.setInteractive(b.live);

    if (sl) this.selena(sl, b, frame);
    if (sl && this.cast && b.camera > 0) this.view(sl, this.cast, b, vp);
    else this.camPos.set(0, 0, 1000);
    if (sl && sb) this.dragon(sl, sb, b, frame);
    if (b.doll <= 0) {
      // The room: the doll hangs from the top, the list's last state (the carry is the list's own
      // choreography, so this is the same picture at the joint). It needs neither Selena nor the dragon.
      if (doll) this.carry?.apply(HAND_SCREENS + LIST_SCREENS, frame, true);
    } else if (sl && doll) {
      this.dollStep(sl, sb, doll, b, frame);
    }
    this.prevT = b.t;
    this.prevDoll = b.doll;
  }

  // ------------------------------------------------------------------ Selena

  private selena(sl: SelenaActor, b: Beats, frame: FrameInfo): void {
    sl.visible = true;
    sl.place(this.end);
    sl.clipRectangle(null);
    sl.look("pointer");
    if (b.pose <= 0) {
      // The room: she plays the idle on her own clock. The list's last frames may still be the way
      // out of the hands at the mouth, which goes on to the idle by itself: do not start it again.
      const st = sl.clipState();
      if (!st.playing || (st.clip !== "city_idle" && st.clip !== "city_interaction_back_R")) {
        sl.play("city_idle");
      }
      this.idleT = st.time;
      return;
    }
    this.idleT += frame.dt;
    sl.blend("city_idle", this.idleT, "city_intercation03", b.t, b.pose);
  }

  // ------------------------------------------------------------------ the camera

  /** Selena's own space in the world: where `cameras.json` and the dragon's clip live. */
  private filmSpace(sl: SelenaActor): void {
    const o = sl.object;
    const s = o.scale.x;
    this.filmQ.copy(o.quaternion);
    this.film
      .set(-ANCHOR[0] * s, -ANCHOR[1] * s, -ANCHOR[2] * s)
      .applyQuaternion(o.quaternion)
      .add(o.position);
  }

  private view(sl: SelenaActor, cast: Cast, b: Beats, vp: { w: number; h: number }): void {
    // A phone sees the baked 16:9 frame through a very wide lens, so the doll and the dragon at its
    // sides still show.
    const portrait = isPortrait(vp);
    const whole = b.camera >= 1;
    const baked = sl.cameraFor(b.t, vp, {
      draw: whole,
      fit: portrait ? "width" : "height",
      maxFov: PORTRAIT_FOV,
    });
    this.filmDrawn = whole;
    if (whole) {
      this.camPos.copy(baked.position);
      return;
    }
    const pixel = cast.pass.camera as PerspectiveCamera;
    const view = baked.view;
    if (!view) return;
    this.baked.fov = baked.fov;
    this.baked.fullHeight = view.fullHeight;
    this.baked.offsetY = view.offsetY;
    const k = b.camera;
    const lens = blendLens(vp.w, vp.h, pixelFov(vp.h, pixel.position.z), this.baked, k, this.lens);
    const cam = this.camera;
    cam.position.lerpVectors(pixel.position, baked.position, k);
    cam.quaternion.slerpQuaternions(pixel.quaternion, baked.quaternion, k);
    cam.fov = lens.fov;
    cam.aspect = lens.aspect;
    cam.near = pixel.near + (baked.near - pixel.near) * k;
    cam.far = Math.max(pixel.far, baked.far);
    cam.setViewOffset(vp.w, lens.fullHeight, 0, lens.offsetY, vp.w, vp.h);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld(true);
    cast.setCamera(cam);
    this.camPos.copy(cam.position);
  }

  // ------------------------------------------------------------------ the dragon

  private dragon(sl: SelenaActor, sb: SilverboltActor, b: Beats, frame: FrameInfo): void {
    if (b.dragon <= 0 || b.t >= FILM_END) return;
    this.filmSpace(sl);
    sb.visible = true;
    const slide = (1 - b.dragon) * GLIDE * frame.viewport.w;
    this.world.x = this.film.x + slide;
    this.world.y = this.film.y;
    this.world.z = this.film.z;
    sb.placeWorld(this.world, sl.object.scale.x, this.filmQ);
    if (b.pose > 0) {
      sb.clip("city_idle", frame.time, {
        root: "keep",
        blend: { name: "city_intercation03", time: b.t, weight: b.pose },
      });
    } else {
      sb.clip("city_idle", frame.time, { root: "keep" });
    }
    sb.follow(b.live ? 1 : 0);
    // The jaw opens for the doll and shuts on her.
    const open = seg(b.t, DOLL_T.jawOpen[0], DOLL_T.jawOpen[1]);
    const shut = seg(b.t, DOLL_T.jawShut[0], DOLL_T.jawShut[1]);
    if (b.film && open > 0 && shut < 1) sb.jaw(0.15 + 0.85 * smooth(open) * (1 - smooth(shut)));
    if (this.bit(b.t) && b.film) {
      sb.react("chomp", 1);
      this.marks?.emit("flash", { at: sb.socket("mouth"), size: this.end.height * 0.36 });
      this.marks?.emit("spark", { at: sb.socket("mouth"), size: this.end.height * 0.24 });
    }
  }

  /** True on the frame the clip crosses the bite going forward in a small step (not after a jump). */
  private bit(t: number): boolean {
    const p = this.prevT;
    return p < DOLL_T.bite && t >= DOLL_T.bite && t - p < 1;
  }

  // ------------------------------------------------------------------ the doll

  private dollStep(
    sl: SelenaActor,
    sb: SilverboltActor | null,
    doll: DollActor,
    b: Beats,
    frame: FrameInfo,
  ): void {
    if (b.film && b.t >= DOLL_T.bite) return;
    const vp = frame.viewport;
    const d = b.doll;
    const t = b.t;
    this.filmSpace(sl);
    const s = sl.object.scale.x;
    const hang = this.hang;
    const hh = hang.height;
    // Her hips under the hand that held her.
    this.hips0.x = hang.x + HIPS_UNDER_HAND.x * hh;
    this.hips0.y = hang.y + HIPS_UNDER_HAND.y * hh;
    this.hips0.z = 0;

    const hand = sl.socket("rightHover").matrixWorld.elements;
    this.hover.set(hand[12], hand[13], hand[14]);
    const flying = b.film && t > DOLL_T.fly;
    const swallowed = seg(t, DOLL_T.fly, DOLL_T.bite);
    const worldHeight = DOLL_METRES * s;
    const bob = Math.sin(frame.time * 2.3) * 0.035 * s;
    const p = this.spot;

    doll.reset();
    doll.visible = true;
    doll.blinkAuto(true);
    if (doll.parentSocket) doll.detach();

    // Where she is, in the world.
    const fall = seg(d, 0.1, 1);
    const e = smooth(fall);
    p.x = mix(this.hips0.x, this.hover.x, e);
    p.y =
      mix(this.hips0.y, this.hover.y + bob, e) -
      0.16 * vp.h * Math.sin(Math.PI * fall) * (1 - fall);
    p.z = mix(this.hips0.z, this.hover.z, e);
    let height = mix(hh, worldHeight, e);
    if (b.doll >= 1 && sb && flying) {
      const m = sb.socket("mouth").matrixWorld.elements;
      this.mouth.set(m[12], m[13], m[14]);
      const x = seg(swallowed, 0, 0.8) ** 1.6;
      p.x = mix(this.hover.x, this.mouth.x, x);
      p.y = mix(this.hover.y, this.mouth.y, x) + 0.05 * vp.h * Math.sin(Math.PI * swallowed);
      p.z = mix(this.hover.z, this.mouth.z, x);
      height = worldHeight * mix(1, 0.4, swallowed ** 1.2);
    }

    const hangW = 1 - smooth(seg(d, 0.02, 0.2));
    // While her hand still holds the edge the pivot slides from the hand to her hips.
    if (hangW > 0) {
      p.x = this.hang.x + (1 - hangW) * HIPS_UNDER_HAND.x * hh;
      p.y = this.hang.y + (1 - hangW) * HIPS_UNDER_HAND.y * hh;
      p.z = 0;
    }
    const facing = Math.atan2(this.camPos.x - p.x, this.camPos.z - p.z);
    const pl = this.place;
    pl.x = p.x;
    pl.y = p.y;
    pl.z = p.z;
    pl.height = height * depthScale(p.z);
    pl.yaw = facing;
    // She falls face up and head away from the camera: tipped toward it while she falls, upright
    // as she comes to float.
    const fallW = smooth(seg(d, 0.12, 0.4));
    const recover = smooth(seg(d, 0.6, 1));
    pl.pitch = 0.9 * fallW * (1 - recover);
    pl.roll =
      0.12 * Math.sin(frame.time * 1.7) * recover +
      (flying ? 6.28 * seg(swallowed, 0, 0.8) ** 1.6 : 0);
    pl.pivot = "hips";
    doll.place(pl);
    doll.hang(hangW, 1);
    if (fallW * (1 - recover) > 0.001) {
      doll.setPose("stand", "fall", fallW * (1 - recover));
    } else {
      // Floating: arms out and up, more of it as the jaws come.
      doll.setPose("stand", "scream", 0.35 + 0.5 * swallowed);
    }
    doll.flail(0.5 * Math.sin(Math.PI * fall) + (b.doll >= 1 ? 0.3 + 0.5 * swallowed : 0), 1.1);
    doll.squash(0);
    doll.talk(flying ? 1 : 0);
    doll.look(null);
    if (this.prevDoll < 0.05 && d >= 0.05 && d - this.prevDoll < 0.3) {
      this.marks?.emit("poof", {
        at: { x: this.hang.x, y: this.hang.y },
        size: hh * 0.8,
      });
    }
    doll.mood(FILM_FACES, b.film ? t : 0);
  }
}
