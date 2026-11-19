/**
 * The bend section: Tetra closes the comic, stands, and bends the fan pictures out of the edges into
 * garuda2026.offwg.com's hero (posters at different tilts round her), then into a 3D ring, throws the
 * ring away, calls a spiral of the ten splash arts round her whose last picture is the drone's, and
 * the drone climbs out of its paper and meets her. `beats.ts` says when, `formations.ts` where,
 * `meet.ts` how the drone goes; this file puts them on the actors and the cards, every frame, as a
 * pure function of the scroll plus the pointer. See `docs/design/home/section-bend.md`.
 */
import type { Backdrop } from "../../fx/backdrop";
import { ensureBackdrop } from "../../fx/backdrop";
import type { MarksActor } from "../../fx/comic-marks";
import { ensureMarks } from "../../fx/comic-marks";
import { ensureDrone, type DroneActor } from "../../actors/drone";
import { ensureTetra, type TetraActor } from "../../actors/tetra";
import type { FrameInfo, SectionCtx, SectionRuntime } from "../../kernel/types";
import { sectionStart } from "../../kernel/where";

import { backdropAt } from "./backdrop";
import {
  DRONE_CARD,
  SPIRAL_CARDS,
  T,
  artNeeded,
  beatAt,
  fanNeeded,
  newBeat,
  ramp,
  smoother,
  type BeatState,
} from "./beats";
import { CardLayer } from "./cards";
import {
  FLIGHT,
  RING_CARDS,
  WALL_CARDS,
  arriveAt,
  arrivalStart,
  copyPose,
  fly,
  flightAt,
  gatherAt,
  makePose,
  outAt,
  paperPose,
  ringExit,
  ringPose,
  ringTurn,
  spiralExit,
  spiralInAt,
  spiralPose,
  spiralStart,
  throwEase,
  wallCount,
  wallDrop,
  wallPose,
  type CardPose,
  type Vp,
} from "./formations";
import { droneAt, newDroneWant, paperDrone, restOf } from "./meet";
import { restScreens } from "./plays";
import { platePlace, wallPictures } from "./order";
import { isRovingKey, rovingNext, rovingStart } from "./roving";
import {
  FAN_PICS,
  SPIRAL_ORDER,
  artSources,
  droneSource,
  fanSource,
  type PicSource,
} from "./pictures";

/** The cards: the wall and the ring use the first ones, the spiral the next ones. */
const SPIRAL_BASE = WALL_CARDS;
const TOTAL_CARDS = WALL_CARDS + SPIRAL_CARDS;
/** The slots of the picture store. */
const FAN_BASE = 0;
const ART_BASE = FAN_PICS.length;
const SPRITE_SLOT = ART_BASE + SPIRAL_ORDER.length;
/** How long the flights into the ring, out of it and into the spiral take, in screens. */
const GATHER_LEN = 0.6;
const OUT_LEN = 0.5;
const SPIRAL_IN_LEN = 0.75;
/** The top bar's foot, in pixels: a credit plate never stands under it. */
const NAV_INSET = 78;
/** The paper of the drone. */
const PAPER: readonly [number, number, number] = [0.97, 0.94, 0.9];

/**
 * Where each group of words is shown (beats of the section's clock), and the dwell the page goes to
 * (screens from the section's start) to show it: the first rest holds the wall, the second the spiral.
 */
type FocusKind = "fan" | "art" | "notice" | "plates";
const FOCUS_BEATS: Record<FocusKind, { from: number; to: number; at: number }> = {
  fan: { from: T.fanTitleIn + 0.3, to: T.fanTitleOut, at: restScreens(1) },
  art: { from: T.artTitleIn + 0.3, to: T.artTitleOut, at: restScreens(2) },
  notice: { from: T.fanTitleIn + 0.3, to: T.outTo - 0.4, at: restScreens(1) },
  plates: { from: T.holdFrom - 0.3, to: T.outFrom + 0.3, at: restScreens(1) },
};

const sources = (): PicSource[] => [...FAN_PICS.map(fanSource), ...artSources(), droneSource()];

/** A point in the stage frame the marks and the actors can be given (a section keeps one and moves it). */
interface Pt {
  x: number;
  y: number;
}

