/**
 * The hand and the doll across the two sections that share them: the doll falls into the palm,
 * stands up, sits, is tossed onto the first frame of the list, sits there with her legs swinging,
 * and, when the frame grows into the screen, stands, takes hold of its top edge with one hand and
 * hangs there (joint J8). The hand rises, holds her, flicks, and sinks away.
 *
 * `Carry.apply(t, frame)` sets the whole state of both actors for `t` screens since the hand
 * section started. The hand section calls it with its own scroll, the list with `HAND_SCREENS + s`,
 * and in their overlap both give the same `t`, so there is no seam. It is a pure function of `t`
 * plus three pieces of state that follow from it: which socket the doll hangs under, the last two
 * `t` (so a one shot fires on a forward crossing and never in a replay after a jump), and the
 * pointer.
 */
import { ensureDoll, type DollActor } from "../../actors/doll";
import { ensureHand, type HandActor } from "../../actors/hand";
import { ensureMarks, type MarksActor } from "../../fx/comic-marks";
import type { Actors, FrameInfo, PointerState, SectionCtx } from "../../kernel/types";

import { listGeometry, mixRectInto, type ListGeometry, type Rect } from "../list/layout";
import { dollHang, type DollHang } from "../list/selena-frame";

import { FACES } from "./faces";
import {
  HAND_AT,
  HAND_SCREENS,
  HIPS_ABOVE_FEET,
  J6,
  LIST_AT,
  fallEnd,
  handBeats,
  handGeometry,
  listBeats,
  mix,
  newHandBeats,
  newListBeats,
  seg,
  smooth,
  type HandGeometry,
} from "./timeline";

/** Where she sits on the frame's top edge: her feet this many of her heights below the edge. */
const SEAT_DROP = 0.06;
/** How high the toss goes above the straight line, in screens. */
const ARC = 0.2;
/** She is tossed this long after the hand has the last of her weight. */
const TOSS_FLICK = [0.1, 0.36] as const;

export class Carry {
  private readonly hb = newHandBeats();
  private readonly lb = newListBeats();
  private geo: HandGeometry | null = null;
  private lg: ListGeometry | null = null;
  private hang: DollHang | null = null;
  private geoKey = "";
  private prev = -99;
  private cur = -99;
  private seen = -1;
  private readonly rect: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private readonly full: Rect = { x: 0, y: 0, w: 0, h: 0 };
  /** The doll's world point on the palm, for the pointer's look. */
  private readonly place = {
    x: 0,
    y: 0,
    z: 0,
    height: 0,
    pitch: 0,
    yaw: 0,
    roll: 0,
    pivot: "feet" as "feet" | "hips",
  };
  private readonly handPlace = { x: 0, y: 0, z: 0, height: 0, scale: 1 };
  private readonly lookPt = { x: 0, y: 0 };
  private readonly seatPt = { x: 0, y: 0 };

  constructor(
    private readonly hand: HandActor,
    private readonly doll: DollActor,
    private readonly marks: MarksActor | null,
    private readonly pointer: PointerState,
  ) {}

  /** True when `t` crossed `at` forward in a small step (a one shot fires, a jump does not). */
  private crossed(at: number): boolean {
    return this.prev < at && this.cur >= at && this.cur - this.prev < 0.3;
  }

  /**
   * Set both actors for `t`. `withDoll` is false in the hand's lead (the section before still owns
   * the doll there).
   */
  apply(t: number, frame: FrameInfo, withDoll: boolean): void {
    if (frame.frame !== this.seen) {
      this.seen = frame.frame;
      this.prev = this.cur;
    }
    this.cur = t;

    const vp = frame.viewport;
    const key = `${vp.w}x${vp.h}`;
    if (key !== this.geoKey || !this.geo) {
      this.geoKey = key;
      this.geo = handGeometry(vp);
      this.lg = listGeometry(vp);
      this.hang = dollHang(vp);
    }
    const geo = this.geo;
    const hb = handBeats(t, this.hb);
    const s = t - HAND_SCREENS;
    const lb = listBeats(s, this.lb);

    this.applyHand(t, s, geo, hb.rise, hb.drop, hb.react, hb.landed, lb.sink);
    if (!withDoll) return;
    this.applyDoll(t, s, frame, geo);
  }

