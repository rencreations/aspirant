/**
 * The archive (screens 56.1 to 59.1): the ten rooms of the collection as ten covers in a row, and the
 * drone as the spotlight. It leaves Tetra at the lower left (she waves and runs off), flies up over
 * the first cover and tours the rooms: it rests over each one, that cover is lit (the others stand
 * back under a veil of paper), and its count and "Open the room" come up under it. There is no beam
 * and no pool of colour on the ground (the owner, 20 Nov 2026: no dynamic background). The row
 * slides the other way under the drone, so both are seen moving.
 * Hovering or focusing a cover pulls the drone to it; a tap on a cover that is not lit pulls the drone
 * there and a second tap opens it. At the end the covers lift away and the drone flies down to the
 * footer's card (joint J15), which is the footer's runtime's part (it takes the drone at 58.6).
 *
 * Everything is a function of the scroll position (`route.ts`, `geometry.ts`, tested) plus one piece
 * of interaction state: which cover the pointer or the keyboard is on. The DOM moves by transform
 * and opacity only; the per-cover numbers are custom properties on its list item, written when they
 * change, never on `<html>` or `<body>`.
 */
import { put } from "@/features/character/vexana/seams/scroll-kit";

import { ensureDrone, type DroneActor } from "../../actors/drone";
import { ensureTetra, type TetraActor } from "../../actors/tetra";
import type { FrameInfo, SectionCtx, SectionRuntime } from "../../kernel/types";

import {
  ROOMS,
  coverX,
  lit,
  nearest,
  restU,
  stripGeo,
  stripSlide,
  type StripGeo,
} from "./geometry";
import {
  AT,
  BUTTON_LATE,
  droneAt,
  footFor,
  lightAt,
  coverIn,
  coverOut,
  headAt,
  newTetraWant,
  tetraAt,
  toStage,
  tourAt,
  type Spot,
} from "./route";

/** The hover lets go this long after the pointer leaves a cover (seconds), so a gap between two is not a flicker. */
const HOLD = 0.35;
/** A tap on a cover pulls the drone for this long (seconds). */
const TAP_HOLD = 4;
/** Values are written in steps of this, so a still scene writes nothing. */
const STEP = 50;

const quant = (v: number): number => Math.round(v * STEP) / STEP;

class ArchiveRuntime implements SectionRuntime {
  private readonly strip: HTMLElement | null;
  private readonly rooms: HTMLElement[];
  private readonly links: HTMLAnchorElement[];
  private readonly off: Array<() => void> = [];

  private geo: StripGeo;
  private w = 0;
  private h = 0;

  // What was last written, so a still scene writes nothing.
  private readonly seenIn: number[];
  private readonly seenOut: number[];
  private readonly seenLit: number[];
  private seenTitle = -1;
  private seenButton = -1;
  private readonly title: HTMLElement | null;
  private readonly button: HTMLElement | null;

  // The one piece of interaction state: the cover the pointer or the keyboard is on.
  private hover = -1;
  private hovered = 0;
  private hoverUntil = -1;
  private blend = 0;
  private now = 0;
  private lit = 0;
  private air = 0;
  private touch = false;
  private dir = 1;
  private lastS = Number.NaN;

  private readonly spot: Spot = { x: 0, y: 0, height: 0 };
  private readonly stage: Spot = { x: 0, y: 0, height: 0 };
  private readonly tetraWant = newTetraWant();
  private readonly tetraStage: Spot = { x: 0, y: 0, height: 0 };

  constructor(
    private readonly ctx: SectionCtx,
    private readonly drone: DroneActor | null,
    private readonly tetra: TetraActor | null,
  ) {
    const text = ctx.dom.text;
    this.strip = text.querySelector<HTMLElement>("[data-archive-strip]");
    this.title = text.querySelector<HTMLElement>("h2");
    this.button = text.querySelector<HTMLElement>("[data-archive-button]");
    this.rooms = Array.from(text.querySelectorAll<HTMLElement>("[data-archive-room]"));
    this.links = this.rooms.map((li) => li.querySelector<HTMLAnchorElement>("a")!);
    this.seenIn = this.rooms.map(() => -1);
    this.seenOut = this.rooms.map(() => -1);
    this.seenLit = this.rooms.map(() => -1);
    const vp = ctx.viewport();
    this.geo = stripGeo(vp.w, vp.h);
    this.layout(vp.w, vp.h);
    this.listen();
  }

  // ----------------------------------------------------------------------------- the frame

