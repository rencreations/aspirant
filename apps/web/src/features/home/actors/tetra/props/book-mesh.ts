/**
 * The comic book drawn: two boards with a cover each, the page blocks between them and one page that
 * turns. It lives in Tetra's own scene (her metres, her lens), so she holds it with her own hands;
 * it is not a child of her bones, so a mirrored doll never mirrors a cover. The state is
 * `book.ts`; this lays it on meshes. Unlit, like her, with a thin ink line round the boards.
 *
 * Seen from the visitor's side the book shows its outsides. Open, the back cover is on the left
 * and the front cover on the right: the two comics. Shut, only the back cover shows.
 */
import {
  BoxGeometry,
  CanvasTexture,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  TextureLoader,
  Vector3,
  type BufferGeometry,
  type Material,
  type Texture,
} from "three";

import { loadMedia } from "@/lib/media-store";

import { type BookState, boardAngles, pageTurn, popScale } from "./book";

/** The size of one board, in metres. The open book is twice as wide. */
const BOOK_W = 0.078;
export const BOOK_H = 0.11;
const BOARD_T = 0.0025;
const PAGE_T = 0.004;

const INK = 0x2a3342;
const BACK_COLOR = 0x3b5bdb;
const FRONT_COLOR = 0xe64980;
const PAPER = 0xfaf3e3;

/** A page of panels, drawn once: cream paper, black borders, a few tones. Nobody reads it. */
function pageTexture(variant: number): CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = 192;
  canvas.height = 256;
  const g = canvas.getContext("2d");
  if (!g) return null;
  g.fillStyle = "#faf3e3";
  g.fillRect(0, 0, 192, 256);
  const layouts: Array<Array<[number, number, number, number]>> = [
    [
      [10, 10, 172, 84],
      [10, 104, 82, 70],
      [100, 104, 82, 70],
      [10, 184, 172, 62],
    ],
    [
      [10, 10, 82, 110],
      [100, 10, 82, 52],
      [100, 70, 82, 50],
      [10, 130, 172, 116],
    ],
    [
      [10, 10, 172, 60],
      [10, 80, 56, 80],
      [74, 80, 108, 80],
      [10, 170, 172, 76],
    ],
  ];
  const tones = ["#f2b8c6", "#bcd0f5", "#f7e2a8", "#c9e8d4", "#e4d0f0"];
  const layout = layouts[variant % layouts.length] ?? layouts[0] ?? [];
  layout.forEach(([x, y, w, h], i) => {
    g.fillStyle = tones[(i + variant) % tones.length] ?? "#ddd";
    g.fillRect(x, y, w, h);
    g.strokeStyle = "#2a3342";
    g.lineWidth = 3;
    g.strokeRect(x, y, w, h);
    g.fillStyle = "rgba(42,51,66,0.55)";
    g.fillRect(x + 8, y + h - 14, w * 0.5, 4);
  });
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

async function loadCover(url: string): Promise<Texture | null> {
  try {
    const src = await loadMedia(url, { type: "image/webp" });
    const texture = await new TextureLoader().loadAsync(src);
    texture.colorSpace = SRGBColorSpace;
    return texture;
  } catch (error) {
    console.warn(`[tetra] the cover ${url} did not load: the book keeps its plain cover`, error);
    return null;
  }
}

export class BookMesh {
  /** Put this in her scene. It is placed by `place`. */
  readonly root = new Group();
  private readonly spine = new Group();
  private readonly frontPivot = new Group();
  private readonly backPivot = new Group();
  private readonly leafHinge = new Group();
  private readonly back: Mesh;
  private readonly front: Mesh;
  private readonly backMat: MeshBasicMaterial;
  private readonly frontMat: MeshBasicMaterial;
  private readonly leaf: Mesh;
  private readonly blocks: Mesh[] = [];
  private readonly geometries: BufferGeometry[] = [];
  private readonly materials: Material[] = [];
  private readonly textures: Texture[] = [];
  private covers: [Texture | null, Texture | null] = [null, null];
  private readonly pages: Array<CanvasTexture | null>;
  private readonly angles = { front: 0, back: 0 };
  private readonly turnNow = { angle: 0, lift: 0, bend: 0 };

