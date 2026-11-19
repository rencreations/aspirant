/**
 * The rows: the aspirants' plane of small cards over the whole screen. At rest (the dwell) they glide
 * for ever and the visitor's scroll makes them faster. The play is the transition (`index.ts`,
 * `journey.ts`): the space opens in the middle row, the film rides in with the row, the rows come to
 * rest, the other cards clear from the film, the film turns upright into the strip (joint J3,
 * `strip/film-state.ts` holds the film's whole state as a function of the story position).
 *
 * The section's virtual `local` `v` is 0 at rest and 1 when the strip's small state stands; in its lead
 * (`v < 0`) the aspirants' close is still running and owns the field, so this runtime leaves it alone.
 * Everything in the play is a function of `v`, except where the rows stood and how fast they went when
 * the play began (they are read in the dwell, once a frame, and held while the play runs).
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
import { sectionScreens, sectionStart } from "../../kernel/where";
import { backdropAt } from "../backdrops";
import { STORY, storyAt } from "../story";
import { filmStateAt } from "../strip/film-state";

import { clearingReach, rowsPose, type RowsPlay } from "./clearing";
import {
  ROWS_BEATS,
  appearAt,
  clearAt,
  filmStartU,
  gapAt,
  rideDistance,
  rideReach,
  slideShape,
} from "./journey";
import { groundDark, rowsRate } from "./speed";

/** The rows are seen through the wall's long lens, with the edge smear the field gives the rows. */
const ROWS_LENS = 2000;
const ROWS_EDGES = 0.35;
/** The play's real length, for the slide's shape (the registry's `ROWS_PLAY_SECONDS` times the slide's share of it). */
const SLIDE_SECONDS = 3 * (ROWS_BEATS.slide[1] / STORY.rows.length);

class RowsRuntime implements SectionRuntime {
  private readonly route: DroneRoutePlace = newRoutePlace();
  private readonly state: FilmState = makeState();
  private geom: WallGeom;
  private geomFor: { w: number; h: number } | null = null;
  /** The wall slot of each cell, read when the cells change (a resize makes more or fewer). */
  private slots: number[] = [];
  private slotsFor = -1;

  /** Where the rows stood and how fast they went at the last frame of the dwell, held through the play. */
  private phase0 = 0;
  private speed0 = 0;
  private ride = 0;
  private startU = 0;
  private slope = 0;
  /** The play has been seen from its start (the dwell came first), so the numbers above are the real ones. */
  private rideKnown = false;

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

  update(v: number, frame: FrameInfo): void {
    const vp = frame.viewport;
    if (this.geomFor?.w !== vp.w || this.geomFor.h !== vp.h) {
      this.geomFor = { w: vp.w, h: vp.h };
      this.geom = wallGrid(vp).geom;
    }
    // `v` is the play's: 0 the rows at rest, 1 the strip's small state. The tail rests at 1.
    const s = Math.min(1, Math.max(0, v)) * STORY.rows.length;
    const S = storyAt("rows", s);

    // The ground: a little darker as the visitor scrolls on (scroll linked), then the play finishes it.
    const dwell = (frame.raw - sectionStart("rows")) / sectionScreens("rows");
    setGroundCue(
      "daybreak",
      "storm",
      groundDark(dwell, s, ROWS_BEATS.gap[1] * 0.3, ROWS_BEATS.appear[1] * 1.5),
    );

    // The lead: the wall is still closing and the aspirants' scene owns the field.
    if (v >= 0) this.driveField(v, s, frame);
    this.driveFilm(S, v);
    this.driveDrone(S, vp);
    const back = backdropAt(S);
    this.backdrop?.set(back.kind, back.options);
  }

  private driveField(v: number, s: number, frame: FrameInfo): void {
    const f = this.field;
    f.visible = true;
    f.setOrder(FIELD_ORDER);
    f.setEdges(null);
    f.setWake(true);
    f.setCursor(null);
    f.onClick(null);
    f.setClip(null);
    f.setOpacity(1);
    // The rows never stop: a hovered card lifts, it does not stop the glide.
    f.setHoldOnHover(false);
    this.refreshSlots();

    if (v <= 0) {
      // The dwell: the glide, faster with the scroll. Read where it is for the play that may come.
      f.setInteractive(true);
      f.setSlide(rowsRate(frame.input.wheel), 0);
      f.show("rows");
      this.phase0 = f.slideAt;
      this.speed0 = f.slideSpeed;
      this.rideKnown = false;
      return;
    }

    // The play. The rows are driven by hand: where they stood, plus the slide's shape.
    if (!this.rideKnown) this.beginRide(frame);
    const along = slideShape(s, this.slope);
    this.slide = this.phase0 + this.ride * along;
    f.holdSlideAt(this.slide);
    // No hover lift while a space opens: a lifted card could reach the film.
    f.setInteractive(false);

    const play = this.play;
    play.filmU = this.startU * (1 - along);
    play.gap = gapAt(s);
    play.clear = clearAt(s);
    f.visible = play.clear < 0.9999;
    if (play.clear > 0) play.reach = clearingReach(this.geom, play.filmU);
    if (play.clear > 0 || play.gap > 0) f.custom(this.pose, ROWS_LENS, ROWS_EDGES);
    else f.show("rows");
  }

  /** Fix the ride from where the rows stand: how far the film comes, which way, and the slide's first slope. */
  private beginRide(frame: FrameInfo): void {
    const g = this.geom;
    this.ride = rideDistance(
      g,
      this.phase0,
      Math.abs(this.speed0),
      rideReach(g, frame.viewport.w),
      SLIDE_SECONDS,
    );
    this.startU = filmStartU(g, this.ride);
    // The slide's cubic starts at the speed the rows had: a = speed * T / ride (T the slide's real seconds).
    this.slope = (Math.abs(this.speed0) * SLIDE_SECONDS) / this.ride;
    this.rideKnown = true;
  }

  private refreshSlots(): void {
    const n = this.field.count;
    if (n === this.slotsFor) return;
    this.slotsFor = n;
    this.slots = Array.from({ length: n }, (_, i) => this.field.cardInfo(i)?.slot ?? 0);
  }

  private driveFilm(S: number, v: number): void {
    const film = this.film;
    filmStateAt(S, this.startU, this.state, this.slope);
    if (v <= 0 || appearAt(Math.min(1, v) * STORY.rows.length) <= 0.0005) return;
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
