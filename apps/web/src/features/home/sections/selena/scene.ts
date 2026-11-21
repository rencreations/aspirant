import { Vector3 } from "three";

import type { BuddyPair } from "../../actors/buddies";
import type { SelenaActor } from "../../actors/selena";
import type { SilverboltActor } from "../../actors/silverbolt";
import type { FrameInfo } from "../../kernel/types";
import { dockPlace } from "../descent/dock";
import { showDragon } from "../list/dragon";
import { selenaEnd } from "../list/selena-frame";
import { mix, seg, smooth } from "../vp";
import type { Beats } from "./timeline";

export class SelenaScene {
  sl: SelenaActor | null = null;
  sb: SilverboltActor | null = null;
  pair: BuddyPair | null = null;
  private readonly spot = new Vector3();
  private readonly mouth = new Vector3();
  private readonly dock = { x: 0, y: 0, height: 0 };

  leave(): void {
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
      sl.blend("city_intercation03", t, "city_idle", frame.time, 0.012);
    }
    if (sb) {
      showDragon(sl, sb);
      if (t > 0)
        sb.clip("city_intercation03", t, {
          root: "keep",
          blend: { name: "city_idle", time: frame.time, weight: 0.012 },
        });
    }
    if (!pair) {
      if (t > 0 && sl.hasFittedCameras()) sl.cameraFor("city_intercation03", t, vp);
      return;
    }
    dockPlace(vp, this.dock);
    pair.mode(t < 1.28 ? "dock" : "apart");
    pair.visible = true;
    pair.layer("front");
    pair.setInteractive(b.o === 0);
    pair.capFlight(false);
    if (t === 0) {
      pair.place(this.dock);
      return;
    }
    const camera = sl.hasFittedCameras()
      ? sl.cameraFor("city_intercation03", t, vp)
      : sl.cameraFor(t, vp);
    const scale = sl.object.scale.x;
    const hand = sl.socket("rightHand");
    hand.getWorldPosition(this.spot);
    this.spot.x -= scale * mix(0.06, 0.38, smooth(seg(t, 2.8, 3.2)));
    this.spot.y += scale * (0.27 + 0.015 * Math.sin(frame.time * 3));
    this.spot.project(camera);
    const x = (this.spot.x * vp.w) / 2;
    const y = (this.spot.y * vp.h) / 2;
    const approach = smooth(seg(t, 0, 1.28));
    const retreat = smooth(seg(t, 1.28, 2.05));
    const height = mix(this.dock.height, vp.h * 0.12, approach);
    pair.place({
      x: mix(this.dock.x, x, approach) + retreat * vp.w,
      y: mix(this.dock.y, y - height * 0.52, approach) - retreat * vp.h * 0.25,
      height,
      pitch: -0.48 * Math.sin(Math.PI * seg(t, 1.08, 1.48)),
    });
    if (t < 1.28) return;
    const doll = pair.doll;
    const caught = smooth(seg(t, 2.95, 3.54));
    this.mouth.copy(this.spot);
    if (sb) sb.socket("mouth").getWorldPosition(this.mouth).project(camera);
    const kick = Math.sin(Math.PI * seg(t, 1.28, 1.84));
    doll.visible = true;
    doll.reset();
    doll.place({
      x: mix(x, (this.mouth.x * vp.w) / 2, caught),
      y: mix(y + kick * vp.h * 0.085, (this.mouth.y * vp.h) / 2, caught),
      height: vp.h * mix(0.09, 0.053, caught),
      roll: kick * 0.65 + 0.14 * Math.sin(8 * t) * (1 - caught),
      pivot: "hips",
    });
    doll.setPose("stand", "scream", 0.48 + 0.45 * caught);
    doll.flail(0.45 * (1 - caught) + 0.1);
  }
}
