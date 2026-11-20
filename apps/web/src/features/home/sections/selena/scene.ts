/**
 * The actors of the Selena section: Selena, the dragon, the pair and the white sheet, set every frame
 * from the beats (`timeline.ts`, `out.ts`). Two parts of the story:
 *
 *  - the room (the pixel view): Selena in `city_idle` (her state machine, `sl.drive(1)`), the dragon
 *    beside her playing its own clip with its head still, the drone and the doll docked at the lower
 *    right as they were through the list;
 *  - the out animation: the clip `city_intercation02` by the scroll, the camera the game made for it,
 *    then a close up on her hand as it reaches up, takes the edge of the white sheet and pulls it down
 *    over the screen. The sheet is in the cast pass, cut through her hand, so some fingers are in
 *    front of it and some behind. The pair fly off to the lower right as the sheet comes.
 *
 * Every actor is optional: the section works (a drawer and its words on the plain ground) before any
 * of them has arrived. Nothing is allocated in a frame.
 */
import { PerspectiveCamera, Vector3 } from "three";

import type { BuddyPair } from "../../actors/buddies";
import type { CameraData } from "../../actors/selena/camera";
import type { ClipName, SelenaActor } from "../../actors/selena";
import { getCast, type Cast } from "../../actors/shared/cast";
import type { SilverboltActor } from "../../actors/silverbolt";
import type { SheetActor } from "../../fx/sheet";
import { isCompactView } from "../../drone-route";
import type { FrameInfo, SectionCtx } from "../../kernel/types";
import { dockPlace } from "../descent/dock";
import { showDragon } from "../list/dragon";
import { selenaEnd, type Placement } from "../list/selena-frame";
import { isPortrait } from "../vp";

import { blendLens, newLens, pixelFov, pullOf, travelOf, type BakedLens } from "./camera-blend";
import { OUT_CLIP, copyLens, outCameraFor, setWindow, windowOf } from "./out-camera";
import {
  OUT_BLEND,
  ZOOM,
  ZOOM_PORTRAIT,
  WRIST_AT,
  mix,
  seg,
  smooth,
  zoomRect,
  type ViewRect,
} from "./out";
import type { Beats } from "./timeline";

/**
 * The camera's first move, from the pixel view of the room to the out camera (they are the same
 * picture when the room shows the game's idle camera, and this hides any difference): it starts when
 * the pair have flown off (the doll is drawn by the cast and would be misplaced by a baked camera),
 * eased, drawn back a little at its middle.
 */
const SWING_START = 0.05;
const SWING_END = 0.15;
const SWING_POW = 1.4;
const SWING_PULL = 0.25;
/** The pair's flight off, in shares of the screen: right and down. */
const EXIT_X = 0.34;
const EXIT_Y = -0.26;

const dock = { x: 0, y: 0, height: 0 };
const put = { x: 0, y: 0, height: 0 };

export class SelenaScene {
  sl: SelenaActor | null = null;
  sb: SilverboltActor | null = null;
  pair: BuddyPair | null = null;
  sheet: SheetActor | null = null;
  cams: CameraData | null = null;

  private cast: Cast | null = null;
  /** The out camera of the clip time, the picture the zoom closes in on. */
  private readonly out = new PerspectiveCamera();
  /** The camera the arm is solved in (zoomed, not panned) and the one the cast is drawn with. */
  private readonly ref = new PerspectiveCamera();
  private readonly show = new PerspectiveCamera();
  private readonly mixed = new PerspectiveCamera();
  private readonly lens = newLens();
  private readonly baked: BakedLens = { fov: 62, fullHeight: 1, offsetY: 0 };
  private readonly rectA: ViewRect = zeroRect();
  private readonly rectB: ViewRect = zeroRect();
  private readonly rectC: ViewRect = zeroRect();
  private readonly hand = new Vector3();
  private readonly back = new Vector3();
  private endKey = "";
  private end: Placement = { x: 0, y: 0, height: 1 };
  private exiting = false;
  /**
   * The clip she showed the frame before the out zone (the idle loop, or the way out of the pose if
   * the visitor ran on while it still played) and where it is. The first moments of the out clip
   * blend from it and it keeps running, so the scroll's first notch never pops her pose.
   */
  private fromClip: ClipName = "city_idle";
  private fromT = 0;

  constructor(private readonly ctx: SectionCtx) {}

  setActors(parts: Partial<Pick<SelenaScene, "sl" | "sb" | "pair" | "sheet" | "cams">>): void {
    Object.assign(this, parts);
    if (this.sl && !this.cast) this.cast = getCast(this.ctx.stage);
  }

