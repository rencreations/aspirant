/**
 * The cards of the bend section on the GPU: a store of the pictures' textures, and a layer of card
 * meshes that two shared passes of the stage draw. A card in front of Tetra (z above 0) is in the
 * pass drawn after her, a card behind her in the pass drawn before, so a ring and a spiral really
 * go round her. The pictures come from the section's bitmap store (the loading list filled it); a
 * picture that has not arrived shows the card's own colour and fades into the picture when it does.
 * The runtime sets every card's pose every frame and calls `update`; nothing here allocates per frame.
 */
import {
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  PlaneGeometry,
  ShaderMaterial,
  Texture,
  Vector2,
  Vector3,
  Vector4,
  type Scene,
} from "three";

import type { Stage } from "../../kernel/stage";
import type { Pass } from "../../kernel/types";

import { getBitmap, peekBitmap, releaseBitmap } from "./bitmaps";
import { CARD_FRAGMENT, CARD_VERTEX } from "./card-shader";
import { LENS, type CardPose } from "./formations";
import { decodedSize, hexToRgb, type PicSource, type Rgb } from "./pictures";

const BACK_ORDER = 24;
const FRONT_ORDER = 28;
/** Frames left empty between two texture uploads. */
const UPLOAD_GAP = 2;
/** How long a picture takes to come up out of its card's colour, in seconds. */
const REVEAL_SECONDS = 0.5;

interface PicSlot {
  readonly src: PicSource;
  texture: Texture | null;
  ready: boolean;
  loading: boolean;
  wanted: boolean;
  readyAt: number;
  readonly color: Rgb;
}

/** The textures of the pictures, made when wanted and let go when not (the GPU budget). */
class PicStore {
  readonly slots: PicSlot[];
  now = 0;
  private readonly uploads: Texture[] = [];
  private uploading = false;
  private disposed = false;
  private readonly aniso: number;

  constructor(
    private readonly stage: Stage,
    sources: readonly PicSource[],
  ) {
    this.aniso = Math.min(8, stage.renderer.capabilities.getMaxAnisotropy());
    this.slots = sources.map((src) => ({
      src,
      texture: null,
      ready: false,
      loading: false,
      wanted: false,
      readyAt: 0,
      color: hexToRgb(src.color),
    }));
  }

  get count(): number {
    return this.slots.length;
  }

  isReady(i: number): boolean {
    return this.slots[i]?.ready === true;
  }

  /** How far the picture has come up out of the card's colour (0 to 1). */
  reveal(i: number): number {
    const slot = this.slots[i];
    if (!slot?.ready) return 0;
    const k = (this.now - slot.readyAt) / REVEAL_SECONDS;
    return k < 0 ? 0 : k > 1 ? 1 : k * k * (3 - 2 * k);
  }

  /** The picture is wanted on the GPU: take it from the store, or fetch it. */
  want(i: number): void {
    const slot = this.slots[i];
    if (!slot || this.disposed) return;
    slot.wanted = true;
    if (slot.ready || slot.loading) return;
    slot.loading = true;
    // A bitmap the loading list has already put in the store is made at once.
    const have = peekBitmap(slot.src.id);
    if (have) {
      slot.loading = false;
      this.make(slot, have);
      return;
    }
    void getBitmap(slot.src).then((bitmap) => {
      slot.loading = false;
      if (!bitmap || this.disposed || !slot.wanted || slot.ready) return;
      this.make(slot, bitmap);
    });
  }

  /** The picture is not needed for a while: its texture goes back to the GPU's pool. */
  drop(i: number): void {
    const slot = this.slots[i];
    if (!slot) return;
    slot.wanted = false;
    if (slot.texture) {
      slot.texture.dispose();
      slot.texture = null;
    }
    slot.ready = false;
  }

  textureOf(i: number): Texture | null {
    const slot = this.slots[i];
    return slot?.ready ? slot.texture : null;
  }