class BendRuntime implements SectionRuntime {
  private readonly layer: CardLayer;
  private readonly beat = newBeat();
  private readonly want = newDroneWant();
  private readonly pics: number[];
  private readonly a = makePose();
  private readonly b = makePose();
  private readonly c = makePose();
  private readonly hover = new Float32Array(TOTAL_CARDS);
  private readonly readyFlag: boolean[] = [];
  /** The nine backdrop shaders are compiled (or there is no backdrop): a zone's first draw is no hitch. */
  private warmed = false;
  private readonly removeHit: () => void;
  private readonly groups: {
    fan: HTMLElement | null;
    art: HTMLElement | null;
    notice: HTMLElement | null;
  };
  private readonly groupValue = { fan: -1, art: -1, notice: -1 };
  private readonly plates: Array<HTMLElement | null> = [];
  private readonly plateBox = { w: 280, h: 150 };
  /** Where the plate stands (written by `platePlace`). */
  private readonly platePt: Pt = { x: 0, y: 0 };
  /** One point for each loop of marks: a loop keeps the point it is given and reads it when it is drawn. */
  private readonly lp = {
    dustL: { x: 0, y: 0 },
    dustR: { x: 0, y: 0 },
    air: { x: 0, y: 0 },
    water: { x: 0, y: 0 },
    fire: { x: 0, y: 0 },
    heart: { x: 0, y: 0 },
    glad: { x: 0, y: 0 },
  };
  private readonly paper = { x: 0, y: 0, height: 0, card: 0 };
  private readonly loops: {
    dustL: ReturnType<MarksActor["sustain"]>;
    dustR: ReturnType<MarksActor["sustain"]>;
    air: ReturnType<MarksActor["sustain"]>;
    water: ReturnType<MarksActor["sustain"]>;
    fire: ReturnType<MarksActor["sustain"]>;
    heart: ReturnType<MarksActor["sustain"]>;
    glad: ReturnType<MarksActor["sustain"]>;
  };

  /** The scroll position (in screens) at which the section starts, known once it has run. */
  private startS = Number.NaN;
  /** A group the keyboard reached before the section was running: the page moves to it on the next frame. */
  private pendingFocus: FocusKind | null = null;
  private fanOn = false;
  private artOn = false;
  private lastWave = -1;
  private popped = false;
  private hugged = false;
  private spin = 0;
  private lx = 0;
  private ly = 0;
  private candidate = -1;
  private hoverCard = -1;
  private pinned = -1;
  private shown = -1;
  private shownCard = -1;
  private shownUntil = 0;
  private plateHover = false;
  private wasDown = false;
  private live = false;
  private interactive = false;
  private readonly removers: Array<() => void> = [];

  constructor(
    private readonly ctx: SectionCtx,
    private readonly tetra: TetraActor,
    private readonly drone: DroneActor,
    private readonly marks: MarksActor,
    private readonly backdrop: Backdrop | null,
  ) {
    this.layer = new CardLayer(ctx.stage, sources(), TOTAL_CARDS, () => {
      this.readyFlag.fill(false);
    });
    // The owner asked for the fan pictures picked at random: a new order for each visit.
    this.pics = wallPictures(
      WALL_CARDS,
      FAN_PICS.length,
      (Date.now() ^ (Math.random() * 1e9)) >>> 0,
    );
    for (let i = 0; i < WALL_CARDS; i += 1) this.layer.setPicture(i, FAN_BASE + this.pics[i]!);
    for (let k = 0; k < SPIRAL_ORDER.length; k += 1)
      this.layer.setPicture(SPIRAL_BASE + k, ART_BASE + k);
    this.layer.setPaper(SPIRAL_BASE + DRONE_CARD, SPRITE_SLOT, PAPER);
    this.readyFlag.length = TOTAL_CARDS;
    this.readyFlag.fill(false);

    const text = ctx.dom.text;
    this.groups = {
      fan: text.querySelector<HTMLElement>('[data-bend="fan"]'),
      art: text.querySelector<HTMLElement>('[data-bend="art"]'),
      notice: text.querySelector<HTMLElement>('[data-bend="notice"]'),
    };
    text.querySelectorAll<HTMLElement>("[data-bend-plate]").forEach((el) => {
      this.plates[Number(el.dataset.bendPlate)] = el;
    });
    this.wirePlates(text);
    this.wireFocus(text);

    const label = (): string | undefined =>
      this.candidate >= 0 && this.candidate < WALL_CARDS && this.live ? "CREDIT" : undefined;
    this.removeHit = ctx.pointer.add({
      id: "bend-art",
      get cursor(): string | undefined {
        return label();
      },
      test: (cx, cy) => this.test(cx, cy),
      press: () => {
        this.press();
      },
    });

    this.loops = {
      dustL: marks.sustain("dust", { size: 64 }),
      dustR: marks.sustain("dust", { size: 64 }),
      air: marks.sustain("speed", { size: 90 }),
      water: marks.sustain("sparkle", { size: 46 }),
      fire: marks.sustain("sparkle", { size: 54, color: "gold" }),
      heart: marks.sustain("heart", { size: 40 }),
      glad: marks.sustain("sparkle", { size: 40 }),
    };
    tetra.book.auto();
    if (backdrop) {
      void backdrop
        .warm([
          "pixel-blast",
          "earth",
          "air",
          "water",
          "fire",
          "soft-aurora",
          "iridescence",
          "aurora",
          "particles",
        ])
        .finally(() => {
          this.warmed = true;
        });
    } else {
      this.warmed = true;
    }
    // The fan pictures go to the GPU now, a screen or two before they are seen, not in the frame they are first drawn.
    this.textures(-2);
  }