  enter(): void {
    this.exiting = false;
  }

  leave(): void {
    this.restore();
  }

  /** Give every actor its state back (the section is left, or the screen is white). */
  restore(): void {
    this.sb?.interactive(false);
    this.pair?.setInteractive(true);
    this.exiting = false;
  }

  /** Set the whole state of the actors for the beats. */
  apply(b: Beats, frame: FrameInfo): void {
    const vp = frame.viewport;
    const key = `${vp.w}x${vp.h}`;
    if (key !== this.endKey) {
      this.endKey = key;
      this.end = selenaEnd(vp);
    }
    const sl = this.sl;
    const sb = this.sb;

    if (!b.actors) {
      this.restore();
      return;
    }
    // Round seven: Selena and Silverbolt have no touch targets (the cursor only turns her head).
    sb?.interactive(false);

    if (sl) this.selena(sl, b, frame.dt);
    if (sl && this.cast) this.view(sl, this.cast, b, vp);
    if (sl && sb) this.dragon(sl, sb, frame);
    this.buddies(b, vp);
  }

  // ------------------------------------------------------------------ Selena

  private selena(sl: SelenaActor, b: Beats, dt: number): void {
    sl.visible = true;
    sl.place(this.end);
    sl.clipRectangle(null);
    sl.look("pointer");
    if (b.o <= 0) {
      // The room: the machine loops the idle (and finishes the way out of the pose by itself if the
      // list's last frames have only just started it).
      sl.drive(1);
      return;
    }
    // The first frame of the zone (also after a seek or a flick that skipped the room): take what
    // she is showing now while the machine still has her.
    if (sl.state() !== "free") {
      const c = sl.clipState();
      this.fromClip = c.clip;
      this.fromT = c.time;
    }
    // The out animation scrubs the clip: the machine lets go, and takes her back going up. The first
    // moments blend from the idle that was showing, so the scroll's first notch never pops her pose.
    const w = smooth(seg(b.o, 0, OUT_BLEND));
    if (w < 1) {
      this.fromT += dt;
      sl.blend(this.fromClip, this.fromT, OUT_CLIP, b.out.t, w);
    } else {
      sl.clip(OUT_CLIP, b.out.t);
    }
  }

  // ------------------------------------------------------------------ the camera and the sheet

  private view(sl: SelenaActor, cast: Cast, b: Beats, vp: { w: number; h: number }): void {
    const o = b.out;
    if (
      sl.hasFittedCameras() &&
      (b.o <= 0 || !this.cams || smooth(seg(b.o, SWING_START, SWING_END)) < 1)
    ) {
      // Round seven: the room and the start of the out are the fitted camera of the clip (the actor
      // draws it itself in `update`, the sky behind her, the pair drawn apart in pixels). The out
      // camera begins on the fitted idle camera, so the hand over below is the same picture.
      this.back.set(0, 0, 1000);
      // From the first notch of the out zone the camera is the out clip's own (its first key is the
      // fitted idle camera, so the move from the room is continuous); in the room it follows her clip.
      if (b.o > 0) {
        sl.cameraFor(OUT_CLIP, o.t, vp, { portrait: isPortrait(vp) ? 1 : 0 });
      } else {
        sl.frame(vp, { portrait: isPortrait(vp) ? 1 : 0 });
      }
      return;
    }
    if (b.o <= 0 || !this.cams) {
      this.back.set(0, 0, 1000);
      return;
    }
    const portrait = isPortrait(vp);
    const base = outCameraFor(sl, this.cams, o.t, vp, portrait, this.out);
    const k = smooth(seg(b.o, SWING_START, SWING_END));
    if (k <= 0) {
      // Until the pair have gone the cast is drawn through the pixel camera (the doll is in it).
      this.back.set(0, 0, 1000);
      return;
    }
    if (k < 1) {
      // The first move: from the pixel camera to the out camera.
      const pixel = cast.pass.camera as PerspectiveCamera;
      const view = base.view;
      if (!view) return;
      this.baked.fov = base.fov;
      this.baked.fullHeight = view.fullHeight;
      this.baked.offsetY = view.offsetY;
      const travel = travelOf(k, SWING_POW);
      const lens = blendLens(
        vp.w,
        vp.h,
        pixelFov(vp.h, pixel.position.z),
        this.baked,
        travel,
        this.lens,
      );
      const cam = this.mixed;
      cam.position.lerpVectors(pixel.position, base.position, travel);
      cam.quaternion.slerpQuaternions(pixel.quaternion, base.quaternion, k);
      const pull = pullOf(k, SWING_PULL) * pixel.position.length();
      if (pull > 0) {
        cam.position.addScaledVector(this.back.set(0, 0, 1).applyQuaternion(cam.quaternion), pull);
      }
      cam.fov = lens.fov;
      cam.aspect = lens.aspect;
      cam.near = pixel.near + (base.near - pixel.near) * k;
      cam.far = Math.max(pixel.far, base.far);
      cam.setViewOffset(vp.w, lens.fullHeight, 0, lens.offsetY, vp.w, vp.h);
      cam.updateProjectionMatrix();
      cam.updateMatrixWorld(true);
      cast.setCamera(cam);
      return;
    }
    if (o.zoom <= 0.0005) {
      cast.setCamera(base);
      sl.pointSky(base);
      return;
    }
    this.closeIn(sl, cast, b, base, portrait);
  }