  private make(slot: PicSlot, bitmap: ImageBitmap): void {
    const tex = slot.texture ?? new Texture();
    tex.image = bitmap;
    tex.flipY = false;
    tex.premultiplyAlpha = false;
    tex.generateMipmaps = true;
    tex.minFilter = LinearMipmapLinearFilter;
    tex.magFilter = LinearFilter;
    tex.anisotropy = this.aniso;
    // The GPU has the picture after the first upload: this bitmap's memory goes back.
    tex.onUpdate = () => {
      releaseBitmap(slot.src.id, bitmap);
      tex.onUpdate = () => undefined;
    };
    tex.needsUpdate = true;
    slot.texture = tex;
    slot.ready = true;
    slot.readyAt = this.now;
    this.uploads.push(tex);
    this.drain();
  }

  /**
   * Upload one texture every third frame (about 15 ms of the driver each in dev), so no frame pays for
   * more than one and the frames in between are clean: twenty-six pictures take about a second and a
   * half, in the quiet beat where nothing else is drawn (see `artNeeded`).
   */
  private drain(): void {
    if (this.uploading) return;
    this.uploading = true;
    let wait = 0;
    const step = (): void => {
      if (this.disposed) return;
      if (wait > 0) {
        wait -= 1;
        window.requestAnimationFrame(step);
        return;
      }
      const t = this.uploads.shift();
      if (t && !this.stage.lost) this.stage.renderer.initTexture(t);
      wait = UPLOAD_GAP;
      if (this.uploads.length > 0) window.requestAnimationFrame(step);
      else this.uploading = false;
    };
    window.requestAnimationFrame(step);
  }

  /** The GL context was made again: the pictures on the GPU are gone. Fetch the wanted ones once more. */
  rebuilt(): void {
    if (this.disposed) return;
    this.uploads.length = 0;
    const again: number[] = [];
    this.slots.forEach((slot, i) => {
      if (!slot.ready) return;
      slot.texture?.dispose();
      slot.texture = null;
      slot.ready = false;
      slot.loading = false;
      if (slot.wanted) again.push(i);
    });
    for (const i of again) this.want(i);
  }

  dispose(): void {
    this.disposed = true;
    this.uploads.length = 0;
    for (const slot of this.slots) {
      slot.texture?.dispose();
      slot.texture = null;
      slot.ready = false;
      releaseBitmap(slot.src.id);
    }
  }
}

/** A one pixel texture for a card whose picture has not arrived (an unbound sampler reads black). */
const blankTexture = (): Texture => {
  const t = new DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
  t.needsUpdate = true;
  return t;
};

/** One card: a plane with its own material, its pose and where it stands on the screen. */
class Card {
  readonly mesh: Mesh<PlaneGeometry, ShaderMaterial>;
  /** The picture it shows (an index into the store) or -1. */
  pic = -1;
  /** Width over height of the picture. */
  aspect = 1;
  shown = false;
  /** Where it is on the screen now, for the pointer: the middle, half the width and height, the depth. */
  cx = 0;
  cy = 0;
  hw = 0;
  hh = 0;
  depth = 0;
  private px = 0;
  private py = 0;
  private hasPrev = false;
  private speed = 0;

  private readonly u = {
    tMap: { value: null as Texture | null },
    tSprite: { value: null as Texture | null },
    uHalf: { value: new Vector2(100, 100) },
    uPad: { value: 0 },
    uTex: { value: new Vector2(512, 512) },
    uColor: { value: new Vector3(0.85, 0.87, 0.9) },
    uReveal: { value: 0 },
    uCorner: { value: 8 },
    uOpacity: { value: 1 },
    uShade: { value: 1 },
    uBlur: { value: 0 },
    uHover: { value: 0 },
    uShadow: { value: 0.16 },
    uPaper: { value: 0 },
    uSprite: { value: new Vector4(0.5, 0.5, 0.43, 0.22) },
    uPop: { value: 0 },
    uFlutter: { value: 0 },
    uPhase: { value: 0 },
  };

  constructor(geometry: PlaneGeometry, blank: Texture, name: string, phase: number) {
    this.u.tMap.value = blank;
    this.u.tSprite.value = blank;
    this.u.uPhase.value = phase;
    const material = new ShaderMaterial({
      uniforms: this.u,
      vertexShader: CARD_VERTEX,
      fragmentShader: CARD_FRAGMENT,
      transparent: true,
      premultipliedAlpha: true,
      depthTest: false,
      depthWrite: false,
    });
    material.toneMapped = false;
    this.mesh = new Mesh(geometry, material);
    this.mesh.name = name;
    this.mesh.rotation.order = "YXZ";
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
  }