  // -------------------------------------------------------------------------------------- the frame

  update(local: number, frame: FrameInfo): void {
    const vp = frame.viewport;
    const b = beatAt(local, this.beat, vp);
    const s = b.s;
    this.startS = sectionStart("bend");
    if (this.pendingFocus) {
      const kind = this.pendingFocus;
      this.pendingFocus = null;
      this.moveTo(kind, s);
    }
    this.layer.store.now = frame.time;
    this.textures(s);
    // The credits answer while the wall stands, and a moment into the gather.
    this.live = s > T.holdFrom - 0.2 && s < T.holdTo + 0.5;
    this.interactive = s > T.bendFrom + 0.3 && s < T.glideFrom + 0.2;
    const want = backdropAt(b);
    this.backdrop?.set(want.kind, want.options);
    this.pointer(frame);
    this.cards(b, vp, frame);
    this.actors(b, vp, frame);
    this.words(b);
    this.platesStep(b, vp, frame);
  }

  /**
   * The ready gate. The actors are built before this runtime exists, so what a zone can still wait
   * for is the shaders: the first stances draw four new backdrops in a few seconds.
   */
  ready(): boolean {
    return this.warmed;
  }

  enter(): void {
    this.lastWave = -1;
    this.popped = false;
    this.hugged = false;
    this.drone.reset();
    this.layer.hideAll();
  }

  leave(): void {
    this.startS = Number.NaN;
    this.layer.hideAll();
    this.pinned = -1;
    this.shown = -1;
    this.paintPlates(-1);
    this.setGroup("fan", 0);
    this.setGroup("art", 0);
    this.setGroup("notice", 0);
  }

  dispose(): void {
    this.removeHit();
    for (const remove of this.removers) remove();
    this.removers.length = 0;
    this.layer.dispose();
  }

  // ------------------------------------------------------------------------------------ the pictures

  /** The pictures a part of the section needs are on the GPU, and only then (about 90 MB at most, 50 at a time). */
  private textures(s: number): void {
    const fan = fanNeeded(s);
    const art = artNeeded(s);
    const store = this.layer.store;
    if (fan !== this.fanOn) {
      this.fanOn = fan;
      for (let i = 0; i < FAN_PICS.length; i += 1) {
        if (fan) store.want(FAN_BASE + i);
        else store.drop(FAN_BASE + i);
      }
    }
    if (art !== this.artOn) {
      this.artOn = art;
      for (let k = 0; k < SPIRAL_ORDER.length; k += 1) {
        if (art) store.want(ART_BASE + k);
        else store.drop(ART_BASE + k);
      }
      if (art) store.want(SPRITE_SLOT);
      else store.drop(SPRITE_SLOT);
    }
    // A picture that has arrived (or been let go) since the card last looked: point the card at it.
    for (let i = 0; i < TOTAL_CARDS; i += 1) {
      const card = this.layer.cards[i]!;
      const slot = i === SPIRAL_BASE + DRONE_CARD ? SPRITE_SLOT : card.pic;
      if (slot < 0) continue;
      const ready = store.isReady(slot);
      if (ready === this.readyFlag[i]) continue;
      this.readyFlag[i] = ready;
      if (i === SPIRAL_BASE + DRONE_CARD) this.layer.setPaper(i, SPRITE_SLOT, PAPER);
      else this.layer.refresh(i);
    }
  }

  // -------------------------------------------------------------------------------------- the cards

