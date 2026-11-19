/**
 * The rows: the aspirants' plane of cards over the whole screen, driven by the scroll (round three,
 * 20 Nov 2026). The pictures slide along their rows with the scroll, in both directions, and stand
 * when the visitor stops (`slide.ts`). Then the transition (`journey.ts`, `zone.ts`), scrubbed by the
 * scroll: a space opens in the middle row, the film shows in it at the size of a picture and rides with
 * its row to the middle of the screen, the rows come to rest, the other pictures slide off along their
 * rows, and the film grows and turns upright into the strip (joint J3, `strip/film-state.ts` holds the
 * film's whole state as a function of the story position).
 *
 * Everything is a function of the scroll and the viewport, so a seek, a jump and a scroll back land
 * exactly. In the section's lead (`local < 0`) the aspirants' scene still owns the field, so this
 * runtime leaves it alone.
 */
import { ensureDrone, type DroneActor } from "../../actors/drone";
import { newRoutePlace, routeAt, type DroneRoutePlace } from "../../drone-route";
import { ensureBackdrop, type Backdrop } from "../../fx/backdrop";
import { FIELD_ORDER, ensureField, type FieldActor } from "../../fx/image-field";
import { wallGrid } from "../../fx/image-field/grid";
import type { CardPose } from "../../fx/image-field/types";
import type { WallGeom } from "../../fx/image-field/wall";
import { FILM_ORDER, ensureFilm, type FilmActor } from "../../fx/video-plane";
import { makeState, type FilmState } from "../../fx/video-plane/types";
import { setGroundCue } from "../../kernel/background";
import type { FrameInfo, SectionCtx, SectionRuntime } from "../../kernel/types";
import { sectionStart } from "../../kernel/where";
import { backdropAt } from "../backdrops";
import { STORY, storyAt } from "../story";
import { filmStateAt } from "../strip/film-state";

import { rowsPose, visibleReach, type RowsPlay } from "./clearing";
import { appearAt, clearAt, gapAt, slideShape } from "./journey";
import { groundDark } from "./ground";
import { makeRide, planRide, scrollSlide, type Ride } from "./slide";
import { ROWS_DWELL, ROWS_ZONE } from "./zone";

/** The rows are seen through the wall's long lens, with the edge smear the field gives the rows. */
const ROWS_LENS = 2000;
const ROWS_EDGES = 0.35;

class RowsRuntime implements SectionRuntime {
  private readonly route: DroneRoutePlace = newRoutePlace();
  private readonly state: FilmState = makeState();
  private geom: WallGeom;
  private geomFor: { w: number; h: number } | null = null;
  /** The wall slot of each cell, read when the cells change (a resize makes more or fewer). */
  private slots: number[] = [];
  private slotsFor = -1;
  /** Where the transition starts and how the film rides: fixed by the scroll, the screen and `anchor`. */
  private readonly ride: Ride = makeRide();
  /**
   * What the plane's slide carried over `scrollSlide` in the lead, where the wall is still on: kept through
   * the dwell and the zone, so the rows take the plane over from the wall without a step whatever the wall's
   * own slide is (0 when it follows `scrollSlide`).
   */
  private anchor = 0;
  private plannedAnchor = Number.NaN;
  private plannedGeom: WallGeom | null = null;

  /** The transition for the frame being set, read by the field's pose function. */
  private slide = 0;
  private readonly play: RowsPlay = { filmU: 0, gap: 0, clear: 0, reach: 0 };

  /** The field's pose of a cell while the transition runs. */
  private readonly pose = (i: number, out: CardPose): void => {
    rowsPose(this.geom, this.slots[i]!, this.slide, this.play, out);
  };

  constructor(
    private readonly field: FieldActor,
    private readonly film: FilmActor,
    private readonly drone: DroneActor | null,
    private readonly backdrop: Backdrop | null,
  ) {
    this.geom = wallGrid({ w: 1440, h: 900 }).geom;
  }

