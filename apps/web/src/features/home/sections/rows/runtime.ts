/**
 * The rows (screens 5.8 to 8.2): the full screen rows of the picture field slide left under the
 * scroll, a small angled film appears in a gap of the middle row and rides it to the middle, the other
 * cards leave from it outward, and the film turns from angled to upright until it stands as the strip
 * (joint J3, `strip/film-state.ts` holds the film's whole state as a function of the scroll). The
 * ground goes dark at the start of the section (the kernel's cross-fade). The drone floats over the
 * rows on the lead's route.
 *
 * The field is the aspirants' wall at its end, so in the lead this runtime sets exactly what the
 * aspirants set (the rows at no offset). Everything is a function of the section's `local`.
 */
import { ensureDrone, type DroneActor } from "../../actors/drone";
import { newRoutePlace, routeAt, type DroneRoutePlace } from "../../drone-route";
import { FIELD_ORDER, ensureField, type FieldActor } from "../../fx/image-field";
import type { CardPose } from "../../fx/image-field/types";
import { FILM_ORDER, ensureFilm, type FilmActor } from "../../fx/video-plane";
import { rowsGeom } from "../../fx/video-plane/hero";
import { makeState, type FilmState } from "../../fx/video-plane/types";
import type { FrameInfo, SectionCtx, SectionRuntime } from "../../kernel/types";
import { filmStateAt, rowsScale } from "../strip/film-state";

import { clearedPose } from "./clearing";
import { clearAt, ROWS_SCREENS, ROWS_START, slideProgress, slideTravel } from "./journey";

/** The rows are seen through the wall's long lens, with the edge smear the field gives the rows. */
const ROWS_LENS = 2000;
const ROWS_EDGES = 0.35;

class RowsRuntime implements SectionRuntime {
  private readonly route: DroneRoutePlace = newRoutePlace();
  private readonly state: FilmState = makeState();
  /** The wall slot of each card, read once (it never changes with the screen). */
  private readonly slots: number[];
  /** The rows' slide, the clearing and the film's place along the middle row, for the frame being set. */
  private slide = 0;
  private clear = 0;
  private centreU = 0;
  private perWall = 1;
  private geomFor: { w: number; h: number } | null = null;
  private geom = rowsGeom({ w: 1440, h: 900 });

  /** The field's pose of a card while the clearing runs: the rows' own pose plus the push. */
  private readonly pose = (i: number, out: CardPose): void => {
    clearedPose(this.geom, this.slots[i]!, this.slide, this.centreU, this.clear, out);
  };

  constructor(
    private readonly field: FieldActor,
    private readonly film: FilmActor,
    private readonly drone: DroneActor | null,
  ) {
    this.slots = Array.from({ length: field.count }, (_, i) => field.cardInfo(i)?.slot ?? i);
  }

  update(local: number, frame: FrameInfo): void {
    const s = local * ROWS_SCREENS;
    const S = ROWS_START + s;
    const vp = frame.viewport;
    if (this.geomFor?.w !== vp.w || this.geomFor.h !== vp.h) {
      this.geomFor = { w: vp.w, h: vp.h };
      this.geom = rowsGeom(vp);
    }
    const scale = rowsScale(vp);
    this.perWall = scale.perWall;

    // Where the rows stood when the section began is the field's own glide (it stopped in the
    // aspirants), read with no offset. The rows slide on from there to a whole number of pitches, so
    // the gap of the middle row that the film rides ends at the middle of the screen.
    const f = this.field;
    f.setSlide(0, 0);
    const phase = f.slideAt * scale.perWall;
    const travel = slideTravel(phase, scale.pitch);
    const along = slideProgress(s);
    this.slide = phase + travel * along;
    this.clear = clearAt(s);
    this.centreU = travel * (1 - along);

    this.driveField(s, travel * along);
    this.driveFilm(S, travel);
    this.driveDrone(S, vp);
  }

  /** `slid`: how far the rows have slid since the section began, in the rows plane's pixels. */
  private driveField(s: number, slid: number): void {
    const f = this.field;
    // Every card has left: nothing to draw, and nothing for the pointer to find.
    f.visible = this.clear < 0.9999;
    f.setOrder(FIELD_ORDER);
    f.setEdges(null);
    f.setWake(true);
    f.setHoldOnHover(true);
    f.setInteractive(true);
    f.setCursor(null);
    f.onClick(null);
    f.setClip(null);
    f.setOpacity(1);
    f.setSlide(0, slid / this.perWall);
    if (this.clear > 0 && s > 0) f.custom(this.pose, ROWS_LENS, ROWS_EDGES);
    else f.show("rows");
  }

  private driveFilm(S: number, travel: number): void {
    const film = this.film;
    filmStateAt(S, travel, this.state);
    if (this.state.appear <= 0.0005) return;
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
  const [field, film, drone] = await Promise.all([
    ensureField(ctx),
    ensureFilm(ctx),
    ensureDrone(ctx).catch(() => null),
  ]);
  return new RowsRuntime(field, film, drone);
}