  private cards(b: BeatState, vp: Vp, frame: FrameInfo): void {
    const layer = this.layer;
    const s = b.s;
    const dt = frame.dt;
    const store = layer.store;
    const k = dt > 0 ? Math.min(1, dt * 8) : 0;

    const wallN = wallCount(vp);
    const ringOn = s > T.gatherFrom - 0.2 && s < T.outTo + 0.4;
    if (ringOn) this.spin += dt * 0.06;
    const turn = ringTurn(s) + this.spin;

    for (let i = 0; i < WALL_CARDS; i += 1) {
      const pose = this.c;
      if (i >= wallN || s < arriveAt(i, vp) - 0.001 || s > T.outTo + 0.8) {
        layer.hide(i);
        continue;
      }
      this.wallCard(i, s, turn, vp, frame, pose);
      this.hover[i] = this.hover[i]! + ((this.hoverCard === i ? 1 : 0) - this.hover[i]!) * k;
      const h = this.hover[i]!;
      if (h > 0.001) {
        pose.z += 46 * h;
        pose.size *= 1 + 0.05 * h;
        pose.blur *= 1 - h;
      }
      layer.place(i, pose, store.reveal(this.pics[i]! + FAN_BASE), h, 0, dt);
    }
    for (let i = wallN; i < WALL_CARDS; i += 1) layer.hide(i);

    for (let j = 0; j < SPIRAL_CARDS; j += 1) {
      const i = SPIRAL_BASE + j;
      const inAt = spiralInAt(j);
      if (s < inAt - 0.001 || s > T.popTo + 0.9) {
        layer.hide(i);
        continue;
      }
      const pose = this.c;
      this.spiralCard(j, s, b, vp, pose);
      this.hover[i] = this.hover[i]! + ((this.hoverCard === i ? 1 : 0) - this.hover[i]!) * k;
      const h = this.hover[i];
      if (h > 0.001) {
        pose.z += 40 * h;
        pose.size *= 1 + 0.04 * h;
      }
      const slot = j === DRONE_CARD ? SPRITE_SLOT : ART_BASE + j;
      layer.place(
        i,
        pose,
        j === DRONE_CARD ? 1 : store.reveal(slot),
        h,
        j === DRONE_CARD ? b.pop : 0,
        dt,
      );
    }
  }

  /** One poster of the wall, through its life: thrown in, standing, gathered into the ring, thrown off. */
  private wallCard(
    i: number,
    s: number,
    turn: number,
    vp: Vp,
    frame: FrameInfo,
    out: CardPose,
  ): void {
    const a = this.a;
    const b = this.b;
    const arrive = arriveAt(i, vp);
    const eIn = flightAt(s, arrive, FLIGHT);
    wallPose(i, vp, b);
    if (eIn < 1) {
      arrivalStart(i, vp, a);
      fly(a, b, throwEase(eIn), i % 2 === 0 ? 0.35 : -0.35, out);
      out.opacity = Math.min(1, eIn * 6);
    } else {
      copyPose(b, out);
    }
    this.live2(i, out, frame.time);

    const gather = gatherAt(i, vp);
    if (s < gather) return;
    // The wall poster as it stands when it leaves (no live motion: the flight starts from the slot).
    copyPose(b, a);
    if (i >= RING_CARDS) {
      wallDrop(a, vp, b);
      fly(a, b, smoother(flightAt(s, gather, GATHER_LEN)), 0, out);
      return;
    }
    ringPose(i, RING_CARDS, turn, vp, b);
    const eG = flightAt(s, gather, GATHER_LEN);
    if (eG < 1) fly(a, b, smoother(eG), 0.9, out);
    else copyPose(b, out);
    const eO = flightAt(s, outAt(i), OUT_LEN);
    if (eO > 0) {
      copyPose(out, a);
      ringExit(a, vp, b);
      fly(a, b, smoother(eO), 0.5, out);
    }
  }

  /** The idle drift, the pointer's parallax: a standing poster is alive (garuda's numbers, scaled). */
  private live2(i: number, pose: CardPose, time: number): void {
    const live = pose.live;
    if (live <= 0) return;
    const seed = i * 1.37 + 0.3;
    pose.y += Math.sin(0.6 * time + seed) * 9 * live;
    pose.x += Math.cos(0.45 * time + seed) * 7 * live;
    pose.rx += Math.sin(0.5 * time + seed) * 0.05 * live;
    pose.ry += Math.cos(0.4 * time + seed) * 0.07 * live;
    pose.rz += Math.sin(0.3 * time + seed) * 0.04 * live;
    const depth = pose.z + 60;
    pose.x += this.lx * depth * 0.1 * live;
    pose.y -= this.ly * depth * 0.07 * live;
    pose.ry += this.lx * 0.1 * live;
    pose.rx += this.ly * 0.06 * live;
  }

