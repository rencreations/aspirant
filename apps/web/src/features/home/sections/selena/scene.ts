import { Euler, Quaternion, Vector3 } from "three";

import type { BuddyPair } from "../../actors/buddies";
import type { SelenaActor } from "../../actors/selena";
import type { SilverboltActor } from "../../actors/silverbolt";
import type { FrameInfo } from "../../kernel/types";
import { dockPlace } from "../descent/dock";
import { showDragon } from "../list/dragon";
import { selenaEnd } from "../list/selena-frame";
import { mix, seg, smooth } from "../vp";
import { biteFlight } from "./bite";
import type { Beats } from "./timeline";

const RELEASE = 1.28;
const CONTACT = 3.75;
const DOLL_HEIGHT_M = 0.135;
const HOVER = new Vector3(-0.098, 0.706, -0.352);
const STRIKE = new Vector3(-0.14, 0.733, -0.497);

export class SelenaScene {
  sl: SelenaActor | null = null;
  sb: SilverboltActor | null = null;
  pair: BuddyPair | null = null;
  private readonly spot = new Vector3();
  private readonly mouth = new Vector3();
  private readonly projected = new Vector3();
  private readonly offset = new Vector3();
  private readonly facing = new Quaternion();
  private readonly grip = new Quaternion();
  private readonly local = new Quaternion();
  private readonly angles = new Euler(0, 0, 0, "ZXY");
  private readonly dock = { x: 0, y: 0, height: 0 };

  leave(): void {
    if (this.pair?.doll.parentSocket && !this.pair.doll.riding) this.pair.doll.detach();
    this.pair?.mode("dock");
    this.pair?.setInteractive(true);
  }

  apply(b: Beats, frame: FrameInfo): void {
    const { sl, sb, pair } = this;
    if (!sl || !b.actors) return;
    const vp = frame.viewport;
    const t = b.clip;
    sl.visible = true;
    sl.place(selenaEnd(vp));
    sl.clipRectangle(null);
    sl.look("pointer");
    const shift = 0.13 * b.drawer;
    if (t === 0) {
      sl.drive(1);
      sl.frame(vp, { shift });
    } else {
      // A small moving idle contribution keeps the held pose breathing between inputs.
      sl.blend(
        "city_intercation03",
        t,
        "city_idle",
        frame.time,
        mix(1, 0.012, smooth(seg(t, 0, 0.2))),
        false,
      );
    }
    if (sb) {
      showDragon(sl, sb, this.offset.fromArray(biteFlight.evaluate(t)));
      if (t > 0) {
        sb.clip("city_intercation03", t, {
          root: "keep",
          blend: { name: "city_idle", time: frame.time, weight: 0.012 },
        });
        sb.straighten(1 - smooth(seg(t, 0, 0.45)));
        sb.gripDoll(smooth(seg(t, 3.7, 3.81)));
      }
    }
    const camera = t > 0 ? sl.exitCamera(t, vp) : null;
    if (!pair) return;
    dockPlace(vp, this.dock);
    pair.mode(t < RELEASE ? "dock" : "apart");
    pair.visible = true;
    pair.layer("front");
    pair.setInteractive(b.o === 0);
    pair.capFlight(false);
    if (!camera) {
      pair.place(this.dock);
      return;
    }
    const scale = sl.object.scale.x;
    const hand = sl.socket("rightHand");
    hand.getWorldPosition(this.spot);
    sl.object.worldToLocal(this.spot);
    this.spot.x -= 0.06;
    this.spot.y += 0.27 + 0.012 * Math.sin(frame.time * 3);
    // She hangs in the air when Selena draws her hand back to give the order.
    this.offset.lerpVectors(HOVER, STRIKE, smooth(seg(t, 2.85, CONTACT)));
    this.offset.y += 0.008 * Math.sin(frame.time * 3) * (1 - smooth(seg(t, 3.55, CONTACT)));
    this.spot.lerp(this.offset, smooth(seg(t, 2.55, 2.85)));
    sl.object.localToWorld(this.spot);
    this.projected.copy(this.spot).project(camera);
    const x = (this.projected.x * vp.w) / 2;
    const y = (this.projected.y * vp.h) / 2;
    const approach = smooth(seg(t, 0, RELEASE));
    const retreat = smooth(seg(t, RELEASE, 2.05));
    const height = mix(this.dock.height, vp.h * 0.12, approach);
    pair.place({
      x: mix(this.dock.x, x, approach) + retreat * vp.w,
      y: mix(this.dock.y, y - height * 0.52, approach) - retreat * vp.h * 0.25,
      height,
      pitch: -0.48 * Math.sin(Math.PI * seg(t, 1.08, 1.48)),
    });
    if (t < RELEASE) return;
    const doll = pair.doll;
    const bite = sb?.socket("bite");
    const caught = bite ? smooth(seg(t, 3.71, CONTACT)) : 0;
    const kick = Math.sin(Math.PI * seg(t, RELEASE, 1.84));
    const parent = caught === 1 && bite ? bite : sl.object;
    if (parent === bite) {
      this.spot.set(0, 0, 0);
      this.angles.set(0, 0, 0.9);
    } else {
      this.spot.y += kick * scale * 0.16;
      this.angles.set(0, 0, kick * 0.65 + 0.14 * Math.sin(8 * t));
      this.facing.copy(camera.quaternion).multiply(this.local.setFromEuler(this.angles));
      if (bite && caught > 0) {
        this.spot.lerp(bite.getWorldPosition(this.mouth), caught);
        this.angles.set(0, 0, 0.9);
        bite.getWorldQuaternion(this.grip).multiply(this.local.setFromEuler(this.angles));
        this.facing.slerp(this.grip, caught);
      }
      sl.object.worldToLocal(this.spot);
      sl.object.getWorldQuaternion(this.local).invert().multiply(this.facing);
      this.angles.setFromQuaternion(this.local);
    }
    doll.visible = true;
    doll.reset();
    doll.placeInScene(parent, {
      x: this.spot.x,
      y: this.spot.y,
      z: this.spot.z,
      height: DOLL_HEIGHT_M * scale,
      pitch: this.angles.x,
      yaw: this.angles.y,
      roll: this.angles.z,
      pivot: "center",
    });
    doll.setPose("stand", "scream", 0.48 + 0.45 * caught);
    doll.flail(0.45 * (1 - caught) + 0.1);
  }
}