  private applyHand(
    t: number,
    s: number,
    geo: HandGeometry,
    rise: number,
    drop: number,
    react: number,
    landed: boolean,
    sink: number,
  ): void {
    const hand = this.hand;
    const gone = sink >= 1;
    hand.visible = !gone;
    const p = this.handPlace;
    p.x = geo.x;
    p.y = geo.restY - drop * geo.drop;
    p.z = 0;
    p.height = geo.height;
    p.scale = geo.scale;
    hand.place(p);
    hand.rise(rise);
    hand.sink(sink);
    // The weight of the doll: the fingers cup, and no more. It is gone the moment she leaves.
    const holding = landed && s < LIST_AT.toss[0];
    hand.setBurden(holding ? 1 : 0);
    // The pointer moves the fingers from when she has sat down until the toss begins.
    const open = t >= HAND_AT.react[0] && s < LIST_AT.crouch[0];
    hand.setInteractive(open);
    hand.setReactivity(open ? react : 0);
    // The flick that tosses her: a quick close and an open (the spring overshoots).
    const flick = seg(s, LIST_AT.toss[0] + TOSS_FLICK[0] * 0, LIST_AT.toss[0] + TOSS_FLICK[1]);
    hand.setGrip(flick > 0 && flick < 1 ? 0.85 * Math.sin(Math.PI * flick) : 0);
    if (this.crossed(HAND_AT.land)) hand.impact(1);
  }

  private applyDoll(t: number, s: number, frame: FrameInfo, geo: HandGeometry): void {
    const doll = this.doll;
    const vp = frame.viewport;
    const lg = this.lg;
    const hang = this.hang;
    if (!lg || !hang) return;
    const lb = this.lb;
    const hb = this.hb;
    const P = this.place;

    doll.reset();
    doll.visible = true;
    doll.blinkAuto(true);
    doll.mood(FACES, t);
    this.lookAtPointer(frame);

    const palmX = geo.x + geo.standDx;
    const palmY = geo.restY - geo.drop + geo.standDy;
    const palmRestY = geo.restY + geo.standDy;
    const h0 = geo.dollHeight;
    P.yaw = 0;
    P.pitch = 0;
    P.roll = 0;
    P.pivot = "feet";
    P.z = 0;

    if (t < HAND_AT.land) {
      // The fall goes on from where the bolt section left her (J6: hips as the pivot, a quarter of
      // the way to standing, a little flail), slowly, into the palm. The pose, the size, the depth
      // and the flail all reach the standing doll as she arrives.
      this.detached();
      const f = hb.fall;
      const end = fallEnd(vp);
      P.pivot = "hips";
      P.x = mix(end.x, palmX, f);
      P.y = mix(end.y, palmRestY + HIPS_ABOVE_FEET * h0, f);
      P.height = mix(end.height, h0, f);
      P.z = mix(J6.z, 0, f);
      const arrive = 1 - smooth(seg(f, 0.75, 1));
      doll.setPose("fall", "stand", mix(J6.standWeight, 1, smooth(f)));
      doll.flail((J6.flail + 0.45 * Math.sin(Math.PI * f)) * arrive, mix(J6.flailRate, 1.2, f));
      doll.squash(0.1 * smooth(seg(f, 0.85, 1)));
      doll.place(P);
      return;
    }

    if (this.crossed(HAND_AT.land)) {
      doll.bump(1);
      this.marks?.emit("poof", { at: { x: geo.x + geo.standDx, y: palmRestY }, size: 130 });
    }

    const standUp = 1 - smooth(seg(s, -0.22, -0.06));
    const sitW = hb.sit * standUp;
    const toss = lb.toss;

    if (s < LIST_AT.toss[0]) {
      // On the palm: she lands, stands, sits, then stands again and crouches for the toss.
      this.onPalm();
      P.x = 0;
      P.y = 0;
      P.height = h0;
      doll.setPose("stand", "sit", sitW);
      doll.squash(-0.3 * lb.crouch);
      doll.place(P);
      return;
    }

    const seat = this.seat(lg.sitX, lg.sitY, lg.dollHeight);
    if (toss < 1 && s < LIST_AT.toss[1]) {
      // In the air: from the palm to the frame's top edge on a parabola, stretched.
      this.onPalm();
      const u = 1 - (1 - toss) ** 1.6;
      P.x = (seat.x - palmX) * u;
      P.y = (seat.y - palmY) * u + ARC * vp.h * 4 * u * (1 - u);
      P.height = mix(h0, lg.dollHeight, u);
      doll.flail(0.45 * Math.sin(Math.PI * toss), 1.1);
      doll.squash(0.28 * Math.sin(Math.PI * Math.min(1, toss * 1.2)));
      doll.place(P);
      return;
    }

    // On the frame.
    this.detached();
    if (this.crossed(HAND_SCREENS + LIST_AT.toss[1])) {
      doll.bump(0.9);
      this.marks?.emit("poof", { at: { x: seat.x, y: seat.y }, size: 110 });
      this.marks?.emit("dust", { at: { x: seat.x, y: seat.y }, size: 60 });
    }
    this.onFrame(lg.frame, seat.x, vp, hang, lg.dollHeight);
  }