  /** One card of the spiral: flies in, turns round her with the advance, and the last one goes to the stage. */
  private spiralCard(j: number, s: number, b: BeatState, vp: Vp, out: CardPose): void {
    const a = this.a;
    const t = this.b;
    spiralPose(j, b.adv, vp, t);
    const eIn = flightAt(s, spiralInAt(j), SPIRAL_IN_LEN);
    if (eIn < 1) {
      spiralStart(j, vp, a);
      fly(a, t, smoother(eIn), j % 2 === 0 ? 0.6 : -0.6, out);
    } else {
      copyPose(t, out);
    }
    if (j === DRONE_CARD) {
      // To the stage on the right of Tetra, then it falls away once the drone is out.
      copyPose(out, a);
      paperPose(vp, t);
      fly(a, t, b.glide, 0.3, out);
      const fall = ramp(s, T.popTo + 0.05, T.popTo + 0.4);
      if (fall > 0) {
        out.y -= vp.h * 0.55 * fall * fall;
        out.rz += 0.7 * fall;
        out.x -= vp.w * 0.04 * fall;
        out.opacity *= 1 - ramp(fall, 0.5, 1);
      }
      return;
    }
    if (b.glide > 0) {
      copyPose(out, a);
      spiralExit(a, vp, t);
      fly(a, t, b.glide, 0, out);
    }
  }

  // ------------------------------------------------------------------------------------- the actors

  private actors(b: BeatState, vp: Vp, frame: FrameInfo): void {
    const { tetra, drone } = this;
    const s = b.s;
    const w = vp.w;
    const h = vp.h;

    // The drone first: Tetra hugs where it is.
    droneAt(b, vp, frame.time, this.want);
    const want = this.want;
    let dx = want.x;
    let dy = want.y;
    if (s >= T.goTo - 0.12) {
      // At the rest it keeps her company and follows the cursor, politely: a small step toward it.
      const p = this.ctx.pointer.state;
      const rest = restOf(vp);
      const k = ramp(s, T.goTo - 0.12, T.goTo + 0.05);
      if (p.inside && p.type === "mouse") {
        const px = p.x - w / 2;
        const py = h / 2 - p.y;
        dx += Math.max(-0.06 * w, Math.min(0.06 * w, (px - rest.x) * 0.1)) * k;
        dy += Math.max(-0.05 * h, Math.min(0.05 * h, (py - rest.y) * 0.1)) * k;
      }
    }

    tetra.visible = true;
    tetra.setInteractive(true);
    tetra.place({
      x: b.spot.tx * w,
      y: b.spot.ty * h,
      height: b.spot.th * h,
      flip: b.face < 0 && b.go > 0.02,
    });
    tetra.pose(b.pose, b.blend);
    tetra.runSpeed(0.55);
    tetra.bend(b.bend, b.aim);
    if (b.pose === "pat") tetra.patFrom(1, b.pat);
    if (b.pose === "hug") tetra.hugAt(dx, dy);
    tetra.look(want.visible && want.look && s >= T.meetFrom ? { x: want.x, y: want.y } : "pointer");
    if (s < T.meetFrom - 0.05) tetra.setFace(null);

    if (want.visible) {
      drone.visible = true;
      drone.layer("front");
      if (!this.popped) {
        this.popped = true;
        drone.appear();
        paperDrone(vp, this.paper);
        // The poof belongs to the moment it comes out of the paper: a jump past it (a seek, Back) gets none.
        if (s < T.popTo + 0.25) this.burst(frame.dt);
      }
      drone.place({ x: dx, y: dy, height: want.height });
      if (want.look) drone.look({ x: want.lookX, y: want.lookY });
      else drone.look("pointer");
      drone.face(b.pat > 0 || b.hug > 0 ? "heart" : "happy", 1);
      if (b.hug > 0 && !this.hugged) {
        this.hugged = true;
        tetra.emoteFace("laugh", 1.4);
      }
      if (b.hug === 0) this.hugged = false;
    } else if (this.popped) {
      this.popped = false;
      drone.disappear();
    }

    this.waveMarks(b, frame);
    this.loopMarks(b, dx, dy);
  }

  /** The poof, the flash and the stars when the drone comes out of its paper. */
  private burst(dt: number): void {
    if (dt <= 0) return;
    const at = { x: this.paper.x, y: this.paper.y };
    this.marks.emit("flash", { at, size: this.paper.card * 0.5 });
    this.marks.emit("poof", { at: { x: at.x, y: at.y }, size: this.paper.card * 0.55 });
    this.marks.emit("starburst", { at: { x: at.x, y: at.y }, size: this.paper.card * 0.45 });
    this.tetra.emoteFace("surprised", 1.1);
    this.tetra.play("startle");
  }