  /** Make the card the paper of the drone: the flat colour with a sheet's rule, and the drone on it. */
  setPaper(on: boolean, sprite: Texture, color: Rgb): void {
    this.u.uPaper.value = on ? 1 : 0;
    this.u.tSprite.value = sprite;
    this.u.uColor.value.set(color[0], color[1], color[2]);
  }

  /** Point the card at a picture. `texture` null shows the colour. */
  setPicture(texture: Texture | null, blank: Texture, color: Rgb, src: PicSource): void {
    this.u.tMap.value = texture ?? blank;
    this.u.uColor.value.set(color[0], color[1], color[2]);
    const size = decodedSize(src);
    this.u.uTex.value.set(size.w, size.h);
  }

  /**
   * Put the card at `pose`. `aspect` is the picture's width over height, `reveal` how far the picture is
   * up, `hover` how hovered it is (0 to 1), `pop` the paper's pop, `dt` the frame time (for the flutter).
   */
  write(pose: CardPose, reveal: number, hover: number, pop: number, dt: number): void {
    const area = pose.size;
    const root = Math.sqrt(this.aspect);
    const h = area / root;
    const w = area * root;
    const m = this.mesh;
    m.position.set(pose.x, pose.y, pose.z);
    m.rotation.set(pose.rx, pose.ry, pose.rz);
    const u = this.u;
    const blurPad = pose.blur * 0.07 * area;
    u.uHalf.value.set(w * 0.5, h * 0.5);
    u.uPad.value = 0.1 * area + blurPad + 6;
    u.uCorner.value = Math.min(w, h) * 0.045;
    u.uOpacity.value = pose.opacity;
    u.uShade.value = pose.shade;
    u.uBlur.value = pose.blur;
    u.uHover.value = hover;
    u.uReveal.value = reveal;
    u.uPop.value = pop;
    u.uShadow.value = 0.16;

    // Where it is on the screen: the middle and the half size, with the tilt taken into account.
    const k = LENS / (LENS - pose.z);
    this.cx = pose.x * k;
    this.cy = pose.y * k;
    this.hw = w * 0.5 * k * Math.max(0.3, Math.abs(Math.cos(pose.ry)));
    this.hh = h * 0.5 * k * Math.max(0.4, Math.abs(Math.cos(pose.rx)));
    this.depth = 150 + (600 - pose.z) * 0.2;

    // A card that moves fast flutters: the paper bends with its speed.
    if (this.hasPrev && dt > 0) {
      const v = Math.hypot(this.cx - this.px, this.cy - this.py) / dt;
      this.speed += (v - this.speed) * Math.min(1, dt * 12);
    } else {
      this.speed = 0;
    }
    this.px = this.cx;
    this.py = this.cy;
    this.hasPrev = true;
    u.uFlutter.value = 0.05 * Math.tanh(this.speed / 2400) * h * 3;
  }

  /** Forget where the card was (it was hidden, or the scene jumped): no flutter from a jump. */
  forget(): void {
    this.hasPrev = false;
    this.speed = 0;
  }

  dispose(): void {
    this.mesh.material.dispose();
  }
}

/** The layer: the cards, the two passes they are drawn in, and the store of their pictures. */
export class CardLayer {
  readonly cards: Card[] = [];
  readonly store: PicStore;
  droneZ = Infinity;
  private readonly backAboveDrone: Scene;
  private readonly frontAboveDrone: Scene;
  private readonly back: Scene;
  private readonly frontScene: Scene;
  private readonly geometry = new PlaneGeometry(1, 1, 8, 8);
  private readonly blank = blankTexture();
  private readonly removers: Array<() => void> = [];