  /**
   * The close up on the hand: the picture is zoomed about where the clip has her wrist, so the wrist
   * lands at `WRIST_AT`; the arm is solved in that picture (`ref`) and the cast is drawn through the
   * same picture drawn up by `pan` (`show`), so the hand and the edge leave by the bottom.
   */
  private closeIn(
    sl: SelenaActor,
    cast: Cast,
    b: Beats,
    base: PerspectiveCamera,
    portrait: boolean,
  ): void {
    const o = b.out;
    const h = sl.clipHandWorld();
    this.hand.set(h.x, h.y, h.z).project(base);
    const z = mix(1, portrait ? ZOOM_PORTRAIT : ZOOM, o.zoom);
    const qx = mix(this.hand.x, WRIST_AT.x, o.zoom);
    const qy = mix(this.hand.y, WRIST_AT.y, o.zoom);
    const view = windowOf(base, this.rectA);
    copyLens(base, this.ref);
    copyLens(base, this.show);
    setWindow(this.ref, zoomRect(view, z, this.hand.x, this.hand.y, qx, qy, this.rectB));
    setWindow(this.show, zoomRect(view, z, this.hand.x, this.hand.y, qx, qy - o.pan, this.rectC));
    cast.setCamera(this.show);
    sl.pointSky(this.show);
    sl.pull({
      camera: this.ref,
      x: o.handX,
      y: o.handY,
      depth: o.depth,
      close: o.close,
      weight: o.arm,
    });
    const sheet = this.sheet;
    if (sheet && o.sheet) {
      sheet.visible = true;
      sheet.drive({
        sl,
        camera: this.show,
        hang: o.hang,
        grip: o.grip,
        fold: o.fold,
        phase: o.phase,
      });
    }
  }

  // ------------------------------------------------------------------ the dragon

  /**
   * The dragon is in her picture from the list on (`list/dragon.ts`): it stands where its clip puts
   * it, plays the clip that matches hers and keeps its head still. The room does not bring it in
   * again: it was already behind her when the frame had grown.
   */
  private dragon(sl: SelenaActor, sb: SilverboltActor, frame: FrameInfo): void {
    showDragon(sl, sb, frame.time);
  }

  // ------------------------------------------------------------------ the pair

  /**
   * The drone and the doll stay docked at the lower right through the room, as they were in the
   * list, and fly off to the lower right as the sheet comes (`out.pair`), with a cheer.
   */
  private buddies(b: Beats, vp: { w: number; h: number }): void {
    const pair = this.pair;
    if (!pair) return;
    const exit = b.out.pair;
    if (exit >= 1) {
      this.exiting = false;
      return;
    }
    dockPlace(vp, dock);
    const compact = isCompactView(vp.w, vp.h);
    put.x = dock.x + exit * (compact ? 0.3 : EXIT_X) * vp.w;
    put.y = dock.y + exit * EXIT_Y * vp.h;
    put.height = dock.height * (1 - 0.25 * exit);
    pair.visible = true;
    // The exit is the section's own scroll linked flight (the descent's cap is off here).
    pair.capFlight(false);
    pair.place(put);
    pair.mode("dock");
    // The sky of the room is drawn in the cast: the pair stand in front of it (and of her).
    pair.layer("front");
    if (exit > 0 && !this.exiting) pair.react("cheer");
    this.exiting = exit > 0;
    // They are in the way of the hand's picture and on their way out: no touches while they go.
    pair.setInteractive(exit <= 0);
  }
}

function zeroRect(): ViewRect {
  return { fullWidth: 1, fullHeight: 1, offsetX: 0, offsetY: 0, width: 1, height: 1 };
}