  /** One burst when a stance begins: the stamp's dust, the wind, the splash, the fire. */
  private waveMarks(b: BeatState, frame: FrameInfo): void {
    if (b.wave === this.lastWave) return;
    const was = this.lastWave;
    this.lastWave = b.wave;
    if (b.wave < 0 || frame.dt <= 0 || was < 0) {
      if (b.wave >= 0 && was < 0 && frame.dt > 0) this.stanceBurst(b.wave);
      return;
    }
    this.stanceBurst(b.wave);
  }

  private stanceBurst(wave: number): void {
    const m = this.tetra.marks();
    const scale = Math.max(40, m.scale);
    const marks = this.marks;
    if (wave === 0) {
      marks.emit("dust", {
        at: { x: m.ground.x - 0.18 * scale, y: m.ground.y },
        size: 0.3 * scale,
      });
      marks.emit("dust", {
        at: { x: m.ground.x + 0.18 * scale, y: m.ground.y },
        size: 0.3 * scale,
        rotation: Math.PI,
      });
    } else if (wave === 1) {
      marks.emit("speed", { at: { x: m.handL.x, y: m.handL.y }, size: 0.5 * scale, rotation: 0 });
      marks.emit("speed", {
        at: { x: m.handR.x, y: m.handR.y },
        size: 0.5 * scale,
        rotation: Math.PI,
      });
    } else if (wave === 2) {
      marks.emit("beads", { at: { x: m.chest.x, y: m.chest.y }, size: 0.4 * scale, color: "sky" });
      marks.emit("sparkle", { at: { x: m.handL.x, y: m.handL.y }, size: 0.25 * scale });
    } else {
      marks.emit("flash", { at: { x: m.handR.x, y: m.handR.y }, size: 0.7 * scale });
      marks.emit("spark", { at: { x: m.handL.x, y: m.handL.y }, size: 0.5 * scale });
    }
  }

  /** The loops that run while a stance, the pat or the hug does (they end on their own when not set). */
  private loopMarks(b: BeatState, dx: number, dy: number): void {
    const m = this.tetra.marks();
    const scale = Math.max(40, m.scale);
    const k = b.pose === "bend" ? b.blend : 0;
    const lp = this.lp;
    if (k > 0.2) {
      if (b.bend === "earth") {
        lp.dustL.x = m.ground.x - 0.2 * scale;
        lp.dustL.y = m.ground.y;
        this.loops.dustL.update(lp.dustL, 0.5 * k);
        lp.dustR.x = m.ground.x + 0.2 * scale;
        lp.dustR.y = m.ground.y;
        this.loops.dustR.update(lp.dustR, 0.5 * k);
      } else if (b.bend === "air") {
        lp.air.x = b.aim > 0 ? m.handL.x : m.handR.x;
        lp.air.y = b.aim > 0 ? m.handL.y : m.handR.y;
        this.loops.air.update(lp.air, 0.6 * k, b.aim > 0 ? Math.PI : 0);
      } else if (b.bend === "water") {
        lp.water.x = m.handL.x;
        lp.water.y = m.handL.y;
        this.loops.water.update(lp.water, k);
      } else {
        lp.fire.x = m.handR.x;
        lp.fire.y = m.handR.y;
        this.loops.fire.update(lp.fire, k);
      }
    }
    if (b.pat > 0.5) {
      lp.heart.x = m.crown.x;
      lp.heart.y = m.crown.y + 0.2 * scale;
      this.loops.heart.update(lp.heart, 1);
    } else if (b.hug > 0.5) {
      lp.heart.x = (m.chest.x + dx) / 2;
      lp.heart.y = Math.max(m.chest.y, dy) + 0.2 * scale;
      this.loops.heart.update(lp.heart, 1);
    }
    if (b.s > T.popTo && b.s < T.meetFrom + 0.05) {
      lp.glad.x = dx;
      lp.glad.y = dy;
      this.loops.glad.update(lp.glad, 0.8);
    }
  }

  // ------------------------------------------------------------------------------------- the words

  private words(b: BeatState): void {
    this.setGroup("fan", b.fanTitle);
    this.setGroup("art", b.artTitle);
    const s = b.s;
    this.setGroup(
      "notice",
      ramp(s, T.fanTitleIn, T.fanTitleIn + 0.3) * (1 - ramp(s, T.outTo - 0.4, T.outTo)),
    );
  }

  /** Fade and lift a group of words. Written only when the value moved, and hidden for good at 0. */
  private setGroup(name: "fan" | "art" | "notice", v: number): void {
    const el = this.groups[name];
    if (!el) return;
    const q = Math.round(v * 500) / 500;
    if (q === this.groupValue[name]) return;
    this.groupValue[name] = q;
    el.style.opacity = String(q);
    // Off, a group takes no press but stays in the tab order: a keyboard that reaches it moves the page.
    el.dataset.live = q > 0.05 ? "1" : "0";
    el.style.transform = `translate3d(0, ${((1 - q) * 26).toFixed(1)}px, 0)`;
  }