  update(_local: number, frame: FrameInfo): void {
    // The whole route is the scene's scroll: the entry is a stretch of it that the visitor scrubs.
    const S = frame.S;
    const vp = frame.viewport;
    if (vp.w !== this.w || vp.h !== this.h) this.layout(vp.w, vp.h);
    this.now = frame.time;

    const pS = tourAt(S);
    const onAir = lightAt(S);

    // The visitor's hand on a cover pulls the light (and the drone) to it, and lets go a moment after.
    const held = this.hover >= 0 || this.now < this.hoverUntil;
    const want = held && onAir > 0.5 ? 1 : 0;
    this.blend =
      frame.dt > 0 ? this.blend + (want - this.blend) * (1 - Math.exp(-9 * frame.dt)) : want;
    const q = pS + (this.hovered - pS) * this.blend;
    this.lit = nearest(q);
    this.air = onAir;

    this.head(S);
    this.cards(S, q, onAir);
    if (S >= AT.start && S < AT.handover) this.actors(S, frame, q, onAir);
  }

  /** The title and the button: they come in with the first cover and go with the last. */
  private head(S: number): void {
    const title = Math.round(headAt(S) * STEP) / STEP;
    if (title !== this.seenTitle) {
      this.seenTitle = title;
      this.writeHead(this.title, title);
    }
    const button = Math.round(headAt(S, BUTTON_LATE) * STEP) / STEP;
    if (button !== this.seenButton) {
      this.seenButton = button;
      this.writeHead(this.button, button);
    }
  }

  private writeHead(el: HTMLElement | null, v: number): void {
    if (!el) return;
    el.style.setProperty("opacity", String(v));
    el.style.setProperty("transform", `translate3d(0, ${((1 - v) * 18).toFixed(1)}px, 0)`);
    el.style.setProperty("visibility", v < 0.01 ? "hidden" : "visible");
  }

  /** The covers: the row's slide, and every cover's three numbers. */
  private cards(S: number, q: number, onAir: number): void {
    put(
      this.strip,
      "transform",
      `translate3d(${(-stripSlide(this.geo, tourAt(S))).toFixed(2)}px, 0, 0)`,
    );
    for (let i = 0; i < ROOMS; i += 1) {
      const li = this.rooms[i];
      if (!li) continue;
      const rise = quant(coverIn(S, i));
      const away = quant(coverOut(S, i));
      // Lit: 1 while no light is on, and 1 on the cover the light is on once it is.
      const light = quant(onAir > 0 ? Math.max(lit(q, i) * onAir, 1 - onAir) : 1);
      const seenRise = this.seenIn[i] ?? -1;
      const seenAway = this.seenOut[i] ?? -1;
      if (rise !== seenRise) {
        this.seenIn[i] = rise;
        li.style.setProperty("--in", String(rise));
      }
      if (away !== seenAway) {
        this.seenOut[i] = away;
        li.style.setProperty("--out", String(away));
      }
      if (rise !== seenRise || away !== seenAway) {
        put(li, "visibility", rise * (1 - away) < 0.01 ? "hidden" : "visible");
      }
      if (light !== this.seenLit[i]) {
        this.seenLit[i] = light;
        li.style.setProperty("--lit", String(light));
      }
    }
  }

  /** The drone and Tetra, while the archive is the one that places them (from J14 to the footer's hand-over). */
  private actors(S: number, frame: FrameInfo, q: number, onAir: number): void {
    const vp = frame.viewport;
    const { drone, tetra } = this;
    const pointer = this.ctx.pointer.state;
    droneAt(S, frame.raw, q, vp, this.geo, footFor(vp), this.spot);
    toStage(vp, this.spot, this.stage);
    if (drone) {
      drone.visible = true;
      drone.layer("front");
      drone.setInteractive(true);
      drone.pose(null);
      drone.place(this.stage);
      drone.face(this.blend > 0.5 ? "sparkle" : "happy", 1);
      if (pointer.inside && pointer.type === "mouse") {
        drone.look("pointer");
      } else {
        // Down at the lit cover.
        const bx = coverX(this.geo, q, tourAt(S));
        drone.look({ x: bx - vp.w / 2, y: vp.h / 2 - this.geo.yc });
      }
    }
    if (tetra) {
      const want = tetraAt(S, vp, this.tetraWant);
      if (!want.visible) return;
      toStage(vp, { x: want.x, y: want.y, height: want.height }, this.tetraStage);
      // The way she faces follows the scroll (a scroll up turns her round and she runs back).
      const moved = Number.isNaN(this.lastS) ? 0 : S - this.lastS;
      if (Math.abs(moved) > 1e-5) this.dir = moved >= 0 ? 1 : -1;
      this.lastS = S;
      // She faces left (J14) and runs left; when the visitor scrolls back she turns and runs back.
      const running = want.run > 0 && want.run < 1;
      tetra.visible = true;
      tetra.setInteractive(true);
      tetra.place({
        x: this.tetraStage.x,
        y: this.tetraStage.y,
        height: this.tetraStage.height,
        flip: !running || this.dir >= 0,
      });
      tetra.runSpeed(0.55);
      if (running) {
        tetra.pose("run", 1);
        tetra.look(null);
      } else if (want.wave > 0.001) {
        tetra.pose("wave", want.wave);
        tetra.waveWith(1);
        // She looks at the drone, which is beside her and a little to her right.
        tetra.look({ x: this.stage.x, y: this.stage.y });
      } else {
        tetra.pose("idle", 1);
        tetra.look(onAir > 0 ? null : "pointer");
      }
    }
  }