  constructor(stage: Stage, sources: readonly PicSource[], count: number, onRebuild: () => void) {
    this.store = new PicStore(stage, sources);
    const backPass = stage.scenePass("bend-back", "perspective", BACK_ORDER);
    this.back = backPass.scene;
    this.backAboveDrone = stage.scenePass("bend-back-near", "perspective", 26).scene;
    this.frontAboveDrone = stage.scenePass("bend-front-near", "perspective", 36).scene;
    this.frontScene = stage.scenePass("bend-front", "perspective", FRONT_ORDER).scene;
    for (let i = 0; i < count; i += 1) {
      const card = new Card(this.geometry, this.blank, `bend-card-${i}`, i * 1.7);
      this.cards.push(card);
      this.back.add(card.mesh);
    }
    // One program serves every card: make it now, so the first card that shows does not stall a frame.
    const first = this.cards[0];
    if (first && !stage.lost) {
      first.mesh.visible = true;
      try {
        stage.renderer.compile(backPass.scene, backPass.camera);
      } finally {
        first.mesh.visible = false;
      }
    }
    // A pass that draws nothing but hears that the GL context was made again.
    const watcher: Pass = {
      name: "bend-watch",
      order: 0,
      active: () => false,
      render: () => undefined,
      rebuild: () => {
        this.store.rebuilt();
        onRebuild();
      },
    };
    this.removers.push(stage.addPass(watcher));
  }

  /** Show card `i` with a picture of the store (`pic` -1 hides its picture and shows the colour only). */
  setPicture(i: number, pic: number): void {
    const card = this.cards[i];
    if (!card) return;
    card.pic = pic;
    const slot = pic >= 0 ? this.store.slots[pic] : undefined;
    card.aspect = slot ? slot.src.aspect : 1;
    if (slot) card.setPicture(this.store.textureOf(pic), this.blank, slot.color, slot.src);
    else card.setPaper(false, this.blank, [0.85, 0.87, 0.9]);
  }

  /** Refresh the textures cards point at (a picture that has arrived since). Cheap: a pointer per card. */
  refresh(i: number): void {
    const card = this.cards[i];
    if (!card || card.pic < 0) return;
    const slot = this.store.slots[card.pic];
    if (slot) card.setPicture(this.store.textureOf(card.pic), this.blank, slot.color, slot.src);
  }

  /** Put the drone's paper on card `i` (its picture is the paper colour, the sprite is the drone). */
  setPaper(i: number, sprite: number, paper: Rgb): void {
    const card = this.cards[i];
    if (!card) return;
    card.pic = -1;
    card.aspect = 0.8;
    card.setPaper(true, this.store.textureOf(sprite) ?? this.blank, paper);
  }

  /** Draw card `i` at `pose`, in the pass that is behind Tetra or the one in front of her. */
  place(i: number, pose: CardPose, reveal: number, hover: number, pop: number, dt: number): void {
    const card = this.cards[i];
    if (!card) return;
    const visible = pose.opacity > 0.003 && pose.size > 1;
    if (!visible) {
      this.hide(i);
      return;
    }
    const front = pose.z > 0;
    const aboveDrone = pose.z > this.droneZ;
    const scene = front
      ? aboveDrone
        ? this.frontAboveDrone
        : this.frontScene
      : aboveDrone
        ? this.backAboveDrone
        : this.back;
    if (card.mesh.parent !== scene) scene.add(card.mesh);
    card.mesh.visible = true;
    card.shown = true;
    card.write(pose, reveal, hover, pop, dt);
  }

  hide(i: number): void {
    const card = this.cards[i];
    if (!card) return;
    card.mesh.visible = false;
    card.shown = false;
    card.forget();
  }

  hideAll(): void {
    for (let i = 0; i < this.cards.length; i += 1) this.hide(i);
  }

  /** The depth of the card `hit` found last. */
  hitDepth = Infinity;

  /**
   * The card under the point `(x, y)` (the stage frame: the origin in the middle, y up), the nearest
   * first, or -1. Only the first `only` cards are asked.
   */
  hit(x: number, y: number, only: number): number {
    let best = -1;
    let bestDepth = Infinity;
    for (let i = 0; i < this.cards.length && i < only; i += 1) {
      const c = this.cards[i]!;
      if (!c.shown) continue;
      if (Math.abs(x - c.cx) > c.hw || Math.abs(y - c.cy) > c.hh) continue;
      if (c.depth < bestDepth) {
        bestDepth = c.depth;
        best = i;
      }
    }
    this.hitDepth = bestDepth;
    return best;
  }

  dispose(): void {
    for (const card of this.cards) {
      card.mesh.removeFromParent();
      card.dispose();
    }
    this.cards.length = 0;
    this.geometry.dispose();
    this.blank.dispose();
    this.store.dispose();
    for (const remove of this.removers) remove();
    this.removers.length = 0;
  }
}