  /** The doll rides the frame's top edge as the frame grows, stands, and hangs from it. */
  private onFrame(
    frame: Rect,
    seatX: number,
    vp: { w: number; h: number },
    hang: { x: number; y: number; height: number },
    dollHeight: number,
  ): void {
    const doll = this.doll;
    const lb = this.lb;
    const P = this.place;
    const full = this.full;
    full.x = 0;
    full.y = 0;
    full.w = vp.w;
    full.h = vp.h;
    const grown = mixRectInto(this.rect, frame, full, lb.expand);
    const e = lb.expandRaw;
    // The edge pushes her up: she stands as it rises, then takes hold of it.
    const settle = lb.settle;
    const standW = smooth(seg(e, 0.0, 0.3));
    const hangW = smooth(seg(e, 0.25, 0.75));
    const h = mix(dollHeight, hang.height, hangW);
    const edge = vp.h / 2 - grown.y;
    const feetY = edge - SEAT_DROP * h * (1 - standW);
    const x = mix(seatX, hang.x, smooth(seg(e, 0.1, 0.9)));
    P.x = mix(x, hang.x, hangW);
    P.y = mix(feetY, hang.y, hangW);
    P.height = h;
    doll.setPose("sit", "stand", standW);
    // Her seat has the legs swinging over the edge.
    doll.dangle(settle * (1 - standW));
    doll.hang(hangW, 1);
    doll.place(P);
    if (
      this.crossed(
        HAND_SCREENS + LIST_AT.expandFrom + 0.75 * (LIST_AT.expandTo - LIST_AT.expandFrom),
      )
    ) {
      doll.bump(0.6);
    }
  }

  /** Her feet's place when she sits on the top edge at `x`. */
  private seat(x: number, edgeY: number, height: number): { x: number; y: number } {
    this.seatPt.x = x;
    this.seatPt.y = edgeY - SEAT_DROP * height;
    return this.seatPt;
  }

  private lookAtPointer(frame: FrameInfo): void {
    const ps = this.pointer;
    if (ps.type === "touch" ? !ps.down : !ps.inside) {
      this.doll.look(null);
      return;
    }
    this.lookPt.x = ps.x - frame.viewport.w / 2;
    this.lookPt.y = frame.viewport.h / 2 - ps.y;
    this.doll.look(this.lookPt);
  }

  private onPalm(): void {
    const stand = this.hand.socket("stand");
    if (this.doll.parentSocket !== stand) this.doll.attach(stand, { keepWorld: false });
  }

  private detached(): void {
    if (this.doll.parentSocket) this.doll.detach();
  }
}

const made = new WeakMap<Actors, Promise<Carry>>();

/**
 * The one carry both sections use (a second one would fire every one shot twice in their overlap).
 * The hand is built first: its update runs before the doll's, so a doll in the palm is never a frame
 * late. The marks are a nicety: a failure to build them leaves the choreography whole.
 */
export function ensureCarry(ctx: SectionCtx): Promise<Carry> {
  let p = made.get(ctx.actors);
  if (!p) {
    p = (async () => {
      const hand = await ensureHand(ctx);
      const doll = await ensureDoll(ctx);
      let marks: MarksActor | null = null;
      try {
        marks = await ensureMarks(ctx);
      } catch {
        marks = null;
      }
      return new Carry(hand, doll, marks, ctx.pointer.state);
    })();
    p.catch(() => made.delete(ctx.actors));
    made.set(ctx.actors, p);
  }
  return p;
}