  // ----------------------------------------------------------------------------------- the pointer

  private pointer(frame: FrameInfo): void {
    const p = this.ctx.pointer.state;
    const dt = frame.dt;
    const mouse = p.inside && p.type === "mouse";
    const tx = mouse ? p.nx : 0;
    const ty = mouse ? p.ny : 0;
    const k = dt > 0 ? Math.min(1, dt * 3) : 0;
    this.lx += (tx - this.lx) * k;
    this.ly += (ty - this.ly) * k;
    this.hoverCard = p.hit === "bend-art" && this.interactive ? this.candidate : -1;
    // A press on nothing lets go of a pinned plate.
    if (p.down && !this.wasDown && this.hoverCard < 0 && !this.plateHover) this.pinned = -1;
    this.wasDown = p.down;
  }

  private test(cx: number, cy: number): number | null {
    if (!this.interactive) {
      this.candidate = -1;
      return null;
    }
    const vp = this.ctx.viewport();
    const i = this.layer.hit(cx - vp.w / 2, vp.h / 2 - cy, TOTAL_CARDS);
    this.candidate = i;
    return i < 0 ? null : this.layer.hitDepth;
  }

  private press(): void {
    const i = this.candidate;
    if (i < 0 || i >= WALL_CARDS || !this.live) return;
    const pic = this.pics[i]!;
    this.pinned = this.pinned === pic ? -1 : pic;
    this.pinnedCard = i;
  }

  private pinnedCard = -1;

  // ------------------------------------------------------------------------------------- the focus

  /** A control of the section took the focus: if its group is not on the screen, move the page to where it is. */
  private wireFocus(text: HTMLElement): void {
    const reach = (target: Element | null): void => {
      const group = target?.closest<HTMLElement>("[data-bend]");
      const kind = group?.dataset.bend as FocusKind | undefined;
      if (!kind || !(kind in FOCUS_BEATS)) return;
      // The section is not running yet: the stage moves the page to its middle, then this follows.
      if (Number.isNaN(this.startS)) this.pendingFocus = kind;
      else this.moveTo(kind, this.beat.s);
    };
    const onFocus = (event: FocusEvent): void => {
      reach(event.target instanceof Element ? event.target : null);
    };
    text.addEventListener("focusin", onFocus);
    // A keyboard that reached a control before this section was built (the page moved to it, then
    // the section mounted): the focus is already there, so answer it now.
    const active = document.activeElement;
    if (active && text.contains(active)) reach(active);
    this.removers.push(() => {
      text.removeEventListener("focusin", onFocus);
    });
  }

  private moveTo(kind: FocusKind, s: number): void {
    const place = FOCUS_BEATS[kind];
    if (s >= place.from && s <= place.to) return;
    this.ctx.scroll.to(this.startS + place.at, { immediate: true });
  }

  // ------------------------------------------------------------------------------------ the plates

  /** The credit plates are real DOM: a keyboard that reaches one shows it, the pointer shows it by the card. */
  private wirePlates(text: HTMLElement): void {
    const list = text.querySelector<HTMLElement>('[data-bend="plates"]');
    if (!list) return;
    const enter = (): void => {
      this.plateHover = true;
    };
    const leave = (): void => {
      this.plateHover = false;
    };
    const focusIn = (event: FocusEvent): void => {
      const li = (event.target as HTMLElement).closest<HTMLElement>("[data-bend-plate]");
      if (!li) return;
      this.pinned = Number(li.dataset.bendPlate);
      this.pinnedCard = this.pics.indexOf(this.pinned);
    };
    const focusOut = (event: FocusEvent): void => {
      const next = event.relatedTarget as Node | null;
      if (!next || !list.contains(next)) this.pinned = -1;
    };
    list.addEventListener("pointerenter", enter);
    list.addEventListener("pointerleave", leave);
    list.addEventListener("focusin", focusIn);
    list.addEventListener("focusout", focusOut);
    this.removers.push(() => {
      list.removeEventListener("pointerenter", enter);
      list.removeEventListener("pointerleave", leave);
      list.removeEventListener("focusin", focusIn);
      list.removeEventListener("focusout", focusOut);
    }, this.rove(list));
  }