  constructor() {
    const box = (w: number, h: number, t: number) => {
      const g = new BoxGeometry(w, h, t);
      this.geometries.push(g);
      return g;
    };
    const mat = (color: number, side = DoubleSide) => {
      const m = new MeshBasicMaterial({ color, toneMapped: false, side });
      this.materials.push(m);
      return m;
    };
    const edge = mat(INK);
    const paper = mat(PAPER);
    this.backMat = mat(BACK_COLOR);
    this.frontMat = mat(FRONT_COLOR);
    // A box has six faces: +x, -x, +y, -y, +z, -z. The outer face is +z.
    const faces = (outer: Material): Material[] => [edge, edge, edge, edge, outer, paper];
    this.pages = [pageTexture(0), pageTexture(1), pageTexture(2)];

    // The back board lies to the left of the spine, the front board to the right (or, shut, behind
    // the back one). Both are boxes with their outer face toward +z.
    this.back = new Mesh(box(BOOK_W, BOOK_H, BOARD_T), faces(this.backMat));
    this.back.position.set(-BOOK_W / 2, 0, 0);
    this.backPivot.add(this.back);
    this.front = new Mesh(box(BOOK_W, BOOK_H, BOARD_T), faces(this.frontMat));
    this.front.position.set(BOOK_W / 2, 0, 0);
    this.frontPivot.add(this.front);

    // The page blocks sit on the inner side of each board (toward -z), a little smaller.
    const blockMat = (i: number) => {
      const map = this.pages[i % 3] ?? null;
      const m = new MeshBasicMaterial({ color: map ? 0xffffff : PAPER, map, toneMapped: false });
      this.materials.push(m);
      return m;
    };
    const blockBack = new Mesh(box(BOOK_W * 0.94, BOOK_H * 0.95, PAGE_T), [
      paper,
      paper,
      paper,
      paper,
      paper,
      blockMat(0),
    ]);
    blockBack.position.set(0, 0, -(BOARD_T + PAGE_T) / 2);
    const blockFront = new Mesh(box(BOOK_W * 0.94, BOOK_H * 0.95, PAGE_T), [
      paper,
      paper,
      paper,
      paper,
      paper,
      blockMat(1),
    ]);
    blockFront.position.set(0, 0, -(BOARD_T + PAGE_T) / 2);
    this.blocks.push(blockBack, blockFront);
    this.back.add(blockBack);
    this.front.add(blockFront);

    // The page that turns, hinged at the spine: a plane that extends to +x and swings over.
    const leafGeo = new PlaneGeometry(BOOK_W * 0.94, BOOK_H * 1.06);
    this.geometries.push(leafGeo);
    const leafMat = new MeshBasicMaterial({
      color: 0xffffff,
      map: this.pages[2] ?? null,
      toneMapped: false,
      side: DoubleSide,
    });
    this.materials.push(leafMat);
    this.leaf = new Mesh(leafGeo, leafMat);
    this.leaf.position.set((BOOK_W * 0.94) / 2, 0, 0);
    this.leafHinge.add(this.leaf);
    this.leafHinge.visible = false;
    this.spine.add(this.backPivot, this.frontPivot, this.leafHinge);
    this.root.add(this.spine);
    this.root.visible = false;
  }

  /**
   * The covers: two pictures (or none). They are the outer faces of the back board (left) and the
   * front board (right). The mesh does not own them: a caller that made them frees them.
   */
  setCovers(left: Texture | null, right: Texture | null): void {
    this.covers = [left, right];
    for (const [m, t, color] of [
      [this.backMat, left, BACK_COLOR],
      [this.frontMat, right, FRONT_COLOR],
    ] as const) {
      m.map = t;
      m.color.set(t ? 0xffffff : color);
      m.needsUpdate = true;
    }
  }

  /** Covers from two addresses, through the media store (the loading list's copy when there is one). */
  async setCoverUrls(left: string | null, right: string | null): Promise<void> {
    const [a, b] = await Promise.all([
      left ? loadCover(left) : Promise.resolve(null),
      right ? loadCover(right) : Promise.resolve(null),
    ]);
    for (const t of [a, b]) if (t) this.textures.push(t);
    this.setCovers(a ?? this.covers[0], b ?? this.covers[1]);
  }

  /** Lay the state on the boards and the page. `pocket` is where it comes from and goes back to. */
  update(state: BookState, hold: Vector3, pocket: Vector3, carried = false): void {
    const present = state.present.x;
    const scale = carried ? present : popScale(present);
    this.root.visible = scale > 0.001;
    if (!this.root.visible) return;
    // The book is in her hands or in her pocket, and flies between them.
    const k = carried ? 1 : Math.min(1, Math.max(0, present));
    this.root.position.set(
      pocket.x + (hold.x - pocket.x) * k,
      pocket.y + (hold.y - pocket.y) * k,
      pocket.z + (hold.z - pocket.z) * k,
    );
    this.root.scale.setScalar(Math.max(0.001, scale));
    const o = Math.min(1, Math.max(0, state.open.x));
    const { front, back } = boardAngles(o, this.angles);
    // Shut, the book is one board wide: its middle is half a board to the left of the spine.
    this.spine.position.x = (BOOK_W / 2) * (1 - o);
    this.backPivot.rotation.y = back;
    this.frontPivot.rotation.y = front;
    // Shut, the front board lies behind the back one: one thickness of boards and pages.
    this.frontPivot.position.z = -(2 * BOARD_T + 2 * PAGE_T) * (1 - Math.min(1, o * 2));
    const showBlocks = o > 0.02;
    for (const block of this.blocks) block.visible = showBlocks;
    // The turning page swings over the spine from the right block to the left, toward her, and
    // rises over the top as it goes, so its edge is seen over the book.
    const turning = state.turning;
    this.leafHinge.visible = turning >= 0 && o > 0.8;
    if (this.leafHinge.visible) {
      const t = pageTurn(turning, this.turnNow);
      this.leafHinge.rotation.y = t.angle;
      this.leafHinge.position.z = -(BOARD_T + PAGE_T);
      this.leaf.position.y = BOOK_H * 0.22 * t.lift;
      this.leaf.rotation.x = 0.35 * t.bend;
      const m = this.leaf.material as MeshBasicMaterial;
      m.map = this.pages[(state.turned + 2) % 3] ?? null;
    }
  }

  /**
   * The corners of the outer face of one board, in the stage's frame once the caller has projected
   * them: the four world positions of the face, left side (the back cover) or right (the front).
   */
  corners(side: "left" | "right", out: Vector3[]): void {
    const board = side === "left" ? this.back : this.front;
    const sx = BOOK_W / 2;
    const sy = BOOK_H / 2;
    const z = BOARD_T / 2;
    const points = [
      [-sx, -sy],
      [sx, -sy],
      [sx, sy],
      [-sx, sy],
    ] as const;
    board.updateWorldMatrix(true, false);
    points.forEach(([x, y], i) => {
      (out[i] ?? (out[i] = new Vector3())).set(x, y, z).applyMatrix4(board.matrixWorld);
    });
  }

  get shown(): boolean {
    return this.root.visible;
  }

  dispose(): void {
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) m.dispose();
    for (const t of this.textures) t.dispose();
    for (const t of this.pages) t?.dispose();
    this.root.clear();
  }
}
