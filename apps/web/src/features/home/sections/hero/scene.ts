/**
 * What the hero and the aspirants both set on the shared picture field and the drone, every frame,
 * from the absolute scroll `S` (see `timeline.ts`). Two runtimes call it for the same frame in the
 * overlap of their ranges, and they pass the same arguments, so the order the kernel runs them in
 * never changes the picture. Nothing is allocated per frame: the clip, the wall's frame, the two
 * formation references and the drone's place are made once.
 */
import { newRoutePlace, routeAt, type DroneRoutePlace } from "../../drone-route";
import type { DroneActor } from "../../actors/drone";
import {
  FIELD_ORDER,
  FLIGHT,
  type CardPress,
  type FieldActor,
  type FormationRef,
  type Rect,
} from "../../fx/image-field";
import { wallGrid } from "../../fx/image-field/grid";
import { scrollSlide } from "../../fx/image-field/scroll-slide";
import { ALL_PREVIEW_PICTURES } from "../../preview/pictures";
import { setPreviewResolver, useHomePreview } from "../../preview/store";

import { clipOpen, rowsBlend, storyP, viewable } from "./timeline";

/**
 * The entrance of the cards when the page opens (seconds, real time): every card is a sheet of paper
 * thrown out from behind the logo with its own start, speed and wavy path (`fx/image-field/flight.ts`,
 * round three). The last card has landed after this long.
 */
export const ENTRANCE_SECONDS = FLIGHT.total;

const mix = (a: number, b: number, t: number): number => a + (b - a) * t;

export interface SceneInput {
  /** The scroll position, from the section's own `local`. */
  S: number;
  viewport: { readonly w: number; readonly h: number };
  /** 0 to 1: how far the cards have come out from behind the logo since the page opened (1 after it). */
  entrance: number;
  /** A point (stage px, y up) the drone looks at, or null for the pointer. */
  look?: { x: number; y: number } | null;
}

export class FieldScene {
  private readonly clip: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private readonly wall: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private readonly wallRef: FormationRef = { name: "wall" };
  private readonly rowsRef: FormationRef = { name: "rows" };
  private readonly storyRef: FormationRef = { name: "story", t: 0 };
  private readonly route: DroneRoutePlace = newRoutePlace();

  private readonly box: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private readonly near: Rect = { x: 0, y: 0, w: 0, h: 0 };
  private readonly removeResolver: () => void;

  /** A press on a card once the wall can be pressed: the preview opens, growing out of the card. */
  private readonly onPress = (press: CardPress): void => {
    const index = ALL_PREVIEW_PICTURES.findIndex((p) => p.id === press.wide.id);
    if (index < 0) return;
    const r = this.field.slotRect(press.index, this.box);
    useHomePreview.getState().show(index, r ? { x: r.x, y: r.y, w: r.w, h: r.h } : null);
  };

  constructor(
    private readonly field: FieldActor,
    private readonly drone: DroneActor | null,
  ) {
    // Where a picture's card is now, so the window can fly back into it when it closes.
    // A picture is on the wall more than once: the instance that is seen (inside the clip) and nearest
    // the card that was pressed is the one the window flies back into.
    this.removeResolver = setPreviewResolver((id) => {
      const from = useHomePreview.getState().from;
      const cx = from ? from.x + from.w / 2 : this.clip.x + this.clip.w / 2;
      const cy = from ? from.y + from.h / 2 : this.clip.y + this.clip.h / 2;
      let best: Rect | null = null;
      let bestD = Infinity;
      for (let i = 0; i < field.count; i++) {
        if (field.cardInfo(i)?.wide.id !== id) continue;
        const r = field.slotRect(i, this.near);
        if (!r) continue;
        const mx = r.x + r.w / 2;
        const my = r.y + r.h / 2;
        const c = this.clip;
        if (c.w > 0 && (mx < c.x || mx > c.x + c.w || my < c.y || my > c.y + c.h)) continue;
        const d = Math.hypot(mx - cx, my - cy);
        if (d < bestD) {
          bestD = d;
          best = { x: r.x, y: r.y, w: r.w, h: r.h };
        }
      }
      return best;
    });
  }

  dispose(): void {
    this.removeResolver();
  }

  /**
   * The plane's slide follows the page's absolute scroll `scroll` (screens), never a glide of its own
   * (round three: `scroll-slide.ts`, the line the rows continue). The aspirants call it every frame
   * they run, which is the whole hero too (their lead), so the slide is exact wherever the visitor is.
   */
  follow(scroll: number, viewport: { readonly w: number; readonly h: number }): void {
    this.field.holdSlideAt(scrollSlide(wallGrid({ w: viewport.w, h: viewport.h }).geom, scroll));
  }

  /** Every setter of the field this scene owns, as it stands at `S`. */
  update(input: SceneInput): void {
    const { S, viewport, entrance } = input;
    // A preview window is open: the wall rests and takes no hover.
    const previewOpen = useHomePreview.getState().open;
    const f = this.field;
    f.visible = true;
    // A section after this one may have changed these: they are put back every frame (all cheap).
    f.setOrder(FIELD_ORDER);
    f.setEdges(null);
    f.setWake(true);
    f.setHoldOnHover(true);

    // 1. The formation: the cards burst out of the ring when the page opens, then premotio's story
    //    (scatter, gather, ring, land, wall), then the wall opens into the rows.
    const rows = rowsBlend(S);
    if (rows >= 0.9999) {
      f.show("rows");
    } else if (rows > 0) {
      f.blend(this.wallRef, this.rowsRef, rows, 0.25, "left");
    } else if (entrance < 1) {
      // The cards fly out of a heap behind the logo into whatever the story shows now (the scatter
      // at rest), so a scroll that comes early never makes them jump.
      this.storyRef.t = storyP(S);
      f.fly(this.storyRef, entrance * ENTRANCE_SECONDS);
    } else {
      f.show("story", storyP(S));
    }
    f.setOpacity(1);

    // 2. The clip: the whole screen while the cards fly, the wall's frame under the words.
    const open = clipOpen(S);
    if (open >= 0.9999) {
      f.setClip(null);
    } else {
      f.frameRect("wall", this.wall);
      const c = this.clip;
      c.x = mix(this.wall.x, 0, open);
      c.y = mix(this.wall.y, 0, open);
      c.w = mix(this.wall.w, viewport.w, open);
      c.h = mix(this.wall.h, viewport.h, open);
      // The wall's cut edge (the right one, or the foot on a tall screen) is sharp: the pictures just end.
      f.setClip(c);
    }

    // 3. The hover, the cursor and the press. The slide is not set here: it follows the scroll (`follow`).
    const pressable = viewable(S) && !previewOpen;
    f.setInteractive(!previewOpen);
    f.setCursor(pressable ? "VIEW" : null);
    f.onClick(pressable ? this.onPress : null);

    // 4. The drone follows the journey (the lead's route, in `drone-route.ts`).
    const drone = this.drone;
    if (drone) {
      const r = routeAt(S, viewport, this.route);
      drone.visible = r.visible;
      drone.layer("back");
      drone.setInteractive(true);
      drone.look(input.look ?? "pointer");
      drone.place(r);
    }
  }
}