  // ----------------------------------------------------------------------------- the DOM

  /** Size and place every cover. Once per resize, never per frame. */
  private layout(w: number, h: number): void {
    this.w = w;
    this.h = h;
    const g = stripGeo(w, h);
    this.geo = g;
    for (let i = 0; i < ROOMS; i += 1) {
      const li = this.rooms[i];
      if (!li) continue;
      li.style.left = `${(g.x0 + i * g.pitch - g.s / 2).toFixed(2)}px`;
      li.style.top = `${(g.yc - g.s / 2).toFixed(2)}px`;
      li.style.width = `${g.s.toFixed(2)}px`;
      li.style.height = `${g.s.toFixed(2)}px`;
    }
  }

  /** The way a pointer or a key puts the light on a cover. */
  private pull(i: number, seconds = Infinity): void {
    this.hover = i;
    this.hovered = i;
    this.hoverUntil = seconds === Infinity ? Infinity : this.now + seconds;
  }

  private release(i: number): void {
    if (this.hover !== i) return;
    this.hover = -1;
    this.hoverUntil = this.now + HOLD;
  }

  private listen(): void {
    this.links.forEach((link, i) => {
      const enter = (e: PointerEvent) => {
        this.touch = e.pointerType === "touch";
        if (!this.touch) this.pull(i);
      };
      const leave = (e: PointerEvent) => {
        if (e.pointerType !== "touch") this.release(i);
      };
      const focus = () => {
        this.pull(i);
        // A key put the focus here: bring the row to this cover so it is on the screen.
        if (link.matches(":focus-visible")) {
          this.ctx.scroll.to(AT.tourFrom + restU(i) * (AT.tourTo - AT.tourFrom));
        }
      };
      const blur = () => {
        this.release(i);
      };
      const click = (e: MouseEvent) => {
        // On a touch screen the first tap on a cover the light is not on calls the drone to it; the
        // second tap, on the lit cover, opens the room.
        if (!this.touch || e.defaultPrevented || this.air < 0.5 || i === this.lit) return;
        e.preventDefault();
        this.pull(i, TAP_HOLD);
        // And the row comes to it, so the cover is on the screen (on a phone its neighbour is at the edge).
        this.ctx.scroll.to(AT.tourFrom + restU(i) * (AT.tourTo - AT.tourFrom));
      };
      link.addEventListener("pointerenter", enter);
      link.addEventListener("pointerleave", leave);
      link.addEventListener("pointerdown", enter);
      link.addEventListener("focus", focus);
      link.addEventListener("blur", blur);
      link.addEventListener("click", click, true);
      this.off.push(() => {
        link.removeEventListener("pointerenter", enter);
        link.removeEventListener("pointerleave", leave);
        link.removeEventListener("pointerdown", enter);
        link.removeEventListener("focus", focus);
        link.removeEventListener("blur", blur);
        link.removeEventListener("click", click, true);
      });
    });
  }

  leave(): void {
    this.hover = -1;
    this.hoverUntil = -1;
    this.blend = 0;
  }

  dispose(): void {
    for (const off of this.off) off();
    this.off.length = 0;
    this.strip?.style.removeProperty("transform");
    for (const li of this.rooms) {
      for (const p of ["--in", "--out", "--lit", "visibility", "left", "top", "width", "height"]) {
        li.style.removeProperty(p);
      }
    }
    for (const el of [this.title, this.button]) {
      for (const p of ["opacity", "transform", "visibility"]) el?.style.removeProperty(p);
    }
  }
}

export async function createRuntime(ctx: SectionCtx): Promise<SectionRuntime> {
  const [drone, tetra] = await Promise.all([
    ensureDrone(ctx).catch(() => null),
    ensureTetra(ctx).catch(() => null),
  ]);
  return new ArchiveRuntime(ctx, drone, tetra);
}