  /**
   * One tab stop for the whole list of credit plates (fifteen plates, thirty links): the links of
   * the plate last used take the tab key, the others are taken out of it, and the arrow keys, Home
   * and End move between plates. The links stay in the page for a screen reader and for a visitor
   * without scripts, which keeps the credits and the takedown links. Returns the way to undo it.
   */
  private rove(list: HTMLElement): () => void {
    const plates = Array.from(list.querySelectorAll<HTMLElement>("[data-bend-plate]"));
    const linksOf = (li: HTMLElement): HTMLElement[] =>
      Array.from(li.querySelectorAll<HTMLElement>("a[href]"));
    const has = plates.map((li) => linksOf(li).length > 0);
    let current = rovingStart(0, has);
    const paint = (): void => {
      plates.forEach((li, i) => {
        for (const link of linksOf(li)) link.tabIndex = i === current ? 0 : -1;
      });
    };
    paint();
    const onKey = (event: KeyboardEvent): void => {
      if (event.altKey || event.ctrlKey || event.metaKey || !isRovingKey(event.key)) return;
      const li = (event.target as HTMLElement).closest<HTMLElement>("[data-bend-plate]");
      const from = li ? plates.indexOf(li) : -1;
      if (from < 0) return;
      const to = rovingNext(event.key, from, has);
      if (to === null) return;
      event.preventDefault();
      current = to;
      paint();
      linksOf(plates[to]!)[0]?.focus();
    };
    const onFocus = (event: FocusEvent): void => {
      const li = (event.target as HTMLElement).closest<HTMLElement>("[data-bend-plate]");
      const i = li ? plates.indexOf(li) : -1;
      if (i < 0 || i === current) return;
      current = i;
      paint();
    };
    list.addEventListener("keydown", onKey);
    list.addEventListener("focusin", onFocus);
    return () => {
      list.removeEventListener("keydown", onKey);
      list.removeEventListener("focusin", onFocus);
      for (const li of plates) for (const link of linksOf(li)) link.removeAttribute("tabindex");
    };
  }

  private platesStep(b: BeatState, vp: Vp, frame: FrameInfo): void {
    let want = -1;
    let card = -1;
    if (this.live || this.pinned >= 0) {
      if (this.pinned >= 0) {
        want = this.pinned;
        card =
          this.pinnedCard >= 0 && this.pics[this.pinnedCard] === want
            ? this.pinnedCard
            : this.pics.indexOf(want);
      } else if (this.hoverCard >= 0 && this.hoverCard < WALL_CARDS) {
        want = this.pics[this.hoverCard]!;
        card = this.hoverCard;
      }
    }
    if (want >= 0) {
      this.shown = want;
      this.shownCard = card;
      this.shownUntil = frame.time + 0.35;
    } else if (this.plateHover) {
      this.shownUntil = frame.time + 0.35;
    } else if (frame.time > this.shownUntil || !this.live) {
      this.shown = -1;
    }
    if (b.s > T.outTo + 0.5 && this.pinned >= 0) this.pinned = -1;
    this.paintPlates(this.shown);
    if (this.shown < 0) return;
    const el = this.plates[this.shown];
    const c = this.layer.cards[this.shownCard];
    if (!el || !c?.shown) return;
    const box = {
      x: vp.w / 2 + c.cx - c.hw,
      y: vp.h / 2 - c.cy - c.hh,
      w: 2 * c.hw,
      h: 2 * c.hh,
    };
    const at = platePlace(box, this.plateBox, { w: vp.w, h: vp.h }, this.platePt, 14, NAV_INSET);
    el.style.transform = `translate3d(${at.x.toFixed(1)}px, ${at.y.toFixed(1)}px, 0)`;
  }

  private shownPaint = -2;

  /** Switch the plate of `index` on and every other off (written only when it changes). */
  private paintPlates(index: number): void {
    if (index === this.shownPaint) return;
    this.shownPaint = index;
    this.plates.forEach((el, i) => {
      if (!el) return;
      if (i === index) {
        el.dataset.on = "1";
        const r = el.getBoundingClientRect();
        if (r.width > 0) {
          this.plateBox.w = r.width;
          this.plateBox.h = r.height;
        }
      } else {
        delete el.dataset.on;
      }
    });
  }
}

/** Build the section's scene: the cards, and Tetra, the drone and the marks it shares with the others. */
export async function createRuntime(ctx: SectionCtx): Promise<SectionRuntime> {
  const [tetra, drone, marks, backdrop] = await Promise.all([
    ensureTetra(ctx),
    ensureDrone(ctx),
    ensureMarks(ctx),
    ensureBackdrop(ctx).catch(() => null),
  ]);
  return new BendRuntime(ctx, tetra, drone, marks, backdrop);
}