  /** `v` is the kernel's: negative in the lead, 0 in the dwell, 0 to 1 across the zone, above 1 in the tail. */
  update(v: number, frame: FrameInfo): void {
    const vp = frame.viewport;
    if (this.geomFor?.w !== vp.w || this.geomFor.h !== vp.h) {
      this.geomFor = { w: vp.w, h: vp.h };
      this.geom = wallGrid(vp).geom;
    }
    // In the lead the wall owns the plane: note how far its slide is from the scroll's, up to the frame the rows take over.
    if (v < 0) this.anchor = this.field.slideAt - scrollSlide(this.geom, frame.S);
    if (v >= 0 && (this.plannedGeom !== this.geom || this.plannedAnchor !== this.anchor)) {
      this.plannedAnchor = this.anchor;
      this.plannedGeom = this.geom;
      planRide(
        this.geom,
        vp,
        sectionStart("rows") + ROWS_DWELL,
        ROWS_ZONE,
        STORY.rows.length,
        this.ride,
        this.anchor,
      );
    }
    // The transition's progress and its story position; the slide of the dwell is the scroll's own.
    const t = Math.min(1, Math.max(0, v));
    const s = t * STORY.rows.length;
    const S = storyAt("rows", s);

    // The ground goes dark through the transition (scroll based, reversible).
    setGroundCue("daybreak", "storm", groundDark(s));

    // The lead: the wall is still closing and the aspirants' scene owns the field.
    if (v >= 0) this.driveField(t, s, frame.S);
    this.driveFilm(S, t, s);
    this.driveDrone(S, vp);
    this.driveBackdrop(S);
  }

  private driveField(v: number, s: number, scroll: number): void {
    const f = this.field;
    f.visible = true;
    f.setOrder(FIELD_ORDER);
    f.setEdges(null);
    f.setWake(true);
    f.setCursor(null);
    f.onClick(null);
    f.setClip(null);
    f.setOpacity(1);
    f.setHoldOnHover(false);
    this.refreshSlots();

    if (v <= 0) {
      // The dwell: the pictures slide with the scroll and nothing else.
      f.setInteractive(true);
      f.holdSlideAt(scrollSlide(this.geom, scroll) + this.anchor);
      f.show("rows");
      return;
    }

    // The transition. The rows are driven by hand: where they stood, plus the slide's shape.
    const r = this.ride;
    this.slide = r.phase0 + r.ride * slideShape(s, r.slope);
    f.holdSlideAt(this.slide);
    // No hover lift while a space opens: a lifted card could reach the film.
    f.setInteractive(false);

    const play = this.play;
    play.filmU = r.startU * (1 - slideShape(s, r.slope));
    play.gap = gapAt(s);
    play.clear = clearAt(s);
    f.visible = play.clear < 0.9999;
    if (play.clear > 0) {
      const vp = this.geomFor!;
      play.reach = visibleReach(this.geom, vp.w, vp.h, play.filmU);
    }
    if (play.clear > 0 || play.gap > 0) f.custom(this.pose, ROWS_LENS, ROWS_EDGES);
    else f.show("rows");
  }

  private refreshSlots(): void {
    const n = this.field.count;
    if (n === this.slotsFor) return;
    this.slotsFor = n;
    this.slots = Array.from({ length: n }, (_, i) => this.field.cardInfo(i)?.slot ?? 0);
  }

  private driveFilm(S: number, v: number, s: number): void {
    const film = this.film;
    filmStateAt(S, this.ride.startU, this.state, this.ride.slope);
    if (v <= 0 || appearAt(s) <= 0.0005) return;
    film.show(this.state);
    film.setOrder(FILM_ORDER);
    film.setHover("signature");
    film.setInteractive(true);
    film.setHeroCursor(null);
    film.onHeroClick(null);
  }

  private driveDrone(S: number, vp: { readonly w: number; readonly h: number }): void {
    const drone = this.drone;
    if (!drone) return;
    const r = routeAt(S, vp, this.route);
    drone.visible = r.visible;
    drone.layer("back");
    drone.setInteractive(true);
    drone.look("pointer");
    drone.place(r);
  }

  /** The silk of the wall fades with the paper (`backdrops.ts`); from the end of the transition the strip's own backdrop takes over. */
  private driveBackdrop(S: number): void {
    const back = backdropAt(S);
    if (back) this.backdrop?.set(back.kind, back.options);
  }

  dispose(): void {
    // The field, the film and the drone belong to the page's actor registry: nothing to give back.
  }
}

export async function createRuntime(ctx: SectionCtx): Promise<SectionRuntime> {
  const [field, film, drone, backdrop] = await Promise.all([
    ensureField(ctx),
    ensureFilm(ctx),
    ensureDrone(ctx).catch(() => null),
    ensureBackdrop(ctx).catch(() => null),
  ]);
  return new RowsRuntime(field, film, drone, backdrop);
}
